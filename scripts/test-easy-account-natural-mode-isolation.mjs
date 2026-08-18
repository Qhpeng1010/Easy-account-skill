#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dispatch } from './dispatch-easy-account-command.mjs';

const before = readdirSync('changes').sort();
const result = dispatch('生成易账通账户查询列表');
const after = readdirSync('changes').sort();

assert.equal(result.status, 'natural-generation');
assert.equal(result.explicitCommand, false);
assert.equal(result.workflow.behavior, 'existing-default');
assert.deepEqual(result.workflow.stages.map((stage) => stage.id), ['requirement', 'design', 'template', 'generate', 'review']);
assert.deepEqual(before, after, 'Natural mode must not create or update a Change during dispatch.');

const serialized = JSON.stringify(result.workflow);
for (const forbidden of [
  'mode-workflows.md',
  'prd-standard.md',
  'prepare-easy-account-mode.mjs',
  'finalize-easy-account-mode.mjs',
  'mode-state.json'
]) {
  assert.equal(serialized.includes(forbidden), false, `Natural mode leaked explicit-mode resource: ${forbidden}`);
}

const composition = dispatch('生成易账通查询列表进入分账步骤页，提交后进入分账结果页');
assert.equal(composition.status, 'natural-generation');
assert.equal(composition.workflow.strategy.strategy, 'composition');
assert.equal(composition.workflow.editableSource, 'page-composition.json');
assert.match(composition.workflow.stages.find((stage) => stage.id === 'generate').scaffoldCommand, /scaffold-easy-account-page-composition/);

console.log('easy-account-natural-mode-isolation: pass');
