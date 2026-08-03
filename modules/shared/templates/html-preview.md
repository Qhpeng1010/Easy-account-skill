# HTML Preview Template

## Purpose

本模板只描述通用预览交付，不定义任何系统的 Shell、样式、组件、脚手架或验证命令。

## Required Inputs

- Change title: `{{change_title}}`
- Original request: `{{user_request}}`
- Routed system: `{{module}}`
- System design source: `{{theme_source}}`
- Selected page solution: `{{page_type}}`
- Page design source: `changes/{{change_id}}/page-design.md`

## Rules

- 通过当前系统 `domain.json` 返回的命令生成预览。
- 只使用当前系统的组件、运行时、资源和固定实现。
- Page Spec 模式只修改 `page-spec.json`，其余预览文件一律视为构建产物。
- 预览应覆盖本次需求的核心信息、操作和状态，不接入真实接口，除非用户明确要求。
- 预览不应引入其他系统主题、历史 Change 或临时占位框架。
