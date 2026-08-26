# Easy Account Domain

Easy Account（易账通，也写作 Yee账通、yee账通）是独立的账户与账务管理业务域。以上名称均指同一个业务，统一使用 `easy-account` 作为内部标识。它使用自己的产品框架、设计规范、主题、组件约定和页面方案，不复用 Boss Ledger 壳层。

## Route Boundary

- 明确包含 `Easy Account`、`EasyAccount`、`easy-account`、“易账通”“Yee账通”或“yee账通”的需求进入本模块；英文部分大小写不敏感。
- 本技能是易账通专用入口。技能被调用后，需求没有写任何产品名称时仍进入本模块，不要求用户重复声明业务主体。
- 明确以 Boss Ledger（老板管账）、易来钱收银台、易宝开放平台等其他系统为交付目标的请求不进入本模块。
- 同一请求同时出现易账通别名和其他系统名称时，优先理解用户明确表述的交付目标；目标不清楚时先确认，不根据单个名称关键词强行路由。

## Progressive Loading

`domain.json` 是本业务域的唯一适配合约，声明阶段资源、页面意图、固定 Shell 和可选执行命令。路由命中后，只读取 resolver 返回的 Easy Account 资源；Markdown 规则负责语义，JSON Schema/能力契约负责结构和可交付边界，渲染器与 Shell 只作为固定执行资源按阶段加载。

`adapter.commands.contract` 声明快捷命令契约，`adapter.commands.dispatchCommand` 是统一分发入口。请求未以已登记的 `/easy-account:*` 开头时必须返回 `natural`，继续原有受控自然语言工作流；快捷命令不能改变业务域、Shell 或能力策略边界。

`prd`、`design` 和 `full` 使用 `adapter.commands.workflow`、准备命令和最终命令。准备命令只记录显式模式与原始需求；最终命令校验模式产物并复用本域现有构建器。默认 `natural` 路径不得读取模式工作流、运行模式命令或写入模式状态。

## Execution Boundary

当前使用 `page-spec-shadow`。`modules/easy-account/shell/` 是唯一的固定框架层，负责导航、多标签、内容工作区、页脚、品牌资产与本地 vendor；业务 Page Spec 只能挂载到其内容插槽，不能重新实现 Shell。普通查询列表可生成独立的 Easy Account Page Spec 候选，并通过本域固定壳层、渲染器和派生产物静态完整性检查；不得触发浏览器、Playwright、截图或自动化交互验收，页面视觉与交互由业务人员人工验收，其余页面族仍保留在 shadow、workflow-only 或 legacy 边界。

不加载 Boss Ledger 的 Shell，也不引用 Boss Ledger 的 Logo、vendor、规则或验证器。每个 Page Spec Change 只编辑 `page-spec.json`，其余预览文件由 `build-easy-account-page-spec.mjs` 生成。
