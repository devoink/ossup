# Changelog

## Unreleased

### Added

- `ossup doctor`：诊断 Node、curl、配置、MCP、Skill 与 Bucket 连通性
- Profile 可选 `publicBaseUrl`：自定义 CDN 域名生成 `objectUrl`

## 1.0.0

### Added

- MCP server：`upload_file`、`list_objects`、`list_directories`、`list_profiles`、`get_setup_status`、`prepare_upload`、`confirm_upload`
- CLI：`setup`、`status`、`put`、`ls`、`dirs`、`profile` 子命令
- 多账号：`~/.config/ossup/profiles/` + 项目 `.ossup.json` 绑定
- Setup 向导：MCP 注册、连通性检测、profile 复用 AK
- Agent Skill：`.cursor/skills/ossup/SKILL.md`；`setup` / `ossup skill install` 自动安装到用户目录（符号链接）
- README：Windows 路径说明；`curl` 未找到时的分平台错误提示

### Notes

- 上传对象 Key 默认：`{prefix}{subdir}{YYYY}/{MM}/{uuid}.{ext}`
- 单文件上限 100MB，Presigned 单次 PUT
