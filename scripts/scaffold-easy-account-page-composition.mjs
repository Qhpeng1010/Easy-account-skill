#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const changeDir = process.argv[2];
if (!changeDir) {
  console.error('Usage: node scripts/scaffold-easy-account-page-composition.mjs changes/{change-id}');
  process.exit(2);
}

const root = process.cwd();
const target = resolve(root, changeDir);
const changeId = basename(target);
const source = {
  schemaVersion: 2,
  metadata: {
    changeId,
    pageName: '易账通组合页面',
    request: '',
    ruleRefs: ['EA-TPL-001', 'EA-TPL-003', 'EA-TPL-004', 'EA-INT-002'],
    assumptions: []
  },
  ui: { system: 'easy-account', runtime: 'easy-account-composition', rendererVersion: 1 },
  skeleton: 'query-workbench',
  regions: [
    { id: 'query', type: 'query', capabilities: ['query.basic'], config: { fields: [] } },
    { id: 'table', type: 'table', capabilities: ['table.flat', 'table.pagination'], config: { columns: [] } }
  ],
  bindings: [],
  transitions: [],
  states: { loading: true, empty: true, error: true, permissionDenied: true }
};

mkdirSync(target, { recursive: true });
writeFileSync(resolve(target, 'page-composition.json'), `${JSON.stringify(source, null, 2)}\n`);
if (!existsSync(resolve(target, 'rules-read.md'))) {
  writeFileSync(resolve(target, 'rules-read.md'), `# Rules Read\n\n- modules/easy-account/DOMAIN.md\n- modules/easy-account/business-rules.md\n- modules/easy-account/director-rules/01-visual-constitution.md\n- modules/easy-account/director-rules/02-template-application-rules.md\n- modules/easy-account/director-rules/03-interaction-acceptance-rules.md\n- modules/easy-account/execution/context-packs/core.md\n- modules/easy-account/execution/capability-model/capability-model.md\n- modules/easy-account/execution/capability-model/capability-registry.json\n- modules/easy-account/execution/capability-model/composition-rules.json\n- modules/easy-account/execution/generation-policy.json\n`);
}
console.log(`easy-account-page-composition-scaffold: pass (${changeDir})`);
