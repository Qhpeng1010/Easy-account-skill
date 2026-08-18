#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDirectorRules, resolveDetailPresentation, resolveFormPresentation } from './lib/easy-account-director-rules.mjs';
import { validatePageComposition } from './lib/easy-account-page-composition.mjs';
import { validatePageSpec } from './lib/easy-account-page-spec.mjs';

const root = process.cwd();
const director = readDirectorRules(root);
const interactionRules = readFileSync(resolve(root, 'modules/easy-account/director-rules/03-interaction-acceptance-rules.md'), 'utf8');
assert.equal(director.runtimePolicy.thresholds.modalMaxFields, 6);
assert.equal(director.runtimePolicy.thresholds.drawerMaxFields, 12);
assert.equal(resolveDetailPresentation(director.runtimePolicy), 'drawer');
assert.deepEqual([6, 7, 12, 13].map((count) => resolveFormPresentation(count, director.runtimePolicy)), ['modal', 'drawer', 'drawer', 'page']);
for (const id of ['EA-TPL-005', 'EA-TPL-007', 'EA-TPL-013', 'EA-INT-009']) assert.ok(director.runtimePolicy.ruleIds.includes(id), `missing ${id}`);
for (const phrase of ['Header 最右侧', '`24px` 内边距', '不得重复渲染 Header 已展示的 Drawer 标题', 'Footer 的“关闭”按钮右对齐', 'Footer 固定吸附在抽屉底部', '按钮之间固定使用 `8px` 间距']) {
  assert.ok(interactionRules.includes(phrase), `EA-INT-009 missing ${phrase}`);
}

const compositionPath = resolve(root, 'changes/20260818-merchant-bank-account/page-composition.json');
const composition = JSON.parse(readFileSync(compositionPath, 'utf8'));
const compositionResult = validatePageComposition(composition, root);
assert.equal(compositionResult.valid, true, compositionResult.errors.join('\n'));
assert.equal(compositionResult.directorRules.thresholds.drawerMaxFields, director.runtimePolicy.thresholds.drawerMaxFields);

const legacyPath = resolve(root, 'changes/20260813-企业单位管理/page-spec.json');
const legacy = JSON.parse(readFileSync(legacyPath, 'utf8'));
const legacyResult = validatePageSpec(legacy, root);
assert.equal(legacyResult.valid, true, legacyResult.errors.join('\n'));
assert.equal(legacyResult.directorRules.version, director.runtimePolicy.version);

console.log('easy-account-director-rules: pass');
