---
name: ossup
description: >-
  Uploads local files to Aliyun OSS via the ossup MCP server (presigned PUT),
  lists objects and directory prefixes, and resolves multi-account profiles.
  Use when the user mentions OSS, Aliyun upload, 阿里云, 图床, object storage,
  ossup, or wants to put images/files on their bucket and get a public URL.
---

# ossup — 阿里云 OSS 直传

## 前置条件

1. 用户本机已安装 Node.js 18+。
2. 终端已执行 `npx ossup setup`（注册 MCP，并将本 Skill 链接到 `~/.cursor/skills/ossup` 与 `~/.claude/skills/ossup`，**无需**复制到项目目录）。
3. Cursor / Claude Desktop 的 `mcp.json` 已包含 **ossup**；凭证在 `~/.config/ossup/profiles/`，**禁止**在对话中向用户索要 AccessKey。

未配置时：请用户在**终端**执行 `npx ossup setup`，然后重启 IDE / 新开 Agent 会话。可调用 `get_setup_status` 检查；用户本机可运行 `ossup doctor` 做完整诊断。

## 选用哪个 profile

解析顺序（高 → 低）：工具参数 `profile` → 环境变量 `OSSUP_PROFILE` → 项目根 `.ossup.json` → 全局 `defaultProfile`。

不确定时先调用 `list_profiles`，查看 `activeProfile` 与 `projectFile`。

## 工具选用（默认路径）

| 用户意图 | 工具 | 备注 |
|----------|------|------|
| 上传本地文件 | `upload_file` | 传 `localPath`；可选 `subdir` |
| 看桶里有什么文件 | `list_objects` | 图片预览用 `format=markdown` |
| 看有哪些目录前缀 | `list_directories` | 树形用 `format=markdown` |
| 检查配置 / MCP | `get_setup_status` | |
| 列出所有账号 | `list_profiles` | |
| 高级：自管 PUT | `prepare_upload` → curl → `confirm_upload` | 一般不必 |

所有工具均可选 `profile` 覆盖当前项目绑定。

## 对象路径规则（重要）

最终 Key 形如：

```text
{profile.prefix}{subdir}{YYYY}/{MM}/{uuid}.{ext}
```

- `prefix`：profile 里配置的对象前缀，`/` 表示 Bucket 根目录。
- `subdir`：上传/列表时传入的子目录，如 `ossup_test` → 实际为 `ossup_test/`。
- 文件名默认 **UUID**，不是原文件名；会在 `subdir` 下再按 **UTC 年/月** 分子目录。

向用户说明 URL 时，以工具返回的 `objectUrl` / `objectKey` 为准。

## 安全与限制

- 勿上传：`.env`、密钥文件、含 `credentials`/`secret` 等敏感路径（工具会拒绝）。
- 单文件 ≤ **100MB**；仅支持单次 Presigned PUT（无分片）。
- 使用 RAM 子账号，权限收窄到目标 Bucket 与前缀。

## 常见问题

| 现象 | 处理 |
|------|------|
| MCP 工具不可用 | 用户执行 `ossup status`；重启 IDE；确认 `mcp.json` 指向有效 `dist/index.js` 或 `npx ossup` |
| `not configured` | 终端 `npx ossup setup` |
| 路径与预期不符 | 见上文「对象路径规则」；`list_objects` 用相同 `subdir` 查询 |
| 多账号 | `profile add` / `profile use`；或工具传 `profile` |

## 更多说明

- 配置结构、CLI 命令：见仓库 [README.md](../../../README.md)
- 工具参数与示例：见 [reference.md](reference.md)
