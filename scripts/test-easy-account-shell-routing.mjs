#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generatedPreviewApp, projectShellMenu, resolveShellActiveTabId } from './lib/easy-account-page-spec.mjs';

const shellConfig = {
  activeTabId: 'role-management',
  tabs: [
    { id: 'role-management', label: '角色管理' },
    { id: 'store-management', label: '门店管理' }
  ],
  menu: [{
    id: 'enterprise-management',
    label: '企业管理',
    children: [
      { id: 'store-management', label: '门店管理' },
      { id: 'role-management', label: '角色管理', active: true }
    ]
  }]
};
const storeShell = { primaryNav: '企业管理', sideNav: '门店管理' };

assert.equal(
  resolveShellActiveTabId(storeShell, shellConfig),
  'store-management',
  'The requested side navigation must override the static shell default tab.'
);
assert.equal(
  resolveShellActiveTabId({ ...storeShell, activeTabId: 'custom-store' }, shellConfig),
  'custom-store',
  'An explicit active tab id must take precedence.'
);
assert.equal(
  resolveShellActiveTabId({ primaryNav: '账户管理', sideNav: '账户查询' }, shellConfig, 'page-account-query'),
  'page-account-query',
  'An unmatched request must use its generated page id instead of the static shell default.'
);

const projectedMenu = projectShellMenu([
  { tabId: 'store-management', spec: { metadata: { pageName: '门店管理' }, shell: storeShell } }
], { menuCatalog: shellConfig.menu });
assert.deepEqual(projectedMenu.map((group) => group.label), ['企业管理']);
assert.deepEqual(projectedMenu[0].children.map((item) => item.label), ['门店管理']);

const generated = generatedPreviewApp({
  metadata: { changeId: '20260731-shell-routing' },
  shell: {
    ...storeShell,
    pages: [
      { tabId: 'ignored-incomplete-page' },
      {
        tabId: 'enterprise-unit',
        spec: {
          metadata: { pageName: '企业单位管理' },
          ui: { system: 'easy-account' },
          content: { capabilities: [] }
        }
      }
    ]
  }
});
assert.match(generated, /resolveShellActiveTabId/);
assert.match(generated, /const declaredPages =/);
assert.match(generated, /page\.spec\.metadata && page\.spec\.ui && page\.spec\.content/);
assert.match(generated, /const pageEntries/);
assert.match(generated, /contentByTab\[page\.tabId\] = page\.root/);
assert.match(generated, /const tabs = pageEntries\.filter/);
assert.match(generated, /const menu =/);
assert.doesNotMatch(generated, /const tabs = \(shellConfig\.tabs/);
assert.match(generated, /activeTabId: activeTabId/);

const shellExample = readFileSync(new URL('../modules/easy-account/shell/shell-config.example.js', import.meta.url), 'utf8');
assert.match(shellExample, /activeTabId: "store-management"/);
assert.match(shellExample, /tabs: \[\s*\{ id: "store-management", label: "门店管理"/);
assert.match(shellExample, /menu: \[\s*\{[\s\S]*?label: "企业管理"[\s\S]*?label: "门店管理"/);
assert.match(shellExample, /menuCatalog: \[/);

console.log('easy-account-shell-routing-regression: pass');
