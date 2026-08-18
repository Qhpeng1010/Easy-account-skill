#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { validatePageComposition } from './lib/easy-account-page-composition.mjs';

const root = process.cwd();
const base = {
  schemaVersion: 2,
  metadata: {
    changeId: '20260818-composition-test',
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
  bindings: [
    {
      id: 'query-to-summary',
      from: { scope: 'query', path: 'filters' },
      to: { region: 'summary', path: 'metrics' },
      mode: 'filter',
      transform: 'aggregate'
    }
  ],
  transitions: []
};

const valid = validatePageComposition(base, root);
assert.equal(valid.valid, true);
assert.equal(valid.readiness, 'preview-ready');
assert.equal(valid.errors.length, 0);
assert.deepEqual(valid.unsupportedRuntime, []);

const workflow = structuredClone(base);
workflow.metadata.pageId = 'account-list';
workflow.workflow = {
  pages: [{
    id: 'merchant-submit',
    label: '商户信息提交',
    skeleton: 'form-workflow',
    regions: [{ id: 'step-form', type: 'step-form', capabilities: ['form.steps', 'form.validation', 'binding.rowToForm'], config: { steps: [] } }],
    bindings: [],
    transitions: []
  }]
};
workflow.regions = [...base.regions, { id: 'action', type: 'action', capabilities: ['navigation.openTab'] }];
workflow.bindings = [{ id: 'row-to-form', from: { scope: 'row', path: 'merchantId' }, to: { pageId: 'merchant-submit', region: 'step-form', path: 'merchantId' }, mode: 'context' }];
workflow.transitions = [{ id: 'open-submit', event: 'openTab', to: 'merchant-submit', requires: ['navigation.openTab'], bindingIds: ['row-to-form'] }];
const workflowResult = validatePageComposition(workflow, root);
assert.equal(workflowResult.valid, true);
assert.equal(workflowResult.readiness, 'preview-ready');

const wrongOrder = structuredClone(base);
wrongOrder.regions = [base.regions[0], base.regions[2], base.regions[1]];
const wrongOrderResult = validatePageComposition(wrongOrder, root);
assert.equal(wrongOrderResult.valid, false);
assert.match(wrongOrderResult.errors.join('\n'), /region order/);

const wrongCapability = structuredClone(base);
wrongCapability.regions[2].capabilities.push('summary.metrics');
const wrongCapabilityResult = validatePageComposition(wrongCapability, root);
assert.equal(wrongCapabilityResult.valid, false);
assert.match(wrongCapabilityResult.errors.join('\n'), /belongs to summary/);

const unknownProperty = structuredClone(base);
unknownProperty.regions[0].unsafeRendererOverride = true;
const unknownPropertyResult = validatePageComposition(unknownProperty, root);
assert.equal(unknownPropertyResult.valid, false);
assert.match(unknownPropertyResult.errors.join('\n'), /unsupported properties/);

const missingBindingCapability = structuredClone(base);
missingBindingCapability.regions[1].capabilities = ['summary.metrics', 'summary.aggregate'];
const missingBindingResult = validatePageComposition(missingBindingCapability, root);
assert.equal(missingBindingResult.valid, false);
assert.match(missingBindingResult.errors.join('\n'), /binding.queryToSummary/);

const temp = mkdtempSync(join(tmpdir(), 'easy-account-composition-'));
try {
  const changeDir = join(temp, '20260818-composition-test');
  const scaffold = spawnSync(process.execPath, ['scripts/scaffold-easy-account-page-composition.mjs', changeDir], { cwd: root, encoding: 'utf8' });
  assert.equal(scaffold.status, 0, scaffold.stderr);
  const validation = spawnSync(process.execPath, ['scripts/validate-easy-account-page-composition.mjs', join(changeDir, 'page-composition.json'), '--write'], { cwd: root, encoding: 'utf8' });
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(existsSync(join(changeDir, 'composition-validation.json')), true);
  const output = JSON.parse(readFileSync(join(changeDir, 'composition-validation.json'), 'utf8'));
  assert.equal(output.valid, true);
  assert.equal(output.readiness, 'preview-ready');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('easy-account-page-composition: pass');
