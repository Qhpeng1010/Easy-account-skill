# Easy Account Domain

Easy Account（易账通）是独立的账户与账务管理业务域。它使用自己的产品框架、设计规范、主题、组件约定和页面方案，不复用 Boss Ledger 壳层。

## Route Boundary

- 明确包含 `Easy Account`、`EasyAccount`、`easy-account` 或“易账通”的需求进入本模块。
- Boss Ledger、开放平台、易来钱收银台不进入本模块。
- 只有“账户”或“账务”但没有 Easy Account 产品标识时，不强制路由到本模块。

## Progressive Loading

`domain.json` 是本业务域的唯一适配合约，声明阶段资源、页面意图、固定 Shell 和可选执行命令。路由命中后，只读取 resolver 返回的 Easy Account Markdown。

## Execution Boundary

当前使用 `page-spec-shadow`。`modules/easy-account/shell/` 是唯一的固定框架层，负责导航、多标签、内容工作区、页脚、品牌资产与本地 vendor；业务 Page Spec 只能挂载到其内容插槽，不能重新实现 Shell。普通查询列表可生成独立的 Easy Account Page Spec 候选，并通过本域固定壳层、渲染器和派生产物静态完整性检查；不得触发浏览器、Playwright、截图或自动化交互验收，页面视觉与交互由业务人员人工验收，其余页面族仍保留在 shadow、workflow-only 或 legacy 边界。

不加载 Boss Ledger 的 Shell，也不引用 Boss Ledger 的 Logo、vendor、规则或验证器。每个 Page Spec Change 只编辑 `page-spec.json`，其余预览文件由 `build-easy-account-page-spec.mjs` 生成。
