---
name: easy-account-skill
description: 面向易账通业务人员生成、设计、实现、更新和评审易账通账户与账务后台页面。适用于查询列表、表单、详情和受控结果流程；使用本技能自带的易账通业务规则、视觉规则、固定 Shell 和 Page Spec 渲染器，不路由到其他易宝业务系统。
---

# 易账通页面技能

这是易账通的独立页面交付入口。用户只需描述业务目标、使用角色、字段、操作和状态；技能负责选择受支持的页面形式，生成可追溯的 Change 和可直接打开的预览。

## 适用范围

- 易账通账户、账务、余额、冻结/解冻、调账、对账和操作日志相关后台页面。
- 查询列表、普通表单、分组表单、详情页，以及已开放能力覆盖的交互流程。
- 新建页面、修改已有 `changes/{change-id}`、评审已有预览。

以下请求不在本技能范围内：老板管账、易来钱收银台、易宝开放平台，或没有明确易账通归属的通用账户页面。

## 工作流程

1. 读取 `modules/easy-account/DOMAIN.md`，再按当前任务阶段读取对应的导演规则、业务规则和执行上下文；不要加载其他业务系统的规则、Shell 或主题。
2. 为新页面创建 `changes/YYYYMMDD-功能名称/`，写入需求、设计、规则读取记录和唯一可编辑的 `page-spec.json`。已有 Change 直接沿用原目录，不创建重复 Change。
3. 使用固定脚本生成预览：

   ```bash
   node scripts/scaffold-easy-account-page-spec.mjs changes/{change-id}
   node scripts/build-easy-account-page-spec.mjs changes/{change-id}/page-spec.json
   ```

4. `page-spec.json` 是唯一编辑源；`preview.html`、`preview-app.js`、业务 CSS、Shell 文件、品牌资产和 vendor 都是派生产物，不手工修改。
5. 构建成功后停止在预览交付：只运行构建和静态完整性检查，不启动或控制浏览器，不调用 Playwright、截图或浏览器自动化进行验收。提供预览地址后，由业务人员独立完成人工验收；Agent 不等待、复核或代替人工验收。

## 规则边界

- `modules/easy-account/director-rules/` 是视觉、页面方案和交互验收的唯一设计决策来源。
- `modules/easy-account/execution/generation-policy.json` 决定页面家族和能力是否开放；规则存在不代表能力已开放。
- `modules/easy-account/shell/` 是固定框架层，业务页面只能挂载到内容插槽，不能重绘导航、多标签、页脚或侧栏。
- 不引用 Boss Ledger 的 Shell、Logo、vendor、主题 CSS 或规则。
- 不依赖外部 CDN 或远程图片；预览必须使用本技能内的品牌资产和本地 vendor。

## 参考资源

- 业务语义：`modules/easy-account/business-rules.md`
- 组件与前端约定：`modules/easy-account/components.md`、`modules/easy-account/frontend.md`
- 视觉与交互：`modules/easy-account/director-rules/`
- 生成契约：`modules/easy-account/execution/page-spec.schema.json`
- 页面族上下文：`modules/easy-account/execution/context-packs/`
- 固定渲染器与壳层：`modules/easy-account/execution/renderer/`、`modules/easy-account/shell/`

## 失败处理

- 页面家族处于 `pending`、`workflow-only` 或 `legacy` 时，报告能力缺口，不绕过策略生成候选页面。
- Page Spec 和派生产物由构建脚本生成；如预览不符合需求，直接修改 `page-spec.json` 后重新构建。
- 预览交互和整体视觉需由业务人员人工验收；未确认的部分标记为待验收。
- 查询列表结果区默认标题固定为“查询列表”；只有需求明确指定其他标题时，才使用自定义标题。
- Table 列字段默认必须完整展示，允许按列宽折行；禁止默认使用省略号隐藏字段内容。需要保持单行的操作列、状态 Tag 等控件可单独声明。
- Table 分页统一为左右分布：左侧显示“共 X 条”统计，右侧使用 Ant Design Pagination 的页码、页大小切换和更多分页控件；切换每页条数后回到第 1 页。
