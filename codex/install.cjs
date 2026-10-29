#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const read = file => fs.readFileSync(file, 'utf8');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
function parseArgs(args) {
  const options = { platform: args[0], kind: 'app', dryRun: false, newProject: false };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--new-project') options.newProject = true;
    else if (arg === '--project' || arg === '--kind') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} 값이 필요합니다.`);
      options[arg === '--project' ? 'project' : 'kind'] = args[++i];
    } else throw new Error(`알 수 없는 옵션: ${arg}`);
  }
  if (!['web', 'ios', 'aos'].includes(options.platform) || !options.project || !['app', 'library'].includes(options.kind)) {
    throw new Error('사용법: node codex/install.cjs <web|ios|aos> --project <경로> [--kind app|library] [--new-project] [--dry-run]');
  }
  if (options.newProject && (options.platform !== 'aos' || options.kind !== 'app')) {
    throw new Error('--new-project는 신규 AOS 앱의 아키텍처 가이드 씨딩에만 사용합니다.');
  }
  return options;
}

function install(options) {
  const root = fs.realpathSync(path.resolve(options.project));
  if (!fs.statSync(root).isDirectory()) throw new Error('설치 대상은 기존 프로젝트 디렉토리여야 합니다.');
  // 빌드/의존성/사용자 설정은 건드리지 않고 프로젝트의 하네스 자산만 설치한다.
  const plan = new Map();
  const platformDir = path.join(__dirname, 'platforms', options.platform);
  const common = read(path.join(__dirname, 'common', 'AGENTS.md'));
  const platform = read(path.join(platformDir, 'AGENTS.md'));
  const block = common.replace('<!-- codex-harness:end -->', `${platform.trim()}\n<!-- codex-harness:end -->`);
  const agentsPath = path.join(root, 'AGENTS.md');
  const existing = fs.existsSync(agentsPath) ? read(agentsPath) : '';
  const start = '<!-- codex-harness:start -->';
  const end = '<!-- codex-harness:end -->';
  const startAt = existing.indexOf(start), endAt = existing.indexOf(end);
  if ((startAt < 0) !== (endAt < 0) || (startAt >= 0 && endAt < startAt) ||
      (startAt >= 0 && (existing.indexOf(start, startAt + start.length) >= 0 || existing.indexOf(end, endAt + end.length) >= 0))) {
    throw new Error('AGENTS.md의 하네스 관리 구간이 손상됐습니다. 자동 변경하지 않습니다.');
  }
  plan.set('AGENTS.md', startAt >= 0
    ? existing.slice(0, startAt) + block.trimEnd() + existing.slice(endAt + end.length)
    : existing + (existing && !existing.endsWith('\n') ? '\n' : '') + (existing ? '\n' : '') + block);

  const appSkills = ['feature', 'design', 'logic', 'connect-api', 'implement-feature'];
  const skills = ['init', 'maintain', 'review-loop', ...(options.kind === 'app' ? appSkills : ['component', 'publish'])];
  for (const skill of skills) {
    const relative = `.agents/skills/harness-${skill}/SKILL.md`;
    plan.set(relative, read(path.join(__dirname, 'skills', `harness-${skill}`, 'SKILL.md')));
  }
  for (const file of walk(path.join(platformDir, 'references'))) {
    const relative = path.relative(path.join(platformDir, 'references'), file).replaceAll('\\', '/');
    plan.set(`.codex/harness/references/${relative}`, read(file));
  }
  if (options.kind === 'library') {
    plan.set('.codex/harness/references/code-reviewer.md', read(path.join(platformDir, 'references', 'library-reviewer.md')));
  }
  plan.set('.codex/harness/verify.cjs', read(path.join(__dirname, 'scripts', 'verify.cjs')));
  const configPath = path.join(root, '.codex/harness/verify.json');
  if (!fs.existsSync(configPath)) {
    plan.set('.codex/harness/verify.json', JSON.stringify({
      platform: options.platform,
      timeoutMs: 210000,
      commands: [],
      _doc: 'commands에 실제 빌드·린트·테스트 명령을 등록하세요. 비어 있으면 안전한 범위에서 자동 감지합니다. 예: {"name":"compile","command":".\\\\gradlew.bat :app:compileDebugKotlin"}. shell 명령이므로 신뢰하는 프로젝트 설정만 사용합니다. 배포 명령·시크릿 금지.'
    }, null, 2) + '\n');
  } else {
    const config = JSON.parse(read(configPath));
    if (config.platform !== options.platform) throw new Error('기존 verify.json의 platform이 다릅니다. 설정을 먼저 확인하세요.');
  }
  if (options.newProject) {
    for (const name of ['UDF_ARCHITECTURE_GUIDE.md', 'DATA_LAYER_GUIDE.md']) {
      if (!fs.existsSync(path.join(root, name))) plan.set(name, read(path.join(platformDir, 'references', name)));
    }
  }
  const ignorePath = path.join(root, '.gitignore');
  const ignore = fs.existsSync(ignorePath) ? read(ignorePath) : '';
  const backupPatterns = ['/AGENTS.md.bak-*', '/.gitignore.bak-*', '/.codex/harness/**/*.bak-*', '/.agents/skills/harness-*/SKILL.md.bak-*'];
  const missingPatterns = backupPatterns.filter(pattern => !ignore.split(/\r?\n/).includes(pattern));
  if (missingPatterns.length) plan.set('.gitignore', ignore + (ignore && !ignore.endsWith('\n') ? '\n' : '') + '\n# Codex harness local backups\n' + missingPatterns.join('\n') + '\n');

  const manifestPath = path.join(root, '.codex/harness/manifest.json');
  const oldManifest = fs.existsSync(manifestPath) ? JSON.parse(read(manifestPath)) : null;
  if (oldManifest && (oldManifest.platform !== options.platform || oldManifest.kind !== options.kind)) {
    throw new Error('이미 다른 platform/kind가 설치돼 있습니다. 혼합 설치 대신 별도 프로젝트를 사용하세요.');
  }
  const hash = content => crypto.createHash('sha256').update(content).digest('hex');
  const managed = {};
  // AGENTS의 관리 구간 밖과 사용자 검증 명령은 업데이트에서 보존한다.
  for (const [relative, content] of plan) {
    if (relative !== 'AGENTS.md' && relative !== '.gitignore' && !relative.endsWith('/verify.json') && relative.startsWith('.')) managed[relative] = hash(content);
  }
  plan.set('.codex/harness/manifest.json', JSON.stringify({ version: 1, platform: options.platform, kind: options.kind, managed }, null, 2) + '\n');
  const changed = [...plan].filter(([relative, content]) => {
    const destination = path.join(root, relative);
    return !fs.existsSync(destination) || read(destination) !== content;
  });
  // 쓰기 전에 모든 경로·충돌을 확인해 실패 시 부분 설치를 피한다.
  for (const [relative] of plan) {
    const destination = path.join(root, relative);
    let cursor = destination;
    while (cursor !== root) {
      if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`심볼릭 링크 대상에는 쓰지 않습니다: ${relative}`);
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new Error('프로젝트 밖의 설치 경로입니다.');
      cursor = parent;
    }
  }
  for (const [relative] of changed) {
    if (relative === 'AGENTS.md' || relative === '.gitignore' || relative.endsWith('/verify.json') || relative.endsWith('/manifest.json')) continue;
    const destination = path.join(root, relative);
    if (fs.existsSync(destination) && oldManifest?.managed?.[relative] !== hash(read(destination))) {
      throw new Error(`사용자가 변경했거나 관리하지 않는 파일과 충돌합니다: ${relative} (아무 파일도 쓰지 않음)`);
    }
  }
  if (!options.dryRun) {
    for (const [relative, content] of changed) {
      const destination = path.join(root, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (fs.existsSync(destination)) {
        const backup = `${destination}.bak-${crypto.randomUUID()}`;
        fs.copyFileSync(destination, backup, fs.constants.COPYFILE_EXCL);
      }
      fs.writeFileSync(destination, content);
    }
  }
  console.log(JSON.stringify({ dryRun: options.dryRun, project: root, platform: options.platform, kind: options.kind, changed: changed.map(([relative]) => relative) }, null, 2));
  return changed.map(([relative]) => relative);
}
if (require.main === module) {
  try { install(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { install, parseArgs };
