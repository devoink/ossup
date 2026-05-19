# OSSUP (`ossup`)

[![CI](https://github.com/devoink/ossup/actions/workflows/ci.yml/badge.svg)](https://github.com/devoink/ossup/actions/workflows/ci.yml)

Aliyun OSS direct upload for AI agents — MCP server + CLI. Presigned PUT + curl. **Credentials live in `~/.config/ossup/profiles/`**, not in `mcp.json`.

## Quick start

```bash
npx -y ossup setup
```

向导会：创建第一个 **profile**（账号）→ 检测连通性 → 注册 MCP → 可选写入项目 `.ossup.json`。

完成后 **重启 IDE**，确认 **ossup** MCP 已连接。

```bash
ossup put ./photo.png --subdir demo/2026-05
```

## AI Agent：MCP 与 Skill

| 能力 | 作用 | 如何启用 |
|------|------|----------|
| **MCP** | `upload_file` 等工具 | `npx ossup setup` 注册到 Cursor / Claude Desktop，重启 IDE |
| **Skill** | 教 Agent 何时用 MCP、路径规则 | **`setup` 会自动安装到本机用户目录**（无需复制到项目） |

```bash
npx ossup setup              # OSS 配置 + MCP + Skill（用户级）
npx ossup skill install      # 仅重装 Skill（升级 npm 包后可选）
npx ossup setup --skip-skill # 不要安装 Skill
```

安装位置（符号链接指向 npm 包内 Skill，升级包后链接仍有效）：

- Cursor：`~/.cursor/skills/ossup/`
- Claude Code：`~/.claude/skills/ossup/`（可用 `/ossup` 调用）

**不需要**把 `SKILL.md` 复制进每个项目的 `.cursor/skills/`。仓库内的 `.cursor/skills/ossup/` 仅用于开发与 npm 打包。

Agent 细则见 [AGENTS.md](./AGENTS.md)。

### Claude Code 的 MCP

`ossup setup` 可将 MCP 写入 **`~/.claude.json`**（与 Cursor 的 `~/.cursor/mcp.json` 并列）。向导中勾选 **Claude Code** 即可；也可事后重新运行 `npx ossup setup` 仅注册 MCP。

若未自动注册，可手动在 `~/.claude.json` 的 `mcpServers` 中加入与 Cursor 相同的 `node` + `dist/index.js` 条目。

### Agent 须知（摘要）

- 未配置 → 终端 `npx ossup setup`，**勿在对话中索要 AccessKey**
- 上传 → MCP `upload_file`；看图 → `list_objects`（`format=markdown`）
- 对象 Key：`{prefix}{subdir}{年}/{月}/{uuid}.ext`

## 多账号 / 多项目

| 文件 | 说明 |
|------|------|
| `~/.config/ossup/config.json` | 索引：`defaultProfile` + profile 列表（无密钥） |
| `~/.config/ossup/profiles/{name}.json` | 单账号 OSS 配置（chmod 600） |
| `{repo}/.ossup.json` | 项目绑定：`{ "profile": "default" }`（可提交 Git） |

**解析优先级：** CLI/MCP 的 `profile` 参数 → `OSSUP_PROFILE` → 项目 `.ossup.json` → 全局 `defaultProfile`

```bash
ossup profile add client-a      # 新增账号
ossup profile list              # 列出账号
ossup profile use default       # 当前目录写 .ossup.json
ossup --profile client-a put ./x.zip
```

示例见 [config.index.example.json](./config.index.example.json)、[profiles.example/default.json](./profiles.example/default.json)、[.ossup.json.example](./.ossup.json.example)。

## MCP tools

| Tool | Description |
|------|-------------|
| `upload_file` | Upload local file |
| `list_objects` | List files (`format=markdown` for image previews) |
| `list_directories` | List folder prefixes |
| `list_profiles` | List profiles + active profile in cwd |
| `get_setup_status` | Config + MCP registration |
| `prepare_upload` / `confirm_upload` | Advanced presign flow |

All tools accept optional `profile` to override `.ossup.json`.

## MCP configuration (manual)

```json
{
  "mcpServers": {
    "ossup": {
      "command": "node",
      "args": ["/absolute/path/to/ossup/dist/index.js"]
    }
  }
}
```

## CLI

```bash
ossup setup
ossup profile list|add|show|use|default|rm
ossup status
ossup doctor
ossup put <file> [--subdir x]
ossup ls [subdir] [--markdown] [--images]
ossup dirs [subdir] [--markdown]
ossup --profile <name> <command>
```

## Security

- Use RAM users scoped to bucket prefix (`PutObject` / `HeadObject`).
- Do not paste AccessKeys into chat; use `setup` / `profile add` in terminal.
- Commit `.ossup.json` only; never commit `profiles/*.json`.

## Limits

- Single file ≤ 100MB
- Presigned single PUT only (v1)
- Upload requires **curl** in `PATH` (Windows 10+ usually includes `curl.exe`)
- CDN / 自定义域名：在 profile JSON 设置 `publicBaseUrl`（如 `https://cdn.example.com`）

## Windows

在 Windows 上路径通过 `%USERPROFILE%`（`os.homedir()`）解析，与 macOS/Linux 使用同一套逻辑，**未在 Windows CI 中完整验证**，以下为典型位置：

| 用途 | 典型路径 |
|------|----------|
| OSS 配置 | `%USERPROFILE%\.config\ossup\` |
| Cursor MCP | `%USERPROFILE%\.cursor\mcp.json` |
| Claude Desktop MCP | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor Skill | `%USERPROFILE%\.cursor\skills\ossup\` |
| Claude Code Skill | `%USERPROFILE%\.claude\skills\ossup\` |

说明：

- `.cursor`、`.config` 为隐藏文件夹，可在资源管理器中开启「隐藏的项目」，或在地址栏输入 `%USERPROFILE%\.cursor`。
- Skill 安装优先创建 **junction**；失败时自动 **复制** 到上述目录（升级 npm 后若用复制方式，需再执行 `ossup skill install`）。
- `chmod 600` 在 Windows 上权限语义较弱，请勿依赖其做访问控制；仍请勿将 `profiles/*.json` 提交到 Git。
- 上传失败且提示未找到 curl：在 PowerShell 运行 `curl --version`；若无输出，安装 [Git for Windows](https://git-scm.com/download/win) 或确保系统自带 curl 在 PATH 中。

## 对象路径说明

`ossup put ./a.png --subdir ossup_test` 实际上传 Key 类似：

```text
ossup_test/2026/05/<uuid>.png
```

（另加 profile 配置的 `prefix`。）列表与上传使用相同 `subdir` 才能对齐。

## Local development

```bash
cd ossup
npm ci && npm run build
node dist/index.js setup
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT
