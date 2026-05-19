# Changelog

## Unreleased

### Changed

- 上传改用 Node 内置 `fetch` 执行 Presigned PUT，不再依赖系统 `curl`

## 0.0.1

### Added

- MCP server：`upload_file`、`list_objects`、`list_directories`、`list_profiles`、`get_setup_status`、`prepare_upload`、`confirm_upload`
- CLI：`setup`、`status`、`put`、`ls`、`dirs`、`profile`、`doctor` 子命令
- 多账号：`~/.config/ossup/profiles/` + 项目 `.ossup.json` 绑定
- Setup 向导：MCP 注册、连通性检测、profile 复用 AK
- Agent Skill：`.cursor/skills/ossup/SKILL.md`；`setup` / `ossup skill install` 自动安装到用户目录（符号链接）
- Profile 可选 `publicBaseUrl`：自定义 CDN 域名生成 `objectUrl`
- `ossup doctor`：诊断 Node、curl、配置、MCP、Skill 与 Bucket 连通性
- MCP 工具失败返回 `isError: true` 与可执行「下一步」提示
- `setup` 支持注册 Claude Code（`~/.claude.json`）
- Skill 补充 [examples.md](.cursor/skills/ossup/examples.md)
- README：Windows 路径说明；`curl` 未找到时的分平台错误提示

### Notes

- 上传对象 Key 默认：`{prefix}{subdir}{YYYY}/{MM}/{uuid}.{ext}`
- 单文件上限 100MB，Presigned 单次 PUT
