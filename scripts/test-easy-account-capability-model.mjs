#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const modelRoot = resolve(root, 'modules/easy-account/execution/capability-model');
const readJson = (name) => JSON.parse(readFileSync(resolve(modelRoot, name), 'utf8'));
const registry = readJson('capability-registry.json');
const rules = readJson('composition-rules.json');
const compositionSchema = readJson('page-composition.schema.json');
const bindingSchema = readJson('data-binding.schema.json');

assert.equal(registry.system, 'easy-account');
assert.equal(rules.system, 'easy-account');
assert.equal(compositionSchema.properties.schemaVersion.const, 2);
assert.equal(bindingSchema.properties.mode.enum.includes('result'), true);

const skeletons = new Map(registry.skeletons.map((item) => [item.id, item]));
const regions = new Map(registry.regions.map((item) => [item.id, item]));
const capabilities = new Map(registry.capabilities.map((item) => [item.id, item]));
assert.equal(skeletons.size, registry.skeletons.length, 'skeleton ids must be unique');
assert.equal(regions.size, registry.regions.length, 'region ids must be unique');
assert.equal(capabilities.size, registry.capabilities.length, 'capability ids must be unique');

for (const region of registry.regions) {
  for (const capability of region.capabilities) {
    assert.equal(capabilities.has(capability), true, `region ${region.id} references unknown capability ${capability}`);
  }
}

for (const capability of registry.capabilities) {
  const region = regions.get(capability.region);
  assert.ok(region, `capability ${capability.id} belongs to unknown region ${capability.region}`);
  assert.equal(region.capabilities.includes(capability.id), true, `region ${capability.region} must register capability ${capability.id}`);
}

for (const rule of rules.skeletonRules) {
  assert.equal(skeletons.has(rule.skeleton), true, `unknown skeleton ${rule.skeleton}`);
  for (const region of [...rule.allowedRegions, ...rule.requiredRegions, ...rule.order]) {
    assert.equal(regions.has(region), true, `skeleton ${rule.skeleton} references unknown region ${region}`);
  }
  for (const required of skeletons.get(rule.skeleton).requiredRegions) {
    assert.equal(rule.requiredRegions.includes(required), true, `${rule.skeleton} must require ${required}`);
  }
}

for (const recipe of rules.recipes) {
  for (const skeleton of recipe.skeletons || [recipe.skeleton]) {
    assert.equal(skeletons.has(skeleton), true, `recipe ${recipe.id} references unknown skeleton ${skeleton}`);
  }
  for (const region of recipe.regions) assert.equal(regions.has(region), true, `recipe ${recipe.id} references unknown region ${region}`);
  for (const capability of recipe.capabilities) assert.equal(capabilities.has(capability), true, `recipe ${recipe.id} references unknown capability ${capability}`);
}

for (const transition of rules.transitions) {
  for (const capability of transition.requires || []) assert.equal(capabilities.has(capability), true, `transition ${transition.id} references unknown capability ${capability}`);
}

const querySummary = rules.recipes.find((recipe) => recipe.id === 'query-summary-table');
assert.deepEqual(querySummary.regions, ['query', 'summary', 'table']);
assert.equal(querySummary.capabilities.includes('summary.metrics'), true);
assert.equal(capabilities.get('summary.manage')?.region, 'summary');
const submissionResult = rules.recipes.find((recipe) => recipe.id === 'submission-review-result');
assert.equal(submissionResult.capabilities.includes('binding.submissionToResult'), true);

console.log('easy-account-capability-model: pass');
