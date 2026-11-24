---
name: easy-account-skill
description: 为易账通（同义名称：Yee账通、yee账通、Easy Account）生成、设计、实现、更新和评审账户与账务后台页面。适用于查询列表、表单、详情和受控结果流程；调用本技能时，未写产品名称的页面需求也默认归属易账通。明确指定老板管账、易来钱收银台、易宝开放平台等其他业务系统时不适用。
---

# 易账通页面技能

这是易账通的独立页面交付入口。`易账通`、`Yee账通`、`yee账通` 和 `Easy Account` 均指同一个业务。用户只需描述业务目标、使用角色、字段、操作和状态；技能负责选择受支持的页面形式，生成可追溯的 Change 和可直接打开的预览。

## 调用模式

请求开头可以使用以下快捷命令；命令后的文字作为原始业务需求，不得改写或丢弃：

| 命令 | 模式 |
| --- | --- |
| `/easy-account:prd` | 按基础产品部标准格式产出需求方案与需求记录。 |
| `/easy-account:design` | 产出页面设计，能力允许时生成预览。 |
| `/easy-account:full` | 完成需求、设计、实现、预览和静态检查。 |
| `/easy-account:fast` | 尝试已登记配方；不匹配时回退到受控自然语言生成。 |

未使用快捷命令时，继续执行本技能原有的受控自然语言页面生成工作流；统一策略解析器会在简单页面使用 v1 兼容适配器，在命中已登记组合配方时使用组合式 Page Spec。快捷命令只在请求第一个非空白 Token 完整匹配时生效；未知的 `/easy-account:*` 命令必须报告支持列表，不得回退。命令契约与解析入口分别位于 `modules/easy-account/execution/command-contract.json` 和 `scripts/dispatch-easy-account-command.mjs`。

`natural`、`prd`、`design` 和 `full` 已开放；`fast` 仍为仅契约状态，接入配方前不得声称完成快速交付。处理 `/easy-account:prd` 时必须读取 `modules/easy-account/product/prd-standard.md`，产物固定为 `requirement.md`，不得自行省略模板章节或编造缺失信息。处理显式模式时还必须读取 `modules/easy-account/execution/mode-workflows.md` 并严格执行分发结果中的 `prepareCommand`、阶段资源和 `finalizeCommand`。

默认自然语言隔离是硬边界：`natural-generation` 不读取 PRD 标准或快捷模式规则，不运行模式准备/最终器，不创建 `mode-state.json`，仍只使用原有五阶段资源和 Page Spec 脚手架、构建命令。新增快捷模式不得给默认路径增加配方分类、文档校验或文件写入。

## 适用范围

- 产品名称可写为“易账通”“Yee账通”“yee账通”或 `Easy Account`，统一按易账通处理，不因中英文或大小写差异切换业务域。
- 本技能只服务易账通；技能被显式调用后，即使需求没有重复写产品名称，也默认归属易账通。
- 易账通账户、账务、余额、冻结/解冻、调账、对账和操作日志相关后台页面。
- 查询列表、普通表单、分组表单、详情页，以及已开放能力覆盖的交互流程。
- 新建页面、修改已有 `changes/{change-id}`、评审已有预览。

明确要求为老板管账、易来钱收银台、易宝开放平台等其他业务系统交付的请求不在本技能范围内。请求同时提到易账通和其他系统时，应根据用户明确指定的目标系统判断；无法确定目标时先确认，不得仅按关键词猜测。产品名称完全省略不构成域外条件。

## 工作流程

1. 先运行一次 `node scripts/dispatch-easy-account-command.mjs --request "<原始请求>"`。返回 `natural-generation` 时执行以下原有工作流；返回已开放的 `mode-selected` 时选择 Change、运行 `prepareCommand`、按返回阶段生成可编辑产物，再运行 `finalizeCommand`。返回未开放模式时只报告当前状态。
2. 读取 `modules/easy-account/DOMAIN.md`，再按当前任务阶段读取对应的导演规则、业务规则和执行上下文；涉及表单字段、组件或联动时读取 `modules/easy-account/execution/form-field-contract.md`；涉及新页面组合时额外读取 `modules/easy-account/execution/capability-model/capability-model.md` 及其机器可读契约；不要加载其他业务系统的规则、Shell 或主题。
3. 为新页面创建 `changes/YYYYMMDD-功能名称/`，写入需求、设计、规则读取记录和唯一可编辑的 `page-spec.json`。组合式页面可使用 `page-composition.json`，先运行结构校验；只有校验结果为 `preview-ready` 才能运行组合式构建器。已有 Change 直接沿用原目录，不创建重复 Change。
4. 使用固定脚本生成预览：

   ```bash
   node scripts/scaffold-easy-account-page-spec.mjs changes/{change-id}
   node scripts/build-easy-account-page-spec.mjs changes/{change-id}/page-spec.json
   ```

