#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);
function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.trim() || 'git 실패');
  return result.stdout;
}
function quote(value) {
  if (process.platform !== 'win32') return `'${value.replaceAll("'", "'\\''")}'`;
  // cmd의 확장/메타 문자를 경로에서 허용하지 않아 셸 명령으로 해석되지 않게 한다.
  if (/["%\r\n!^&|<>]/.test(value)) throw new Error('특수 문자가 있는 경로는 verify.json에 직접 검증 명령을 설정하세요.');
  return `"${value}"`;
}
function detect(root, platform, changed) {
  const commands = [], skipped = [];
  if (platform === 'web') {
    const packageFile = path.join(root, 'package.json');
    if (!exists(packageFile)) return { commands, skipped: ['package.json 없음'] };
    const pkg = JSON.parse(read(packageFile));
    if (!exists(path.join(root, 'node_modules'))) return { commands, skipped: ['의존성 미설치: node_modules 없음'] };
    const manager = exists(path.join(root, 'pnpm-lock.yaml')) ? 'pnpm' : exists(path.join(root, 'yarn.lock')) ? 'yarn' : 'npm';
    const scripts = pkg.scripts || {};
    const type = ['type-check', 'typecheck'].find(name => scripts[name]);
    if (type) commands.push({ name: type, command: `${manager} run ${type}` });
    else skipped.push('타입 검사 script 없음: verify.json에 명령 지정 가능');
    if (scripts.lint) commands.push({ name: 'lint', command: `${manager} run lint` });
    else skipped.push('lint script 없음');
    // test script는 watch/dev 서버일 수 있어 추측 실행하지 않는다.
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const binary = name => path.join(root, 'node_modules', name);
    if (deps.vitest && exists(binary('vitest/vitest.mjs'))) commands.push({ name: 'test', command: `${quote(process.execPath)} ${quote(binary('vitest/vitest.mjs'))} run --passWithNoTests` });
    else if (deps.jest && exists(binary('jest/bin/jest.js'))) commands.push({ name: 'test', command: `${quote(process.execPath)} ${quote(binary('jest/bin/jest.js'))} --runInBand --passWithNoTests` });
    else skipped.push('자동 감지할 테스트 runner 없음: 필요한 테스트는 verify.json에 지정');
  } else if (platform === 'aos') {
    const wrapper = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    if (!exists(path.join(root, wrapper))) return { commands, skipped: ['Gradle wrapper 없음'] };
    const settings = ['settings.gradle.kts', 'settings.gradle'].find(file => exists(path.join(root, file)));
    if (!settings) return { commands, skipped: ['Gradle settings 없음'] };
    const text = read(path.join(root, settings)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    if (/projectDir\s*=|includeBuild\s*\(/.test(text)) return { commands, skipped: ['커스텀 모듈 경로/composite build: verify.json에 실제 명령 지정 필요'] };
    const modules = [...text.matchAll(/\binclude\s*(\([^)]*\)|[^\n]+)/g)].flatMap(match =>
      [...match[1].matchAll(/["'](:[\w:-]+)["']/g)].map(value => value[1]));
    const selected = [...new Set(modules)].filter(module => {
      const dir = module.slice(1).replaceAll(':', '/');
      return changed.some(file => file.startsWith(dir + '/')) || changed.some(file => /(^|\/)(settings\.gradle(\.kts)?|libs\.versions\.toml|gradle\.properties)$/.test(file));
    });
    const targets = selected.length ? selected : [...new Set(modules)];
    const tasks = [];
    for (const module of targets) {
      const dir = module.slice(1).replaceAll(':', '/');
      const build = ['build.gradle.kts', 'build.gradle'].find(file => exists(path.join(root, dir, file)));
      if (!build) { skipped.push(`${module}: build script 확인 불가`); continue; }
      const source = read(path.join(root, dir, build));
      const catalogPath = path.join(root, 'gradle/libs.versions.toml');
      const catalog = exists(catalogPath) ? read(catalogPath) : '';
      if (!/com\.android\.(application|library)|libs\.plugins\.android\.(application|library)/.test(source)) {
        skipped.push(`${module}: Android 플러그인 판별 불가, 명령 지정 필요`); continue;
      }
      tasks.push(`${module}:compileDebugKotlin`);
      const appliedPlugin = name => {
        if (new RegExp(`id\\s*\\(?\\s*["'][^"']*${name}[^"']*["']`).test(source)) return true;
        // 카탈로그에만 등록된 도구는 적용된 플러그인이 아니다.
        return [...source.matchAll(/alias\s*\(\s*libs\.plugins\.([\w.]+)\s*\)/g)].some(match => {
          const key = match[1].replaceAll('.', '-');
          const plugins = catalog.split(/^\[plugins\]\s*$/m)[1]?.split(/^\[/m)[0] || '';
          const entry = plugins.split(/\r?\n/).find(line => line.trim().startsWith(key + ' ') || line.trim().startsWith(key + '='));
          return entry && new RegExp(`id\\s*=\\s*["'][^"']*${name}[^"']*["']`).test(entry);
        });
      };
      if (appliedPlugin('ktlint')) tasks.push(`${module}:ktlintCheck`);
      else if (appliedPlugin('detekt')) tasks.push(`${module}:detekt`);
      else skipped.push(`${module}: 린트 미감지`);
    }
    if (tasks.length) commands.push({ name: 'gradle', command: `${process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew'} ${tasks.map(quote).join(' ')} --continue` });
    skipped.push('단위 테스트는 프로젝트의 실질 테스트 범위를 확인해 verify.json에 지정');
  } else if (platform === 'ios') {
    skipped.push('workspace/project/scheme/destination은 verify.json에 실제 xcodebuild 명령을 지정');
    if (exists(path.join(root, '.swiftlint.yml'))) commands.push({ name: 'lint', command: 'swiftlint lint --strict --quiet' });
  } else throw new Error('지원하지 않는 platform');
  return { commands, skipped };
}

function runCommand(command, cwd, timeout) {
  return new Promise(resolve => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', error;
    const stopTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        // 시간 초과 시 셸과 이 검증에서 시작한 자식 프로세스를 함께 종료한다.
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 이미 종료됨 */ }
      }
    };
    const timer = setTimeout(() => { error = new Error('검증 명령 시간 초과'); stopTree(); }, timeout);
    const append = (stream, chunk) => {
      if (stream === 'out') stdout += chunk.toString(); else stderr += chunk.toString();
      if (stdout.length + stderr.length > 10 * 1024 * 1024) {
        error = new Error('검증 출력 10MB 초과'); stopTree();
      }
    };
    child.stdout.on('data', chunk => append('out', chunk));
    child.stderr.on('data', chunk => append('err', chunk));
    child.on('error', cause => { error = cause; });
    child.on('close', status => { clearTimeout(timer); resolve({ status, stdout, stderr, error }); });
  });
}

async function verify(cwd = process.cwd()) {
  const root = git(cwd, ['rev-parse', '--show-toplevel']).trim();
  const config = JSON.parse(read(path.join(root, '.codex/harness/verify.json')));
  if (!['web', 'aos', 'ios'].includes(config.platform)) throw new Error('verify.json의 platform이 유효하지 않습니다.');
  if (!Array.isArray(config.commands)) throw new Error('commands는 배열이어야 합니다.');
  const timeout = config.timeoutMs ?? 210000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 240000) throw new Error('timeoutMs는 1~240000 정수여야 합니다.');
  // HEAD 없는 신규 저장소도 staged/untracked 파일을 검증한다.
  const head = spawnSync('git', ['-C', root, 'rev-parse', '--verify', 'HEAD'], { windowsHide: true });
  const diff = git(root, ['diff', '--name-only', '-z', ...(head.status === 0 ? ['HEAD'] : ['--cached'])]);
  const files = [...new Set((diff + git(root, ['diff', '--name-only', '-z']) + git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean))];
  const results = [];
  for (const file of files.filter(file => file.startsWith('.codex/harness/') && /\.(cjs|mjs|js)$/.test(file))) {
    if (!exists(path.join(root, file))) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8', windowsHide: true });
    results.push({ name: `syntax:${file}`, status: result.status === 0 ? 'PASS' : 'FAIL', output: (result.stderr || result.error?.message || '').slice(-12000) });
  }
  const appFiles = files.filter(file => !/^\.(codex|agents|claude)\//.test(file) && !/(^|\/)(node_modules|build|dist|\.gradle)\//.test(file));
  const relevant = appFiles.filter(file => config.platform === 'web' ? /\.(tsx?|jsx?|mjs|cjs|json|ya?ml)$/.test(file)
    : config.platform === 'aos' ? /\.(kt|kts|java|xml|toml|properties|gradle)$/.test(file)
    : /\.(swift|pbxproj|xcconfig|plist|yml|resolved)$/.test(file));
  if (!relevant.length && !config.commands.length) {
    return { root, status: results.some(item => item.status === 'FAIL') ? 'FAIL' : 'SKIP', results, skipped: ['앱 코드 변경 없음; 자동 앱 검사 미실행'] };
  }
  const detected = config.commands.length ? { commands: config.commands, skipped: [] } : detect(root, config.platform, relevant);
  for (const command of detected.commands) {
    if (!command || typeof command.name !== 'string' || !command.name || typeof command.command !== 'string' || !command.command.trim()) throw new Error('각 command는 name과 비어 있지 않은 command 문자열이 필요합니다.');
  }
  // 같은 저장소의 이 검증기 실행을 직렬화한다. 다른 세션 락을 삭제하지 않는다.
  const lock = path.join(os.tmpdir(), `codex-harness-${crypto.createHash('sha256').update(fs.realpathSync(root)).digest('hex')}.lock`);
  let acquired = false;
  try {
    try { fs.mkdirSync(lock); acquired = true; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return { root, status: 'SKIP', results, skipped: ['다른 검증 실행 중 또는 종료 후 락 잔재: 활성 세션 확인 후 재시도', lock] };
    }
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, root, startedAt: new Date().toISOString() }));
    const deadline = Date.now() + 240000;
    for (const command of detected.commands) {
      if (Date.now() >= deadline) { results.push({ name: command.name, status: 'SKIP', output: '전체 예산 240초 초과' }); continue; }
      const result = await runCommand(command.command, root, Math.min(timeout, deadline - Date.now()));
      const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
      const infrastructure = result.error || /401 Unauthorized|Could not resolve com\.itappandsy|SDK location not found|JAVA_HOME.*(not set|invalid)|command not found|not recognized as|xcode-select: error/i.test(output);
      results.push({ name: command.name, command: command.command, status: result.status === 0 && !result.error ? 'PASS' : infrastructure ? 'SKIP' : 'FAIL', output: (result.error?.message || output).slice(-12000) });
    }
  } finally {
    if (acquired) {
      const owner = path.join(lock, 'owner.json');
      if (exists(owner)) fs.unlinkSync(owner);
      fs.rmdirSync(lock);
    }
  }
  const hasBuild = detected.commands.some(command => /build|compile|type-?check|gradle|xcode/i.test(command.name));
  const skipped = [...detected.skipped];
  if (!hasBuild) skipped.push('컴파일/타입 검사 명령 미확인: verify.json에 name=build/compile/type-check로 지정');
  const status = results.some(item => item.status === 'FAIL') ? 'FAIL'
    : !hasBuild || results.some(item => item.status === 'SKIP') ? 'SKIP' : 'PASS';
  return { root, status, results, skipped };
}
if (require.main === module) {
  verify().then(report => {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'PASS' ? 0 : report.status === 'FAIL' ? 1 : 2;
  }).catch(error => {
    console.log(JSON.stringify({ status: 'SKIP', error: error.message }, null, 2));
    process.exitCode = 2;
  });
}
module.exports = { verify, detect, quote };
