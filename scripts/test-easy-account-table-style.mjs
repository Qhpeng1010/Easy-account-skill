#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temp = mkdtempSync(resolve(root, 'changes/.table-style-test-'));

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function assertTableStyle(changeDir, runtimeFile) {
  const css = readFileSync(join(changeDir, 'business.css'), 'utf8');
  const runtime = readFileSync(join(changeDir, runtimeFile), 'utf8');
  const preview = readFileSync(join(changeDir, 'preview.html'), 'utf8');

  assert.match(css, /--ea-table-border:\s*#e4e4e7;/);
  assert.match(css, /--ea-table-header:\s*#f5f4f5;/);
  assert.match(css, /--ea-table-header-text:\s*#606266;/);
  assert.match(css, /\.ant-table-container\s*\{[^}]*border:\s*1px solid var\(--ea-table-border\)/s);
  assert.match(css, /\.ant-table-wrapper\s+\.ant-table-thead\s*>\s*tr\s*>\s*th\.ant-table-cell\s*\{[^}]*height:\s*42px[^}]*padding:\s*10px 16px !important[^}]*background:\s*var\(--ea-table-header\)[^}]*color:\s*var\(--ea-table-header-text\)/s);
  assert.match(css, /\.ant-table-wrapper\s+\.ant-table-cell\s*\{[^}]*padding:\s*10px 16px !important/s);
  assert.match(runtime, /size:\s*'middle'/);
  assert.match(runtime, /cellPaddingBlockMD:\s*10/);
  assert.match(runtime, /cellPaddingInlineMD:\s*16/);
  assert.match(runtime, /token:\s*\{\s*colorPrimary:\s*'#1E75FF',\s*borderRadius:\s*6\s*\}/s);
  assert.match(runtime, /Button:\s*\{\s*borderRadius:\s*6\s*\}/s);
  assert.match(runtime, /function amountColumnTitle\(column\)/);
  assert.match(runtime, /align:\s*(?:column\.format === 'amount'|isAmount)\s*\?\s*'right'\s*:\s*undefined/);
  assert.match(runtime, /className:\s*(?:column\.format === 'amount'|isAmount)\s*\?\s*'ea-amount-column'\s*:\s*undefined/);
  assert.match(runtime, /column\.mixedCurrency === true/);
  assert.match(css, /\.ea-amount-column\s*\{[^}]*text-align:\s*right[^}]*font-variant-numeric:\s*tabular-nums/s);
  assert.match(preview, /business\.css\?v=[a-f0-9]{12}/);
  assert.equal(preview.includes('__EA_ASSET_VERSION__'), false);
}

try {
  const pageSpecDir = join(temp, '20260826-table-style-page-spec');
  run('scripts/scaffold-easy-account-page-spec.mjs', [pageSpecDir]);
  run('scripts/build-easy-account-page-spec.mjs', [join(pageSpecDir, 'page-spec.json')]);
  assertTableStyle(pageSpecDir, 'page-spec-runtime.js');

  const compositionDir = join(temp, '20260826-table-style-composition');
  run('scripts/scaffold-easy-account-page-composition.mjs', [compositionDir]);
  run('scripts/build-easy-account-page-composition.mjs', [join(compositionDir, 'page-composition.json')]);
  assertTableStyle(compositionDir, 'page-composition-runtime.js');

  const visualRules = readFileSync(resolve(root, 'modules/easy-account/director-rules/01-visual-constitution.md'), 'utf8');
  for (const requirement of ['size="middle"', '10px 16px', '42px', '1px solid #E4E4E7', '#F5F4F5', '#606266', '已分账金额(元)', '整体右对齐', '英文半角括号']) {
    assert.ok(visualRules.includes(requirement), `EA-VIS-008 missing ${requirement}`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('easy-account-table-style: pass');