5. `page-spec.json` 是唯一编辑源；`preview.html`、`preview-app.js`、业务 CSS、Shell 文件和品牌资产都是派生产物，不手工修改。预览统一引用 `modules/easy-account/shell/vendor/` 的本地依赖，不在 Change 内重复生成 vendor。
6. 构建成功后停止在预览交付：只运行构建和静态完整性检查，不启动或控制浏览器，不调用 Playwright、截图或浏览器自动化进行验收。提供预览地址后，由业务人员独立完成人工验收；Agent 不等待、复核或代替人工验收。

## 规则边界

- `modules/easy-account/director-rules/` 是视觉、页面方案和交互验收的唯一设计决策来源。
- `modules/easy-account/execution/generation-policy.json` 决定页面家族和能力是否开放；规则存在不代表能力已开放。
- `scripts/lib/easy-account-capability-policy.mjs` 负责统一策略解析：简单请求走 `legacy-adapter`，命中 recipe 的请求走组合式 Page Spec，未登记组合进入能力缺口。
- `modules/easy-account/execution/capability-model/` 定义组合式页面的骨架、区域、能力、数据绑定和组合规则；其中 `model-only` 或 `declared-only` 能力不得宣称为可交付预览。
- 页面骨架、区域组合和跨页面流程继续受能力模型约束；字段组件是开放能力层，不受 recipe 或 capability registry 的枚举限制。只要需求位于已开放页面或浮层结构内，不得因为多选、级联、条件显隐、条件必填、动态选项、上传、日期、复选或其他 Ant Design 表单组件未被模板单独登记而报告能力缺口。
- 常用字段使用 `modules/easy-account/execution/form-field-contract.md` 的 `control`、条件和动态选项协议；未内置别名的 Ant Design 表单组件使用 `component` 与 JSON 可序列化的 `props`。Page Spec 不承载可执行函数；协议不足以表达新的交互原语时扩展固定运行时及测试，而不是限制产品需求或在 Page Spec 中注入脚本。
- 修改已有页面时，用户声明“不改变入口、结构或布局”即为硬约束；组件能力和字段联动只能在指定容器内扩展，不得借能力开放重构其他区域。
- 普通查询条件的展开/收起阈值固定为 3，不由具体页面覆盖；超过 3 个普通查询字段时默认全部展开并显示“收起”，收起后只保留前 3 个。主对象 `selectorFields` 不计入普通查询字段数量，展开/收起必须保留已输入值。
- 查询页统计必须按语义和数量拆分：`overview` 只表示当前主对象总览并位于普通查询条件上方，指标在总览区域内平铺；`summary` 只表示当前查询结果汇总。汇总指标不超过 3 条时替换查询列表标题，以 `14px` 的“查询汇总：标题 数值 单位｜…”展示，将数值设为主色并将 `｜` 分隔符设为 `#E4E4E7`；超过 3 条时位于完整查询条件模块下方、结果 Table 上方，以无灰色边框的独立圆角统计卡片展示，不显示区域标题或外层业务模块。不得互换语义、位置、样式或配置。
- `modules/easy-account/shell/` 是固定框架层，业务页面只能挂载到内容插槽，不能重绘导航、多标签、页脚或侧栏。
- Shell 中可见的一级菜单、二级菜单和顶部标签必须由当前用户需求及实际生成页面投影得到；不得把完整产品目录或示例标签默认渲染到单页预览。
- 不引用 Boss Ledger 的 Shell、Logo、vendor、主题 CSS 或规则。
- 不依赖外部 CDN 或远程图片；预览必须使用本技能内的品牌资产和本地 vendor。

## 参考资源

- 业务语义：`modules/easy-account/business-rules.md`
- 组件与前端约定：`modules/easy-account/components.md`、`modules/easy-account/frontend.md`
- 视觉与交互：`modules/easy-account/director-rules/`
- 生成契约：`modules/easy-account/execution/page-spec.schema.json`
- 开放字段契约：`modules/easy-account/execution/form-field.schema.json`、`modules/easy-account/execution/form-field-contract.md`
- 组合式生成契约：`modules/easy-account/execution/capability-model/page-composition.schema.json`、`data-binding.schema.json`
- 组合式运行时：`modules/easy-account/execution/renderer/page-composition-runtime.js`、`page-composition-business.css`
- 页面族上下文：`modules/easy-account/execution/context-packs/`
- 固定渲染器与壳层：`modules/easy-account/execution/renderer/`、`modules/easy-account/shell/`

## 划词批注修改工作流（本机扩展）

