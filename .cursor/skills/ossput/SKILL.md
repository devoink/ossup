---
name: ossput
description: >-
  Uploads local files to Aliyun OSS via the ossput MCP server (presigned PUT),
  lists objects and directory prefixes, and resolves multi-account profiles.
  Use when the user mentions OSS, Aliyun upload, 阿里云, 图床, object storage,
  ossput, or wants to put images/files on their bucket and get a public URL.
---

# ossput — 阿里云 OSS 直传

## 前置条件

1. 用户本机已安装 Node.js 18+。
2. 终端已执行 `npx ossput setup`（注册 MCP，并将本 Skill 链接到 `~/.cursor/skills/ossput` 与 `~/.claude/skills/ossput`，**无需**复制到项目目录）。
3. Cursor / Claude Desktop 的 `mcp.json` 已包含 **ossput**；凭证在 `~/.config/ossput/profiles/`，**禁止**在对话中向用户索要 AccessKey。

未配置时：请用户在**终端**执行 `npx ossput setup`，然后重启 IDE / 新开 Agent 会话。可调用 `get_setup_status` 检查；用户本机可运行 `npx ossput doctor` 做完整诊断。

## 选用哪个 profile

解析顺序（高 → 低）：工具参数 `profile` → 环境变量 `OSSPUT_PROFILE` → 项目根 `.ossput.json` → 全局 `defaultProfile`。

不确定时先调用 `list_profiles`，查看 `activeProfile` 与 `projectFile`。

## 工具选用（默认路径）

| 用户意图 | 工具 | 备注 |
|----------|------|------|
| 上传单个本地文件 | `upload_file` | 传 `localPath`；可选 `subdir` |
| 上传多个本地文件 | `batch_upload_file` | `localPaths` 数组，单次最多 20 个 |
| 看桶里有什么文件 | `list_objects` | 图片预览用 `format=markdown` |
| 删除误传对象 | `delete_object` | **见下文「删除安全」**；默认关闭 |
| 看有哪些目录前缀 | `list_directories` | 树形用 `format=markdown` |
| 检查配置 / MCP | `get_setup_status` | |
| 列出所有账号 | `list_profiles` | |
| 高级：自管 PUT | `prepare_upload` → HTTP PUT → `confirm_upload` | 一般不必 |

所有工具均可选 `profile` 覆盖当前项目绑定。

## 对象路径规则（重要）

最终 Key 形如：

```text
{profile.prefix}{subdir}{YYYY}/{MM}/{uuid}.{ext}
```

- `prefix`：profile 里配置的对象前缀，`/` 表示 Bucket 根目录。
- `subdir`：上传/列表时传入的子目录，如 `ossput_test` → 实际为 `ossput_test/`。
- 文件名默认 **UUID**，不是原文件名；会在 `subdir` 下再按 **UTC 年/月** 分子目录。

向用户说明 URL 时，以工具返回的 `objectUrl` / `objectKey` 为准。

## 安全与限制

- 勿上传：`.env`、密钥文件、含 `credentials`/`secret` 等敏感路径（工具会拒绝）。
- 单文件 ≤ **100MB**；仅支持单次 Presigned PUT（无分片）。
- 使用 RAM 子账号，权限收窄到目标 Bucket 与前缀。

## 删除安全（delete_object）

删除为**破坏性操作**，须同时满足：

1. Profile 中 **`allowDelete: true`**（默认 `false`，在 `~/.config/ossput/profiles/<name>.json` 手动开启）。
2. 工具参数 **`confirm: true`** — 仅在用户**明确确认**要删该 `objectKey` 后传入。
3. **`objectKey` 必须完整且准确** — 优先从 `list_objects` 或上传返回值复制，不要猜路径。
4. **Key  scoped 到 profile 的 `prefix`** — 不能删除前缀外的对象；若 `prefix` 为桶根，还须至少 `子目录/文件名` 两段路径。

**Agent 流程：** `list_objects` 展示 Key → 向用户确认 → 再 `delete_object`。若 `allowDelete` 为 false，提示用户在终端编辑 profile 开启（勿在对话中要 AK）。

RAM 策略仅授予 `DeleteObject` 到必要前缀，与 `PutObject` 同级收窄。

## 常见问题

| 现象 | 处理 |
|------|------|
| MCP 工具不可用 | 用户执行 `npx ossput status`；重启 IDE；确认 `mcp.json` 指向有效 `dist/index.js` |
| `not configured` | 终端 `npx ossput setup` |
| 路径与预期不符 | 见上文「对象路径规则」；`list_objects` 用相同 `subdir` 查询 |
| 多账号 | `profile add` / `profile use`；或工具传 `profile` |

## 更多说明

- 配置结构、CLI 命令：见仓库 [README.md](../../../README.md)
- 工具参数：见 [reference.md](reference.md)
- 对话示例与反模式：见 [examples.md](examples.md)
