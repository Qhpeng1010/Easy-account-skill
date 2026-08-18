#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { finalizeEasyAccountMode } from './finalize-easy-account-mode.mjs';
import { prepareEasyAccountMode } from './prepare-easy-account-mode.mjs';

const root = process.cwd();
const changesRoot = resolve(root, 'changes');
mkdirSync(changesRoot, { recursive: true });
const created = [];

function newChange(label) {
  const dir = resolve(changesRoot, `20991231-${label}-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir);
  created.push(dir);
  return { dir, arg: relative(root, dir), id: basename(dir) };
}

function write(dir, name, source) {
  writeFileSync(resolve(dir, name), `${source.trim()}\n`);
}

function prd(title) {
  return `
# 【账户管理】20991231-${title}

- 飞书项目链接：[待确认：飞书项目链接]
- 一句话需求说明：为运营人员提供账户查询与核对能力。

## 1. 文档变更日志

| 时间 | 版本号 | 变更人 | 主要变更内容 |
| --- | --- | --- | --- |
| 2099-12-31 | V1.0 | [待确认：变更人] | 创建需求文档 |

## 2. 需求分析

### 2.1 需求背景
运营人员需要统一查询账户。
### 2.2 现状问题
账户信息缺少统一核对入口。
### 2.3 解决思路
提供受控查询列表。
### 2.4 价值评估
#### 给商户带来的价值
缩短问题确认时间。
#### 给易宝带来的价值
减少人工查询工作量。
### 2.5 需求范围
本期包含查询和列表，不包含真实资金操作。

## 3. 目标
### 3.1 设计目标
支持运营人员稳定完成账户查询。
### 3.2 目标客户
易账通运营人员。
### 3.3 目标排期
[待确认：目标上线时间和倒排原因]

## 4. 设计概要
### 4.1 主要业务流程和业务名词定义
输入条件、查询、核对结果。
### 4.2 关键模型定义
账户是主要对象，账户状态是受控枚举。
### 4.3 功能定义
| 功能模块 | 功能点 | 功能描述 | 所在系统/应用 | 优先级 |
| --- | --- | --- | --- | --- |
| 账户查询 | 条件查询 | 按账户号查询账户 | 易账通 | 5 |
### 4.4 接口
[待确认：查询接口]
### 4.5 原型
- 蓝湖/Axure 链接：[待确认：原型链接]
| 改动点入口 | 改动点路径 | 改动点描述 | 示例图 | 优先级 |
| --- | --- | --- | --- | --- |
| 账户管理 | 账户管理/账户查询 | 新增查询列表 | [待确认：示例图] | 5 |
### 4.6 非功能性需求
| 目录 | 优先级 |
| --- | --- |
| 查询性能：[待确认：量化指标] | 4 |
### 4.7 灰度策略
[待确认：灰度范围和回滚条件]
### 4.8 存量数据处理方案
不修改存量数据。
### 4.9 资金风险及应对方案
本期只读，不发起资金变更；查询请求仍需防重和审计。
### 4.10 与风控接口对接设计
本需求不涉及：不执行风险决策。

## 5. 附录
### 5.1 相关文档
[待确认：相关文档]
### 5.2 遗留问题
[待确认：遗留问题]
### 5.3 会议纪要
[待确认：会议纪要]
`;
}

function designDocs(dir) {
  write(dir, 'page-design.md', `
# 账户查询页面设计
## 页面方案
使用查询列表页面。
## 规则证据
使用 EA-TPL-001、EA-TPL-003、EA-TPL-004、EA-INT-002。
## 排除方案
不使用 Dashboard。
## 待人工验收
查询、分页和窄屏布局待人工验收。
`);
  write(dir, 'rules-read.md', `
# Rules Read
- modules/easy-account/DOMAIN.md
- modules/easy-account/business-rules.md
- modules/easy-account/director-rules/01-visual-constitution.md
- modules/easy-account/director-rules/02-template-application-rules.md
- modules/easy-account/director-rules/03-interaction-acceptance-rules.md
- modules/easy-account/execution/capability-model/capability-model.md
- modules/easy-account/execution/capability-model/capability-registry.json
- modules/easy-account/execution/capability-model/composition-rules.json
- modules/easy-account/execution/generation-policy.json
`);
}

function pageSpec(changeId, request) {
  return {
    schemaVersion: 1,
    metadata: {
      changeId,
      pageName: '账户查询',
      family: 'list',
      templateId: 'list.account-query',
      request,
      ruleRefs: ['EA-TPL-001', 'EA-TPL-003', 'EA-TPL-004', 'EA-INT-002'],
      assumptions: [],
      selectionReason: '运营人员需要查询和核对账户记录'
    },
    ui: { system: 'easy-account', runtime: 'easy-account-page-spec', rendererVersion: 1 },
    shell: { primaryNav: '账户管理', sideNav: '账户查询' },
    content: { capabilities: ['query.basic', 'table.flat', 'table.pagination'] },
    list: {
      query: { fields: [{ key: 'accountNo', label: '账户号', control: 'input' }] },
      table: {
        rowKey: 'accountNo',
        columns: [{ key: 'accountNo', label: '账户号' }],
        rows: [{ accountNo: 'EA10001' }],
        pagination: { pageSize: 20, total: 1 }
      }
    },
    states: { loading: true, empty: true, error: true, permissionDenied: true }
  };
}

function pageComposition(changeId, request) {
  return {
    schemaVersion: 2,
    metadata: {
      changeId,
      pageName: '账户汇总查询',
      request,
      ruleRefs: ['EA-TPL-001', 'EA-TPL-003', 'EA-TPL-004', 'EA-INT-002'],
      assumptions: []
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
      { id: 'query-to-summary', from: { scope: 'query', path: 'filters' }, to: { region: 'summary', path: 'metrics' }, mode: 'filter', transform: 'aggregate' }
    ],
    transitions: []
  };
}

try {
  const prdChange = newChange('prd-pipeline');
  const prdRequest = '输出易账通账户查询 PRD';
  const preparedPrd = prepareEasyAccountMode({ mode: 'prd', request: prdRequest, change: prdChange.arg, root });
  assert.equal(preparedPrd.status, 'prepared');
  write(prdChange.dir, 'requirement.md', prd('账户查询需求'));
  const prdResult = finalizeEasyAccountMode({ mode: 'prd', change: prdChange.arg, root });
  assert.equal(prdResult.status, 'completed');
  assert.equal(prdResult.humanAcceptance, 'not-applicable');
  assert.equal(existsSync(resolve(prdChange.dir, 'preview.html')), false);

  const collision = newChange('collision');
  write(collision.dir, 'existing.md', '# Existing');
  assert.throws(
    () => prepareEasyAccountMode({ mode: 'prd', request: '另一个需求', change: collision.arg, root }),
    /non-empty Change/
  );

  const designChange = newChange('design-gap');
  const designRequest = '设计易账通业务概览 Dashboard';
  prepareEasyAccountMode({ mode: 'design', request: designRequest, change: designChange.arg, root });
  write(designChange.dir, 'requirement.md', prd('业务概览设计'));
  designDocs(designChange.dir);
  write(designChange.dir, 'capability-gap.md', `
# 能力缺口
## 页面意图
易账通业务概览 Dashboard。
## 当前状态
dashboard 为 pending。
## 缺失能力
当前没有可执行 Dashboard Page Spec 和渲染能力。
## 后续建议
补齐策略、规格、渲染器和回归案例后开放。
`);
  const designResult = finalizeEasyAccountMode({ mode: 'design', change: designChange.arg, root });
  assert.equal(designResult.status, 'completed-with-capability-gap');
  assert.equal(existsSync(resolve(designChange.dir, 'preview.html')), false);

  const compositionChange = newChange('composition-gap');
  const compositionRequest = '设计账户汇总查询页面';
  prepareEasyAccountMode({ mode: 'design', request: compositionRequest, change: compositionChange.arg, root });
  write(compositionChange.dir, 'requirement.md', prd('账户汇总查询设计'));
  designDocs(compositionChange.dir);
  writeFileSync(resolve(compositionChange.dir, 'page-composition.json'), `${JSON.stringify(pageComposition(compositionChange.id, compositionRequest), null, 2)}\n`);
  write(compositionChange.dir, 'capability-gap.md', `
# 能力缺口
## 页面意图
账户查询、指标统计与列表联动。
## 当前状态
组合式 Page Spec 已通过结构校验，但查询工作台与统计区仍为 model-only。
## 缺失能力
组合式渲染器尚未实现统计区和 v2 Page Spec 构建。
## 后续建议
接入组合式渲染器后开放 query-summary-table 配方。
`);
  const compositionResult = finalizeEasyAccountMode({ mode: 'design', change: compositionChange.arg, root });
  assert.equal(compositionResult.status, 'completed');
  assert.equal(existsSync(resolve(compositionChange.dir, 'composition-validation.json')), true);
  assert.equal(JSON.parse(readFileSync(resolve(compositionChange.dir, 'composition-validation.json'), 'utf8')).readiness, 'preview-ready');
  assert.equal(existsSync(resolve(compositionChange.dir, 'preview.html')), true);

  const fullGapChange = newChange('full-gap');
  const fullGapRequest = '完整生成易账通业务概览 Dashboard';
  prepareEasyAccountMode({ mode: 'full', request: fullGapRequest, change: fullGapChange.arg, root });
  write(fullGapChange.dir, 'requirement.md', prd('业务概览完整交付'));
  designDocs(fullGapChange.dir);
  write(fullGapChange.dir, 'capability-gap.md', `
# 能力缺口
## 页面意图
易账通业务概览 Dashboard。
## 当前状态
dashboard 为 pending。
## 缺失能力
当前没有可执行 Dashboard Page Spec 和渲染能力。
## 后续建议
补齐策略、规格、渲染器和回归案例后开放。
`);
  const fullGapResult = finalizeEasyAccountMode({ mode: 'full', change: fullGapChange.arg, root });
  assert.equal(fullGapResult.status, 'blocked-with-capability-gap');
  assert.equal(existsSync(resolve(fullGapChange.dir, 'mode-delivery.json')), true);
  assert.equal(existsSync(resolve(fullGapChange.dir, 'preview.html')), false);

  const fullChange = newChange('full-pipeline');
  const fullRequest = '完整生成易账通账户查询列表';
  prepareEasyAccountMode({ mode: 'full', request: fullRequest, change: fullChange.arg, root });
  write(fullChange.dir, 'requirement.md', prd('账户查询完整交付'));
  designDocs(fullChange.dir);
  writeFileSync(resolve(fullChange.dir, 'page-spec.json'), `${JSON.stringify(pageSpec(fullChange.id, fullRequest), null, 2)}\n`);
  write(fullChange.dir, 'tasks.md', '# 实施任务\n- [x] 生成页面规格\n- [ ] 人工验收');
  write(fullChange.dir, 'implementation.md', '# 实现说明\npage-spec.json 是唯一可编辑页面源。');
  write(fullChange.dir, 'review.md', '# 静态检查与人工验收\n\n## 待人工验收\n\n- 查询与分页。');
  const fullResult = finalizeEasyAccountMode({ mode: 'full', change: fullChange.arg, root });
  assert.equal(fullResult.status, 'completed');
  assert.equal(fullResult.humanAcceptance, 'pending');
  assert.equal(existsSync(resolve(fullChange.dir, 'preview.html')), true);
  assert.match(readFileSync(resolve(fullChange.dir, 'review.md'), 'utf8'), /easy-account-static-checks:start/);
  assert.equal(readFileSync(resolve(fullChange.dir, 'mode-state.json'), 'utf8').includes(fullRequest), true);
  assert.equal(readFileSync(resolve(fullChange.dir, 'page-spec.json'), 'utf8').includes(fullRequest), true);

  console.log('easy-account-mode-pipelines: pass');
} finally {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
}
