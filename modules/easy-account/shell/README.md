# 易通账 Easy Account Shell

该文件包按 Figma 节点 `29:4610` 的框架层重新实现，适用于 Yee账通 PC 管理后台页面。默认预览只展示 Shell，不注入业务内容。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `shell.css` | 224px 左侧导航、50px 多标签栏、内容区、页脚和折叠状态 |
| `content-base.css` | 卡片、按钮、输入框、状态等通用内容组件 |
| `business.css` | 查询列表预览业务样式，可替换 |
| `wizard-business.css` | 向导页业务样式示例 |
| `shell-runtime.js` | 渲染 Shell、Ant Design 图标、标签切换/关闭、菜单展开和侧栏折叠 |
| `shell-config.example.js` | 品牌、多标签、菜单、账号和页脚配置 |
| `preview.template.html` | 无需构建工具的纯 Shell 预览入口 |
| `preview-app.template.js` | 可选查询列表内容模板，不在默认预览中加载 |
| `preview-app.js` | 纯 Shell 预览启动文件 |
| `assets/logo-txt@3x.png` | 侧栏展开时显示的完整品牌 Logo |
| `assets/logo.png` | 侧栏收起时显示的方形品牌 Icon |
| `vendor/` | Easy Account 独立维护的 React 18、Ant Design 5 与 Ant Design Icons 本地依赖 |

## Ant Design 约定

- 框架图标统一使用 `@ant-design/icons`，配置项使用完整组件名，例如 `ApartmentOutlined`。
- 默认使用 `Outlined` 风格；固定等明确选中状态可使用 `Filled`。
- 不使用 Emoji、Unicode 字符、CSS 手绘图标或外部 CDN。
- 业务内容使用 `ConfigProvider` + `App` 挂载 Ant Design 组件，主题 Token 以 `design.md` 为准。
- 业务内容根节点默认使用透明背景，继承 Shell 的 `--ea-bg`；仅查询区、列表区等实际模块使用白底。

## 本地预览

直接打开 `preview.template.html`，或在当前目录启动静态服务器：

```bash
python3 -m http.server 8080
```

访问 `http://localhost:8080/preview.template.html`。

## 多标签能力

- 点击标签切换激活态，并触发 `easyaccount:tabchange`。
- 点击关闭按钮关闭标签，并触发 `easyaccount:tabclose`。
- 固定标签不能关闭，当前标签关闭后自动激活左侧相邻标签。
- 键盘 `←` / `→` 切换标签，`Delete` 关闭当前标签。
- 通过 `contentByTab` 或单个标签的 `content` 字段挂载不同业务内容。
- `mount()` 返回 `activateTab()`、`closeTab()`、`getTabs()` 等运行时 API。

## 接入方式

1. 修改 `shell-config.example.js` 中的标签、导航和账号信息。
2. 在业务脚本中创建 DOM 节点。
3. 调用 `EasyAccountShell.mount({ content })` 挂载默认业务内容；React 业务内容可在返回的 `contentSlot` 中创建 Root。
4. 框架规则只写入 `shell.css`，页面专属样式写入独立业务 CSS。

## 框架固定值

- 设计基准：1440px PC 管理后台
- 左侧导航：224px；折叠宽度 56px
- 小于 1024px 时默认折叠；手机端展开侧栏以浮层形式覆盖内容
- 多标签栏：50px
- 内容背景：`#F1F3F6`
- 品牌主色：`#006BE6`
- 菜单项高度：42px
- 当前标签背景：`rgba(0, 107, 230, 0.15)`
- 默认菜单状态：企业管理、财务管理均展开
