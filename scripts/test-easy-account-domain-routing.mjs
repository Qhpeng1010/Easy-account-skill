#!/usr/bin/env node
import assert from 'node:assert/strict';
import { dispatch } from './dispatch-easy-account-command.mjs';
import { resolveEasyAccountDomain } from './lib/easy-account-domain.mjs';

const root = process.cwd();

for (const alias of ['易账通', 'Yee账通', 'yee账通', 'YEE账通', 'Easy Account', 'easy-account']) {
  const result = resolveEasyAccountDomain(`生成${alias}账户查询列表`, root);
  assert.equal(result.status, 'matched', `${alias} should be recognized as an Easy Account alias.`);
  assert.equal(result.system, 'easy-account');
}

const unnamed = resolveEasyAccountDomain('生成账户查询列表，支持按商户编号筛选', root);
assert.equal(unnamed.status, 'defaulted');
assert.equal(unnamed.system, 'easy-account');

const unnamedDispatch = dispatch('生成账户查询列表，支持按商户编号筛选', root);
assert.equal(unnamedDispatch.status, 'natural-generation');
assert.equal(unnamedDispatch.domain.status, 'defaulted');
assert.equal(unnamedDispatch.domain.system, 'easy-account');

for (const product of ['老板管账', 'Boss Ledger', '易来钱收银台', '易宝开放平台']) {
  const result = dispatch(`生成${product}账户查询列表`, root);
  assert.equal(result.status, 'outside-domain', `${product} should remain outside the Easy Account domain.`);
  assert.equal(result.domain.system, null);
}

const ambiguous = dispatch('对比易账通和老板管账，生成账户查询列表', root);
assert.equal(ambiguous.status, 'clarify-target');
assert.match(ambiguous.question, /目标系统/);

console.log('easy-account-domain-routing: pass');