在预览页面上划词提修改意见，AI 根据批注修改 `page-spec.json` 后重建。批注机制参考 doc-annotate 技能，服务实现为本技能专属（SPA 场景，含静态资源服务）。

1. **启动批注服务**：`bash scripts/start-annotate.sh changes/{change-id}/preview.html`，输出 `OK <port> <pid>` 后用 `present_files` 展示 `http://127.0.0.1:<port>`。注意：在受限执行环境内启动时，必须用后台任务方式直接运行 `node scripts/annotate-preview-server.js <preview.html> --port <port>`（start.sh 的脱离进程方式会因执行上下文关闭而失败）。
2. **用户操作**：划选页面文字 → 点「添加批注」→ 写修改意见 → 保存；右下角「批注」徽标打开批注列表，点条目可定位原文。
3. **批注存储**：`changes/{change-id}/.preview.html.comments.json`，字段 `{ id, text, comment, timestamp, resolved, page }`；重建预览不清空批注。
4. **AI 处理循环**：读批注文件获取未处理条目 → 逐条理解意图并修改 `page-spec.json`（唯一编辑源）→ 运行构建脚本 → 将已处理批注标记 `resolved: true` → 向用户汇报每条批注的处理结果；有歧义的批注先询问，不猜。
5. **边界**：批注只驱动 `page-spec.json` 修改，不手改派生产物；涉及 Shell 菜单/导航的批注改 `shell.primaryNav` / `shell.sideNav`；能力缺口类批注如实报告，不绕过策略。

## 页面自动抓取（本机扩展）

复刻线上页面时，优先用自动抓取拿到真实结构，不依赖用户截图。工具在本机 `~/.workbuddy/tools/page-capture/capture-page.mjs`（Playwright + 本机 Edge 独立 Profile，不随本仓库分发）。

1. **登录态**：首次或失效时运行 `node capture-page.mjs login`（后台任务方式启动，避免安装检查被锁文件卡住），弹出浏览器窗口由用户人工登录（滑块/验证码均可）；脚本连续两次（间隔 3 秒）确认脱离登录页后保存持久化 Profile 并备份 sessionStorage。
2. **抓取**：`node capture-page.mjs capture --url <页面URL> --out <目录> [--wait 毫秒] [--full] [--click "Tab名"]`。产物：`shot.png`（截图）、`dom.html`（渲染后 DOM）、`summary.json`（结构化摘要：框架识别 / Tab / 菜单 / 列头 / 查询字段 / 按钮 / 数据行样例）。
3. **使用产物**：以 `summary.json` + 截图为复刻依据写入 `page-spec.json`，比截图方式更准（真实字段名、真实列头堆叠结构）。
4. **边界**：登录态过期会在抓取时明确报错（重定向到登录页），不静默输出登录页假数据；页面用 VXE-Table 或自定义表单时摘要器已兼容；交互流程（多步操作、弹窗层级）无法只靠抓取还原，仍需用户口头描述或截图补充。
5. **交互抓取**：涉及单选/下拉联动的页面，可用抓下来的 DOM 逐个点击控件，把展开后的选项和联动后的字段变化写入 `page-spec.json` 的 `visibleWhen` / `labelBy` / `primaryLabelBy`（渲染器已支持）；不要凭截图猜选项。联动规则用**状态矩阵遍历**验证：每个控件的每个取值都和其他相关控件状态交叉一遍（含禁用项点击、切换后的值归位），防止只点一遍漏掉规则；选项级禁用用 `optionDisableBy` + `autoPick` 表达（真实页面通常是灰显禁用 + 自动归位，不是隐藏选项）。

## 失败处理

- 页面家族处于 `pending`、`workflow-only` 或 `legacy` 时，报告能力缺口，不绕过策略生成候选页面。
- Page Spec 和派生产物由构建脚本生成；如预览不符合需求，直接修改 `page-spec.json` 后重新构建。
- 预览交互和整体视觉需由业务人员人工验收；未确认的部分标记为待验收。
- 查询列表结果区默认标题固定为“查询列表”；只有需求明确指定其他标题时，才使用自定义标题。
- Table 列字段默认必须完整展示，允许按列宽折行；禁止默认使用省略号隐藏字段内容。需要保持单行的操作列、状态 Tag 等控件可单独声明。
- Table 中 `format: "amount"` 的金额列，表头与表体统一右对齐；同币种列默认把单位放在表头字段名后，使用英文半角括号且不留空格，例如“已分账金额(元)”，单元格不重复显示单位。其他单位通过列的 `unit` 明确声明；混合币种列不得使用固定单位表头，必须逐行显示币种。
- Table 分页统一为左右分布：左侧显示“共 X 条”统计，右侧使用 Ant Design Pagination 的页码、页大小切换和更多分页控件；切换每页条数后回到第 1 页。
