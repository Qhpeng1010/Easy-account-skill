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

const composition = {
  schemaVersion: 2,
  metadata: {
    changeId: '20260826-director-composition-test',
    pageName: '账户汇总查询',
    ruleRefs: ['EA-TPL-001', 'EA-TPL-003', 'EA-TPL-004', 'EA-INT-002']
  },
  ui: { system: 'easy-account', runtime: 'easy-account-composition', rendererVersion: 1 },
  skeleton: 'query-workbench',
  recipeId: 'query-summary-table',
  regions: [
    { id: 'query', type: 'query', capabilities: ['query.basic'] },
    { id: 'summary', type: 'summary', capabilities: ['summary.metrics', 'summary.aggregate', 'binding.queryToSummary'] },
    { id: 'table', type: 'table', capabilities: ['table.flat', 'table.pagination'] }
  ],
  bindings: [{
    id: 'query-to-summary',
    from: { scope: 'query', path: 'filters' },
    to: { region: 'summary', path: 'metrics' },
    mode: 'filter',
    transform: 'aggregate'
  }],
  transitions: []
};
const compositionResult = validatePageComposition(composition, root);
assert.equal(compositionResult.valid, true, compositionResult.errors.join('\n'));
assert.equal(compositionResult.directorRules.thresholds.drawerMaxFields, director.runtimePolicy.thresholds.drawerMaxFields);

const legacy = {
  schemaVersion: 1,
  metadata: {
    changeId: '20260826-director-page-spec-test',
    pageName: '账户查询',
    family: 'list',
    templateId: 'list.account-query',
    ruleRefs: ['EA-TPL-001', 'EA-TPL-002', 'EA-INT-002'],
    assumptions: [],
    selectionReason: '普通账户查询列表'
  },
  ui: { system: 'easy-account', runtime: 'easy-account-page-spec', rendererVersion: 1 },
  shell: { primaryNav: '账户管理', sideNav: '账户查询' },
  content: { capabilities: ['query.basic', 'table.flat', 'table.pagination'] },
  list: {
    query: { fields: [{ key: 'accountNo', label: '账户号', control: 'input' }] },
    table: {
      rowKey: 'accountNo',
      columns: [{ key: 'accountNo', label: '账户号' }],
      rows: [],
      pagination: { pageSize: 20, total: 0 }
    }
  },
  states: { loading: true, empty: true, error: true, permissionDenied: true }
};
const legacyResult = validatePageSpec(legacy, root);
assert.equal(legacyResult.valid, true, legacyResult.errors.join('\n'));
assert.equal(legacyResult.directorRules.version, director.runtimePolicy.version);

console.log('easy-account-director-rules: pass');
