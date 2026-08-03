#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { assertChangeSpecPath, generatedPreviewApp, pageSpecHash, readJson } from './lib/easy-account-page-spec.mjs';

const specArg = process.argv.find((arg) => arg.endsWith('page-spec.json'));
if (!specArg) {
  console.error('Usage: node scripts/build-easy-account-page-spec.mjs changes/{change-id}/page-spec.json');
  process.exit(2);
}
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
try {
  const root = process.cwd();
  const specPath = assertChangeSpecPath(root, specArg);
  const changeDir = dirname(specPath);
  const spec = readJson(specPath);
  if (spec.metadata.changeId !== basename(changeDir)) throw new Error('metadata.changeId must match the Change directory name.');
  if (!existsSync(resolve(changeDir, 'rules-read.md'))) throw new Error('rules-read.md is missing.');
  mkdirSync(resolve(changeDir, 'assets'), { recursive: true });
  const rendererRoot = resolve(root, 'modules/easy-account/execution/renderer');
  const shellRoot = resolve(root, 'modules/easy-account/shell');
  const fixedCopies = [
    [resolve(rendererRoot, 'page-spec-preview.template.html'), resolve(changeDir, 'preview.html')],
    [resolve(rendererRoot, 'page-spec-runtime.js'), resolve(changeDir, 'page-spec-runtime.js')],
    [resolve(rendererRoot, 'page-spec-business.css'), resolve(changeDir, 'business.css')],
    [resolve(shellRoot, 'shell.css'), resolve(changeDir, 'shell.css')],
    [resolve(shellRoot, 'content-base.css'), resolve(changeDir, 'content-base.css')],
    [resolve(shellRoot, 'shell-config.example.js'), resolve(changeDir, 'shell-config.example.js')],
    [resolve(shellRoot, 'shell-runtime.js'), resolve(changeDir, 'shell-runtime.js')]
  ];
  fixedCopies.forEach(([source, target]) => cpSync(source, target));
  cpSync(resolve(shellRoot, 'assets'), resolve(changeDir, 'assets'), { recursive: true });
  cpSync(resolve(shellRoot, 'vendor'), resolve(changeDir, 'vendor'), { recursive: true });
  const appPath = resolve(changeDir, 'preview-app.js');
  writeFileSync(appPath, generatedPreviewApp(spec));
  const policy = readJson(resolve(root, 'modules/easy-account/execution/generation-policy.json'));
  const generated = Object.fromEntries([
    ['preview.html', resolve(changeDir, 'preview.html')],
    ['page-spec-runtime.js', resolve(changeDir, 'page-spec-runtime.js')],
    ['business.css', resolve(changeDir, 'business.css')],
    ['preview-app.js', appPath]
  ].map(([name, file]) => [name, sha256(file)]));
  writeFileSync(resolve(changeDir, 'page-spec-build.json'), `${JSON.stringify({ schemaVersion: 1, system: 'easy-account', policyVersion: policy.policyVersion, rendererVersion: spec.ui.rendererVersion, pageSpecHash: pageSpecHash(spec), generated }, null, 2)}\n`);
  writeFileSync(resolve(changeDir, 'page-spec-checklist.md'), `# ${spec.metadata.pageName} Page Spec 预览\n\n- [x] 系统：Easy Account\n- [x] 页面族：${spec.metadata.family}\n- [x] 模板：${spec.metadata.templateId}\n- [x] 运行模式：shadow\n- [x] 易账通独立 Shell 与渲染器已生成\n`);
  console.log(`easy-account-page-spec-build: pass (${relative(root, specPath)})`);
  console.log(`- page spec: ${pageSpecHash(spec)}`);
  console.log(`- policy: ${policy.policyVersion}`);
  console.log('- editable source: page-spec.json');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
