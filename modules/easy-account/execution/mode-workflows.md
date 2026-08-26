# Easy Account 快捷模式工作流

本文件只适用于显式 `/easy-account:prd`、`/easy-account:design` 和 `/easy-account:full`。未使用快捷命令时，不读取本文件，继续执行现有受控自然语言页面生成工作流。

## 共同入口

1. 使用统一分发器取得模式和工作流，不得删除或改写命令后的原始需求。
2. 选择 `changes/YYYYMMDD-功能名称/`，已有同一需求 Change 时复用；运行：

   ```bash
   node scripts/prepare-easy-account-mode.mjs --mode {mode} --request "<原始需求>" --change changes/{change-id}
   ```

3. 只读取工作流返回的资源，按阶段写入可编辑产物。
4. 完成后运行工作流返回的 `finalizeCommand`。最终器负责结构校验；design/full 存在 Page Spec 或组合式 Page Spec 时，会调用对应构建器并执行派生产物静态完整性检查。
5. 不启动浏览器、不截图、不运行 Playwright。视觉和交互始终保留为人工验收。

## PRD 模式

- 读取公司 PRD 规范、通用产品分析规则和易账通业务规则。
- 将 `mode-state.json` 中的原始需求写成 `requirement.md`。
- 严格保留公司模板的章节顺序和固定表头；信息缺失使用 `[待确认：具体问题]`，不编造业务结论。
- 不生成 `page-design.md`、`page-spec.json` 或预览，也不读取导演规则和渲染资源。
- 运行 `finalizeCommand`，通过后交付 `requirement.md` 和 `mode-delivery.json`。

## Design 模式

- 先按 PRD 标准生成 `requirement.md`，再读取设计、模板和交互规则。
- 写入 `page-design.md`，必须包含页面方案、规则证据、排除方案和待人工验收。
- 写入 `rules-read.md`，逐项记录本次实际读取的资源。
- 根据 `generation-policy.json` 判断页面家族：
  - `available`：创建并填写 `page-spec.json`，运行最终器生成预览。
  - `workflow-only`、`pending` 或 `legacy`：不绕过策略生成页面，写入 `capability-gap.md`，说明页面意图、当前状态、缺失能力和建议后续工作。
- 需要多个区域、步骤或页面转场时，创建并填写 `page-composition.json`，先运行 `node scripts/validate-easy-account-page-composition.mjs changes/{change-id}/page-composition.json --write`；只有 `readiness` 为 `preview-ready` 才能由最终器构建组合式预览。
- Design 模式不要求 `tasks.md`、`implementation.md` 或 `review.md`。

## Full 模式

- 完成 Design 模式的全部需求、设计和规则记录。
- 只在页面家族 `available` 且能力组合受当前策略支持时继续；否则报告能力缺口并停止，不能将不完整页面标为完整交付。
- 创建并填写 `page-spec.json` 或 `page-composition.json`，它是页面业务内容的唯一编辑源。
- 写入 `tasks.md`、`implementation.md` 和 `review.md`；`review.md` 必须保留人工验收待办。
- 运行最终器构建预览、核对派生产物哈希与 JavaScript 语法，并把自动静态检查结果写回 `review.md` 和 `mode-delivery.json`。

## 产物边界

| 模式 | 必需可编辑产物 | 条件产物 | 派生产物 |
| --- | --- | --- | --- |
| prd | `requirement.md` | 无 | `mode-delivery.json` |
| design | `requirement.md`、`page-design.md`、`rules-read.md` | `page-spec.json`、`page-composition.json` 或 `capability-gap.md` | 有可构建规格时生成预览与构建记录；始终生成 `mode-delivery.json` |
| full | `requirement.md`、`page-design.md`、`rules-read.md`、一种页面规格、`tasks.md`、`implementation.md`、`review.md` | 无 | 预览、构建记录、`mode-delivery.json` |

`mode-state.json` 是准备脚本生成的请求与模式记录，不是业务需求文档。`preview.html`、`preview-app.js`、业务 CSS、Shell 和资产仍由对应构建器生成，不手工修改；预览使用 Shell 目录中的公共本地 vendor。
