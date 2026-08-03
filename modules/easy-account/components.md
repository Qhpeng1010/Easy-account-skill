# Easy Account Component Rules

## Boundary

本文件定义 Easy Account 页面的组件语义。实现时优先使用 Easy Account 实际工程的组件库；未提供工程时，评审预览使用可访问的语义 HTML，不引用 Boss Ledger 组件封装。

## Required Components

- `PageHeader`：页面名称、辅助说明和页面级主操作。
- `FilterForm`：查询条件、重置、查询和展开/收起。
- `DataTable`：加载、空、错误、列设置、行操作和分页；列标题与字段值默认完整展示，按列宽折行而非省略，操作列和紧凑状态控件可保持单行。
- `Amount`：使用等宽数字特性，同时显示币种和口径。
- `StatusIndicator`：图形或状态点与中文状态文本组合。
- `Form`：支持必填、同步校验、提交中和服务端错误定位。
- `Dialog` / `Drawer`：有明确标题、关闭方式、焦点管理和底部操作区。
- `Result`：显示结果状态、结果说明、关键摘要和后续操作。

## Interaction Rules

- 查询、重置、分页和列设置必须具备可见状态变化。
- 会改变账务结果的操作使用确认对话框，不使用浏览器原生 `confirm` 作为正式交互。
- 主操作、次操作和危险操作使用不同语义，不仅通过颜色区分。
- 缺少权限时展示权限状态，不生成伪造成功结果。
