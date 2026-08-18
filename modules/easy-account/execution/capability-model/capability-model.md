# Easy Account 能力模型

这是 Page Spec 组合化改造的能力契约。它定义“能组合什么”和“组合必须满足什么”；已标记 `implemented` 的能力可进入组合式预览，其他状态仍只可用于设计和能力缺口记录。

## 四层模型

1. **Skeleton**：稳定的任务结构，例如 `query-workbench`、`form-workflow` 和 `result-workflow`。
2. **Region**：骨架中的业务区域，例如 `query`、`summary`、`table`、`step-form` 和 `result`。
3. **Capability**：区域允许声明的行为，例如 `summary.aggregate`、`form.review` 或 `binding.rowToForm`。
4. **Binding / Transition**：声明数据如何在区域间传递、动作如何从一个页面进入另一个页面。

机器可读文件：

- `capability-registry.json`：骨架、区域和能力注册表。
- `composition-rules.json`：骨架约束、已登记配方和页面转场规则。
- `page-composition.schema.json`：组合式 Page Spec 的结构契约（schemaVersion 2）。
- `data-binding.schema.json`：区域之间的数据绑定契约。

`page-composition.json` 可以通过可选的 `workflow.pages` 声明后续页面。根页面负责初始标签，转场的 `to` 指向工作流页面 ID；`bindingIds` 指定本次转场需要写入目标页面上下文的绑定。运行时只在转场发生时打开目标标签，不预先渲染全部页面。

## 状态含义

- `implemented`：当前固定渲染器已有实现，可由 v1 Page Spec 使用。
- `declared-only`：能力已进入模型，但当前渲染器还没有完整实现。
- `model-only`：能力只完成模型与组合规则登记，尚未开放生成。

不得把 `declared-only` 或 `model-only` 宣称为可交付预览。实现新的渲染器能力时，必须同时提升注册表中的 `runtimeStatus` 并补充对应测试。

## 组合原则

- 需求先选择骨架，再选择区域；不要为每个业务组合新增整页模板。
- 区域顺序由 `composition-rules.json` 约束，不能任意拼接。
- 数据绑定只允许声明式路径和有限变换，不允许在 Page Spec 中注入任意 JavaScript。
- 新的业务流程优先登记为 recipe；只有出现新的任务结构时才新增 skeleton。
- v1 `family/templateId/list` 页面继续兼容，迁移到组合式 Page Spec 后再逐步开放新能力。
- 自然语言先由 `scripts/lib/easy-account-capability-policy.mjs` 选择 `legacy-adapter` 或已登记 recipe；不要在生成阶段自行绕过策略选择页面结构。
