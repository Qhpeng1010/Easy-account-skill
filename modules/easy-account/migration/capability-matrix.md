# 易账通 Page Spec 迁移能力矩阵

| 页面族/能力 | 初始模式 | 依据 | 进入下一阶段的证据 |
| --- | --- | --- | --- |
| 普通账户查询列表 | shadow | `EA-TPL-003`、`EA-TPL-004`、`EA-INT-002` | 正常、重置、空、错误、权限和响应式人工验收案例 |
| 列设置 | shadow | `EA-TPL-004` | 只读字段切换不改变数据语义，布局无跳动 |
| 状态确认操作 | shadow | `EA-INT-005` | 取消/确认/失败三态和权限校验 |
| 高级查询/依赖筛选 | shadow | `EA-TPL-003` | 展开、依赖、错误恢复黄金案例 |
| 分组表单 | shadow | `EA-TPL-007`、`EA-TPL-010`、`EA-INT-003` | 服务端校验、未保存确认、成功流转 |
| 详情 | shadow | `EA-TPL-005`、`EA-TPL-008`、`EA-INT-004` | 脱敏、余额口径、关联记录和日志 |
| Result | workflow-only / legacy | `EA-TPL-008`、`EA-TPL-011` | 受控写操作结果页黄金案例 |
| Dashboard | pending / legacy | `EA-TPL-009`、`EA-TPL-011` | 指标口径、图表状态和权限案例 |

易账通不会复制 Boss Ledger 的主题、Shell 或运行时实现；只复用“Page Spec 是唯一编辑源、派生产物由构建脚本生成”的工程原则。
