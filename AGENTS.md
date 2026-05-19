# Agent 说明（ossput）

本仓库提供 **ossput**：阿里云 OSS Presigned 直传的 MCP 服务 + CLI。

## 上传到 OSS 时

1. 确认 **ossput** MCP 已连接；未配置则让用户在终端运行 `npx ossput setup`（**不要**在对话里要 AccessKey）。`setup` 会把 Skill 装到 `~/.cursor/skills/ossput`（无需复制到项目目录）。
2. 遵循用户级 Skill（`~/.cursor/skills/ossput/SKILL.md`，或本仓库开发版 [.cursor/skills/ossput/SKILL.md](.cursor/skills/ossput/SKILL.md)）：
   - 优先 `upload_file`
   - 先 `list_profiles` / 读 `.ossput.json` 确定 profile
   - 注意 `subdir` 下会自动加 `年/月/UUID` 路径

## 文档

- 人类用户：[README.md](README.md)
- Agent 细则：`.cursor/skills/ossput/SKILL.md`、`reference.md`
