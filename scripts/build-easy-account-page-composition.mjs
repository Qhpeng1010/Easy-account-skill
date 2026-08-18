#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { generatedCompositionPreviewApp, validateCompositionFile } from './lib/easy-account-page-composition.mjs';
import { readDirectorRules } from './lib/easy-account-director-rules.mjs';

const sourceArg = process.argv.find((arg) => arg.endsWith('page-composition.json'));
if (!sourceArg) {
  console.error('Usage: node scripts/build-easy-account-page-composition.mjs changes/{change-id}/page-composition.json');
  process.exit(2);
}

function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }

try {
  const root = process.cwd();
  const sourcePath = resolve(root, sourceArg);
  const changeDir = dirname(sourcePath);
  const result = validateCompositionFile(sourcePath, root);
  if (!result.valid) throw new Error(`Composition validation failed: ${result.errors.join(' ')}`);
  if (result.readiness !== 'preview-ready') throw new Error(`Composition is ${result.readiness}; renderer capabilities are not fully open.`);
  const spec = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const directorPolicy = readDirectorRules(root).runtimePolicy;
  const runtimeSpec = { ...spec, directorPolicy };
  if (spec.metadata.changeId !== basename(changeDir)) throw new Error('metadata.changeId must match the Change directory name.');
  if (!existsSync(resolve(changeDir, 'rules-read.md'))) throw new Error('rules-read.md is missing.');
  mkdirSync(resolve(changeDir, 'assets'), { recursive: true });
  const rendererRoot = resolve(root, 'modules/easy-account/execution/renderer');
  const shellRoot = resolve(root, 'modules/easy-account/shell');
  const fixedCopies = [
    [resolve(rendererRoot, 'page-composition-preview.template.html'), resolve(changeDir, 'preview.html')],
    [resolve(rendererRoot, 'page-composition-runtime.js'), resolve(changeDir, 'page-composition-runtime.js')],
    [resolve(rendererRoot, 'page-composition-business.css'), resolve(changeDir, 'business.css')],
    [resolve(shellRoot, 'shell.css'), resolve(changeDir, 'shell.css')],
    [resolve(shellRoot, 'content-base.css'), resolve(changeDir, 'content-base.css')],
    [resolve(shellRoot, 'shell-config.example.js'), resolve(changeDir, 'shell-config.example.js')],
    [resolve(shellRoot, 'shell-runtime.js'), resolve(changeDir, 'shell-runtime.js')]
  ];
  fixedCopies.forEach(([source, target]) => cpSync(source, target));
  cpSync(resolve(shellRoot, 'assets'), resolve(changeDir, 'assets'), { recursive: true });
  cpSync(resolve(shellRoot, 'vendor'), resolve(changeDir, 'vendor'), { recursive: true });
  const appPath = resolve(changeDir, 'preview-app.js');
  writeFileSync(appPath, generatedCompositionPreviewApp(runtimeSpec));
  const generated = Object.fromEntries([
    ['preview.html', resolve(changeDir, 'preview.html')],
    ['page-composition-runtime.js', resolve(changeDir, 'page-composition-runtime.js')],
    ['business.css', resolve(changeDir, 'business.css')],
    ['preview-app.js', appPath]
  ].map(([name, file]) => [name, sha256(file)]));
  writeFileSync(resolve(changeDir, 'composition-build.json'), `${JSON.stringify({ schemaVersion: 1, system: 'easy-account', modelVersion: result.modelVersion || 'unknown', directorRulesVersion: directorPolicy.version, readiness: result.readiness, generated }, null, 2)}\n`);
  writeFileSync(resolve(changeDir, 'composition-checklist.md'), `# ${spec.metadata.pageName} 组合页面预览\n\n- [x] 骨架、区域与能力组合校验通过\n- [x] 数据绑定与页面转场校验通过\n- [x] Easy Account Shell 与组合式运行时已生成\n`);
  console.log(`easy-account-page-composition-build: pass (${relative(root, sourcePath)})`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
