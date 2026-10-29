const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { install, parseArgs } = require('../install.cjs');
const { detect } = require('../scripts/verify.cjs');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-harness-test-'));
let sequence = 0;
function project() {
  const root = path.join(temporaryRoot, `project ${++sequence}`);
  fs.mkdirSync(root);
  const result = spawnSync('git', ['init', root], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return root;
}
function write(root, file, text) {
  const destination = path.join(root, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, text);
}
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
function installQuiet(options) {
  const previous = console.log;
  console.log = () => {};
  try { return install(options); } finally { console.log = previous; }
}
function runVerify(root) {
  const result = spawnSync(process.execPath, [path.join(root, '.codex/harness/verify.cjs')], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.error, undefined);
  return { code: result.status, report: JSON.parse(result.stdout) };
}
function configure(root, commands, extra = {}) {
  write(root, '.codex/harness/verify.json', JSON.stringify({ platform: 'web', commands, ...extra }));
}
const command = (name, code) => ({ name, command: `node -e "${code}"` });

test('argument parsing refuses unsupported flags and ambiguous values', () => {
  assert.equal(parseArgs(['aos', '--project', 'sample']).kind, 'app');
  assert.throws(() => parseArgs(['aos', '--project', '--dry-run']));
  assert.throws(() => parseArgs(['web', '--project', 'sample', '--new-project']));
  assert.throws(() => parseArgs(['aos', '--project', 'sample', '--force']));
});

for (const platform of ['aos', 'ios', 'web']) {
  for (const kind of ['app', 'library']) {
    test(`${platform}/${kind}: dry-run, install, skill routing, and idempotence`, () => {
      const root = project();
      const options = { platform, kind, project: root, newProject: platform === 'aos' && kind === 'app' };
      const plan = installQuiet({ ...options, dryRun: true });
      assert.ok(plan.includes('AGENTS.md'));
      assert.ok(!fs.existsSync(path.join(root, 'AGENTS.md')));
      installQuiet(options);
      const skills = fs.readdirSync(path.join(root, '.agents/skills'));
      assert.ok(skills.includes('harness-init'));
      assert.equal(skills.includes('harness-component'), kind === 'library');
      assert.equal(skills.includes('harness-design'), kind === 'app');
      assert.equal(fs.existsSync(path.join(root, 'DATA_LAYER_GUIDE.md')), Boolean(options.newProject));
      assert.ok(!fs.existsSync(path.join(root, '.claude')));
      assert.equal(installQuiet(options).length, 0);
    });
  }
}

test('existing project rules, architecture guides, and verification config survive updates', () => {
  const root = project();
  write(root, 'AGENTS.md', '# User rules\nKeep this.\n');
  write(root, '.gitignore', 'user-ignore/\n');
  write(root, 'UDF_ARCHITECTURE_GUIDE.md', 'custom guide');
  const options = { platform: 'aos', kind: 'app', project: root, newProject: true };
  installQuiet(options);
  const agents = read(root, 'AGENTS.md');
  write(root, 'AGENTS.md', agents + '\nAnother rule.\n');
  const config = JSON.parse(read(root, '.codex/harness/verify.json'));
  config.commands.push(command('compile', 'process.exit(0)'));
  write(root, '.codex/harness/verify.json', JSON.stringify(config));
  installQuiet(options);
  assert.ok(read(root, 'AGENTS.md').startsWith('# User rules\nKeep this.'));
  assert.ok(read(root, 'AGENTS.md').endsWith('Another rule.\n'));
  assert.equal(read(root, 'UDF_ARCHITECTURE_GUIDE.md'), 'custom guide');
  assert.equal(JSON.parse(read(root, '.codex/harness/verify.json')).commands.length, 1);
  assert.ok(read(root, '.gitignore').startsWith('user-ignore/\n'));
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', 'AGENTS.md.bak-example'], { encoding: 'utf8', windowsHide: true });
  assert.equal(ignored.status, 0);
});

test('local managed-file edits reject the entire update before any writes', () => {
  const root = project();
  const options = { platform: 'web', kind: 'app', project: root };
  installQuiet(options);
  const target = '.agents/skills/harness-design/SKILL.md';
  write(root, target, 'user replacement');
  const before = read(root, '.codex/harness/manifest.json');
  assert.throws(() => installQuiet(options), /충돌/);
  assert.equal(read(root, target), 'user replacement');
  assert.equal(read(root, '.codex/harness/manifest.json'), before);
});

test('mixed platform or kind and malformed AGENTS markers are refused', () => {
  const root = project();
  installQuiet({ platform: 'aos', kind: 'app', project: root });
  assert.throws(() => installQuiet({ platform: 'web', kind: 'app', project: root }));
  assert.throws(() => installQuiet({ platform: 'aos', kind: 'library', project: root }));
  write(root, 'AGENTS.md', '<!-- codex-harness:start -->');
  assert.throws(() => installQuiet({ platform: 'aos', kind: 'app', project: root }), /손상/);
});

test('installer refuses symlink/junction installation targets', () => {
  const root = project(), outside = project();
  fs.symlinkSync(outside, path.join(root, '.agents'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => installQuiet({ platform: 'web', kind: 'app', project: root }), /링크/);
  assert.ok(!fs.existsSync(path.join(outside, 'skills')));
  assert.ok(!fs.existsSync(path.join(root, 'AGENTS.md')));
});

test('verify returns real PASS, FAIL and environment SKIP with exit codes', () => {
  const root = project();
  installQuiet({ platform: 'web', kind: 'app', project: root });
  configure(root, [command('compile', 'process.exit(0)')]);
  assert.equal(runVerify(root).code, 0);
  configure(root, [command('compile', 'process.exit(1)')]);
  const fail = runVerify(root);
  assert.equal(fail.code, 1);
  assert.equal(fail.report.status, 'FAIL');
  configure(root, [command('compile', "console.error('401 Unauthorized');process.exit(1)")]);
  const skip = runVerify(root);
  assert.equal(skip.code, 2);
  assert.equal(skip.report.results.at(-1).status, 'SKIP');
});

test('a successful lint without a compiler is not reported as full PASS', () => {
  const root = project();
  installQuiet({ platform: 'web', kind: 'app', project: root });
  configure(root, [command('lint', 'process.exit(0)')]);
  assert.equal(runVerify(root).code, 2);
});

test('empty changes, missing dependencies, and invalid config do not become PASS', () => {
  const root = project();
  installQuiet({ platform: 'web', kind: 'app', project: root });
  assert.equal(runVerify(root).code, 2);
  write(root, 'package.json', JSON.stringify({ scripts: { 'type-check': 'node -e "process.exit(0)"' } }));
  assert.equal(runVerify(root).code, 2);
  configure(root, [], { timeoutMs: -1 });
  assert.equal(runVerify(root).code, 2);
});

test('verification timeouts are SKIP and a subsequent run can acquire the lock', () => {
  const root = project();
  installQuiet({ platform: 'web', kind: 'app', project: root });
  configure(root, [command('compile', 'while(true){}')], { timeoutMs: 150 });
  assert.equal(runVerify(root).code, 2);
  configure(root, [command('compile', 'process.exit(0)')]);
  assert.equal(runVerify(root).code, 0);
});

test('web detects local tooling and uses lockfile package manager without downloads', () => {
  const root = project();
  write(root, 'package.json', JSON.stringify({ scripts: { typecheck: 'tsc --noEmit', lint: 'eslint .' }, devDependencies: { vitest: '1' } }));
  write(root, 'pnpm-lock.yaml', 'lockfileVersion: 9');
  write(root, 'node_modules/vitest/vitest.mjs', '');
  const result = detect(root, 'web', ['src/app.ts']);
  assert.equal(result.commands[0].command, 'pnpm run typecheck');
  assert.ok(result.commands.some(item => item.command.includes('vitest.mjs')));
  assert.ok(result.commands.every(item => !item.command.includes('npx')));
});

test('Gradle detection respects changed standard modules and rejects custom mappings', () => {
  const root = project();
  write(root, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew', '');
  write(root, 'settings.gradle.kts', 'include(":app", ":shared")');
  write(root, 'app/build.gradle.kts', 'plugins { id("com.android.application"); id("org.jlleitschuh.gradle.ktlint") }');
  write(root, 'shared/build.gradle.kts', 'plugins { id("com.android.library") }');
  const result = detect(root, 'aos', ['app/src/Foo.kt']);
  assert.ok(result.commands[0].command.includes(':app:compileDebugKotlin'));
  assert.ok(!result.commands[0].command.includes(':shared:compile'));
  write(root, 'settings.gradle.kts', 'include(":app"); project(":app").projectDir = file("custom")');
  assert.equal(detect(root, 'aos', ['app/src/Foo.kt']).commands.length, 0);
});

test('unused catalog lint plugins are not executed and applied aliases are resolved', () => {
  const root = project();
  write(root, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew', '');
  write(root, 'settings.gradle.kts', 'include(":app")');
  write(root, 'gradle/libs.versions.toml', '[plugins]\nktlint = { id = "org.jlleitschuh.gradle.ktlint", version = "1" }\n');
  write(root, 'app/build.gradle.kts', 'plugins { id("com.android.application") }');
  assert.ok(!detect(root, 'aos', ['app/Foo.kt']).commands[0].command.includes('ktlintCheck'));
  write(root, 'app/build.gradle.kts', 'plugins { id("com.android.application"); alias(libs.plugins.ktlint) }');
  assert.ok(detect(root, 'aos', ['app/Foo.kt']).commands[0].command.includes('ktlintCheck'));
});

test('installed web auto-detection runs scripts and local test runner in paths with spaces', () => {
  const root = project();
  installQuiet({ platform: 'web', kind: 'app', project: root });
  write(root, 'package.json', JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', lint: 'node -e "process.exit(0)"' }, devDependencies: { vitest: '1' } }));
  write(root, 'node_modules/vitest/vitest.mjs', 'process.exit(0);');
  const result = runVerify(root);
  assert.equal(result.code, 0, JSON.stringify(result.report));
  assert.ok(result.report.results.some(item => item.name === 'test' && item.status === 'PASS'));
});

test.after(() => {
  // 테스트가 만든 고유 임시 디렉토리만 정리한다. junction은 재귀 순회하지 않는다.
  const resolved = fs.realpathSync(temporaryRoot);
  assert.ok(path.basename(resolved).startsWith('codex-harness-test-'));
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
