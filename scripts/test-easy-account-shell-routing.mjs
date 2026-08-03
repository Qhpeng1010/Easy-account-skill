#!/usr/bin/env node
import assert from 'node:assert/strict';
import { generatedPreviewApp, resolveShellActiveTabId } from './lib/easy-account-page-spec.mjs';

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

const generated = generatedPreviewApp({
  metadata: { changeId: '20260731-shell-routing' },
  shell: {
    ...storeShell,
    pages: [{ tabId: 'enterprise-unit', spec: { metadata: { pageName: '企业单位管理' } } }]
  }
});
assert.match(generated, /resolveShellActiveTabId/);
assert.match(generated, /const pageEntries/);
assert.match(generated, /contentByTab\[page\.tabId\] = page\.root/);
assert.match(generated, /tabs\.some/);
assert.match(generated, /tabs\.push/);
assert.match(generated, /activeTabId: activeTabId/);

console.log('easy-account-shell-routing-regression: pass');
