#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const changeDir = process.argv[2];
if (!changeDir) {
  console.error('Usage: node scripts/scaffold-easy-account-page-spec.mjs changes/{change-id}');
  process.exit(2);
}
const root = process.cwd();
const target = resolve(root, changeDir);
mkdirSync(target, { recursive: true });
const changeId = target.split('/').pop();
const source = {
  schemaVersion: 1,
  metadata: { changeId, pageName: '易账通页面', family: 'list', templateId: 'list.account-query', ruleRefs: ['EA-TPL-001', 'EA-TPL-002', 'EA-INT-002'], assumptions: [], selectionReason: '普通账户查询列表' },
  ui: { system: 'easy-account', runtime: 'easy-account-page-spec', rendererVersion: 1 },
  shell: { primaryNav: '账户管理', sideNav: '账户查询' },
  content: { capabilities: ['query.basic', 'table.flat', 'table.pagination'] },
  list: { query: { fields: [{ key: 'accountNo', label: '账户号', control: 'input' }] }, table: { rowKey: 'accountNo', columns: [{ key: 'accountNo', label: '账户号' }], rows: [], pagination: { pageSize: 20, total: 0 } } },
  states: { loading: true, empty: true, error: true, permissionDenied: true }
};
writeFileSync(resolve(target, 'page-spec.json'), `${JSON.stringify(source, null, 2)}\n`);
writeFileSync(resolve(target, 'rules-read.md'), `# Rules Read\n\n- modules/easy-account/DOMAIN.md\n- modules/easy-account/business-rules.md\n- modules/easy-account/director-rules/01-visual-constitution.md\n- modules/easy-account/director-rules/02-template-application-rules.md\n- modules/easy-account/director-rules/03-interaction-acceptance-rules.md\n- modules/easy-account/execution/context-packs/core.md\n- modules/easy-account/execution/context-packs/list.md\n- modules/easy-account/execution/capability-model/capability-model.md\n- modules/easy-account/execution/capability-model/capability-registry.json\n- modules/easy-account/execution/capability-model/composition-rules.json\n- modules/easy-account/execution/generation-policy.json\n`);
console.log(`easy-account-page-spec-scaffold: pass (${changeDir})`);
