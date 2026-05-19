# Changelog

## Unreleased

### Added

- 官网：<https://devoink.github.io/ossput/>（`docs/` + GitHub Pages）
  - shadcn 深色主题、Hero macOS 终端（ASCII Logo、循环打字动效）
  - 能力 / MCP 工具表 / 多包管理器安装 Tab / RAM 策略板块
  - 支持 Agent 标签（Cursor、Claude Code、Claude Desktop）
- `npm run docs:dev`：本地预览官网
- `docs/assets/logo.png`：官网与 favicon 品牌图

### Changed

- README：OSSPUT 定位、多方式安装表、官网与本地预览说明
- 产品文案统一为「开发时由 Agent 管理 OSS 文件」

## 0.0.1

### Added

- MCP：`upload_file`、`batch_upload_file`、`delete_object`、`list_objects`、`list_directories`、`list_profiles`、`get_setup_status`、`prepare_upload`、`confirm_upload`
- CLI：`setup`、`status`、`put`（多文件）、`rm --confirm`、`ls`、`dirs`、`profile`、`doctor`、`skill install`
- 多账号：`~/.config/ossput/profiles/` + 项目 `.ossput.json`；环境变量 `OSSPUT_PROFILE`、`OSSPUT_MCP`
- Setup 向导：MCP 注册（Cursor / Claude Code）、连通性检测、可选 `publicBaseUrl` / `allowDelete`
- Agent Skill：`.cursor/skills/ossput/`；`setup` 自动安装到用户目录（符号链接）
- `docs/ram-policy.example.json`：RAM 最小权限策略示例
- CI：Ubuntu（Node 18/20/22）+ Windows 冒烟

### Changed

- 上传使用 Node 内置 `fetch`（Node 18+），不依赖系统 `curl`
- MCP 工具 `annotations`；失败返回 `isError` 与可执行提示

### Notes

- 上传对象 Key：`{prefix}{subdir}{YYYY}/{MM}/{uuid}.{ext}`
- 单文件上限 100MB；删除需在 profile 开启 `allowDelete` 且 MCP/CLI 显式确认
