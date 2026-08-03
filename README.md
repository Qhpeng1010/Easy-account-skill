# 易账通页面技能

这是一个用于生成、评审和验证易账通账户与账务后台页面的规则工程。它的目标不是让 AI 随意拼页面，而是让需求先进入易账通业务域，再按该域的设计规则和当前已开放能力生成可复查的交付。

本仓库只服务于易账通业务。

## 先从哪里看

如果你是产品、设计或研发同学，建议按以下顺序了解本仓库：

1. [SKILL.md](SKILL.md)：技能的触发范围、交付流程和失败处理原则。
2. [导演规则](modules/easy-account/director-rules/README.md)：视觉、页面模板和交互验收的唯一设计决策来源。
3. [能力策略](modules/easy-account/execution/generation-policy.json)：确认页面类型和组件能力是否已开放。
4. [业务规则](modules/easy-account/business-rules.md)：了解字段、状态、权限和结果约束。

## 目录说明

```text  
easy-account-skill/
├── SKILL.md                         技能入口、路由范围和交付规则
├── README.md                        本说明
├── agents/                          Codex 界面的技能元数据
├── modules/
│   ├── easy-account/                易账通业务域
│   │   ├── director-rules/          视觉、模板和交互验收规则
│   │   ├── execution/               能力策略、Page Spec 契约、上下文和渲染器
│   │   ├── shell/                   固定后台 Shell、品牌资产和本地依赖
│   │   ├── business-rules.md        业务字段、状态和权限规则
│   │   ├── components.md            组件使用约定
│   │   ├── frontend.md              前端实现约定
│   │   └── domain.json              机器可读的路由和执行配置
│   └── shared/                      通用产品分析规则和预览模板
├── scripts/                         Page Spec 脚手架、构建和回归测试工具
└── changes/                         本地页面需求与预览交付目录，不提交到 Git
```

`SKILL.md` 负责将请求限定在易账通业务域，并说明交付流程。页面的视觉、模板、组件能力和渲染实现分别由导演规则、能力策略、Page Spec 和固定 Shell 决定。

## 当前能力

页面是否可以生成，以 [`generation-policy.json`](modules/easy-account/execution/generation-policy.json) 为准，而不是仅凭规则文件是否存在。

| 页面族 | 当前状态 | 已覆盖能力 |
| --- | --- | --- |
| 查询列表 | 可用 | 基础与高级查询、字段配置、状态与金额列、分页、列设置、弹窗或页面新建、抽屉详情。 |
| 表单 | 可用 | 简单表单、分组表单、步骤表单、固定操作区和复核。 |
| 详情 | 可用 | 分组信息、指标摘要和嵌入式表格。 |
| 结果页 | 仅流程说明 | 不生成可交付候选页面。 |
| 仪表盘 | 未开放 | 不生成页面。 |

当前已验证的稳定组合包括账户查询列表、列设置、列表上下文操作、页面新建与详情、账户科目流程、分组表单和分组详情。新的组合可以在已开放能力内生成，但仍需人工验收后交付。

## 页面如何生成

易账通使用 Page Spec 驱动的固定渲染链路。AI 只编辑页面规格，固定渲染器负责生成预览，避免同一需求被手工实现成不一致的页面。

```text
业务需求
  -> 识别易账通业务对象、角色、字段、操作和状态
  -> 读取业务规则、导演规则与当前能力策略
  -> 创建 Change 并填写 page-spec.json
  -> 固定渲染器生成预览页面
  -> 运行快速检查
  -> 业务人员人工验收
  -> 交付
```

对于 `pending`、`workflow-only` 或 `legacy` 状态的页面族，技能会报告能力缺口，不会绕过策略生成看似可用的页面。

## 导演规则与单页需求

导演规则管理“同类页面长期应遵守什么”，例如视觉密度、查询区与结果区的组合方式、危险操作确认和交互验收标准。

单页需求管理“这一页展示什么”，例如账户查询的筛选条件、列表字段、状态文案、默认值和操作入口。

| 目标 | 唯一维护位置 | 不应直接修改 |
| --- | --- | --- |
| 全局视觉、组件气质和页面密度 | `director-rules/01-visual-constitution.md` | 单页预览与生成样式 |
| 页面家族、模板选择和页面组合 | `director-rules/02-template-application-rules.md` | 已生成的页面文件 |
| 流程、状态、风险确认和验收 | `director-rules/03-interaction-acceptance-rules.md` | 预览 HTML、CSS 和 JavaScript |
| 单页字段、文案、数据和默认值 | 当前 Change 的 `page-spec.json` | 跨页面导演规则 |
| 页面能力是否开放 | `execution/generation-policy.json` | 仅修改 Markdown 规则来开放能力 |
| 导航、多标签、页脚和侧栏 | `shell/` 对应固定实现 | 单页 Page Spec |

## 如何提出一个新页面

用清晰的业务语言描述需求即可，无需指定代码或组件。建议包含以下信息：

```text
所属系统：易账通 / 账户管理
使用者：运营人员
主要任务：查询、核对和处理账户记录
查询条件：企业名称、账户号、账户状态、余额区间
列表字段：账户号、企业名称、可用余额、冻结余额、账户状态、更新时间
允许操作：查看详情、冻结、解冻
风险要求：冻结或解冻前须明确对象、影响和操作后状态
```

若希望使用抽屉、弹窗、全页表单或步骤流程，也应说明字段数量、是否需要分组、上传、复核和前后依赖。技能会根据能力策略选择匹配的页面族和模板。

## Change 交付目录

每个页面需求在本地使用独立的 `changes/YYYYMMDD-功能名称/` 目录。常见内容如下：

```text
changes/YYYYMMDD-功能名称/
├── proposal.md               需求理解与范围
├── page-design.md            页面设计与规则选择
├── tasks.md                  实施任务
├── implementation.md         实现说明
├── page-spec.json            唯一可编辑的页面规格
├── page-spec-checklist.md    已选规则和能力检查清单
├── preview.html              可直接打开的评审预览
└── review.md                 静态检查与人工验收记录
```

`page-spec.json` 是页面的唯一编辑源。`preview.html`、`preview-app.js`、业务 CSS、Shell 文件、品牌资产和本地 vendor 均为固定或派生产物，不应手工修改。

`changes/` 已加入 `.gitignore`，用于本地需求与预览，不会随本仓库推送。

## 生成与校验

创建并构建 Page Spec：

```bash
node scripts/scaffold-easy-account-page-spec.mjs changes/{change-id}
node scripts/build-easy-account-page-spec.mjs changes/{change-id}/page-spec.json
```

运行 Shell 路由回归测试：

```bash
node scripts/test-easy-account-shell-routing.mjs
```

预期输出：

```text
easy-account-shell-routing-regression: pass
```

生成后的 `preview.html` 可直接在浏览器中打开。也可以在对应目录启动静态服务器后查看：

```bash
python3 -m http.server 8080
```

预览用于评审，不等同于正式生产前端工程；视觉与交互由业务人员人工确认。

## 常见问题

**为什么页面不能生成？**

通常是页面族尚未开放，或所需能力不在当前策略范围内。技能应报告能力缺口，而不是拼接未经验证的页面。

**为什么改了规则，预览没有变化？**

通用规则只定义设计决策。若变更涉及新的组件能力、页面结构或渲染行为，还需同步调整能力策略、Page Spec 契约、固定渲染器和回归测试。

**预览可以直接交付上线吗？**

不可以。预览用于业务和设计验收；正式上线仍需要按研发流程完成接口、权限、数据、异常处理和工程化验证。
