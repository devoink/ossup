# ossput

[![CI](https://github.com/devoink/ossput/actions/workflows/ci.yml/badge.svg)](https://github.com/devoink/ossput/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ossput)](https://www.npmjs.com/package/ossput)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**[官网](https://devoink.github.io/ossput/)** · [npm](https://www.npmjs.com/package/ossput) · [更新日志](./CHANGELOG.md)

**OSSPUT**（npm 包名 `ossput`）面向日常开发：在 **Cursor、Claude Code、Claude Desktop** 里用 AI **上传、列举、管理** 阿里云 OSS 上的文件（截图、附件、构建产物等），并拿到可引用的 `objectUrl`。提供 MCP 工具、CLI 与 Agent Skill；**AccessKey 只存在本机** `~/.config/ossput/profiles/`，不写入 `mcp.json`，也不应在对话里粘贴密钥。需要 Node.js 18+。

---

## 目录

- [适用场景](#适用场景)
- [快速开始](#快速开始)
- [官网](#官网)
- [架构说明](#架构说明)
- [配置与多账号](#配置与多账号)
- [MCP 工具](#mcp-工具)
- [命令行 CLI](#命令行-cli)
- [对象路径规则](#对象路径规则)
- [安全](#安全)
- [限制](#限制)
- [Windows](#windows)
- [本地开发](#本地开发)
- [许可证](#许可证)

---

## 适用场景

| 场景 | 做法 |
|------|------|
| 写 README / 文档时让 Agent 传插图 | 连接 **ossput** MCP，说明目录；Agent 调用 `upload_file` 返回链接 |
| 开发中快速看图床里有什么 | `list_objects`（`format=markdown`）在对话里预览 |
| 前后端协作、多环境 Bucket | 多个 **profile** + 项目 `.ossput.json` 绑定 |
| 不用 Agent、脚本式上传 | `ossput put a.png b.png --subdir demo/` |
| 换机器或升级包后检查 | `ossput doctor` |

---

## 快速开始

### 环境

- **Node.js 18+**（使用内置 `fetch`，无需安装 curl）

### 1. 初始化

任选一种方式运行交互向导 `setup`（**推荐 npx**，无需全局安装）：

| 方式 | 命令 |
|------|------|
| **npx**（推荐） | `npx -y ossput setup` |
| **npm** 全局 | `npm install -g ossput` → `ossput setup` |
| **npm** 不全局 | `npm exec ossput -- setup` |
| **yarn** | `yarn dlx ossput setup` 或 `yarn global add ossput` |
| **pnpm** | `pnpm dlx ossput setup` 或 `pnpm add -g ossput` |
| **bun** | `bunx ossput setup` 或 `bun add -g ossput` |

向导会依次完成：

1. 创建第一个 **profile**（RAM 子账号 AK、Region、Bucket、对象前缀等）
2. 检测 Bucket 连通性
3. 注册 MCP 到 Cursor / Claude Code（可选 Claude Desktop）
4. 将 Agent Skill 链接到 `~/.cursor/skills/ossput`（无需复制进每个项目）
5. 可选：在当前项目写入 `.ossput.json`

完成后 **重启 IDE**，在 MCP 列表中确认 **OSSPUT** MCP 已连接。

### 2. 终端试传

```bash
ossput put ./photo.png --subdir demo/
```

### 3. 诊断

```bash
ossput doctor
```

---

## 官网

产品说明与安装示例见 **[devoink.github.io/ossput](https://devoink.github.io/ossput/)**（源码在 [`docs/`](./docs/)，GitHub Pages 自动部署）。

页面包含：能力概览、MCP 工具表、多包管理器安装 Tab、RAM 策略 JSON 示例、Hero 终端演示等。

**本地预览官网**（静态文件，无需 build）：

```bash
npm run docs:dev
# 浏览器打开 http://localhost:5173
```

或：

```bash
npx serve docs
```

首次部署需在仓库 **Settings → Pages → Build and deployment → Source: GitHub Actions**（工作流见 [`.github/workflows/pages.yml`](./.github/workflows/pages.yml)）。

---

## 架构说明

```text
┌─────────────┐     MCP (stdio)      ┌──────────────┐
│ Cursor /    │ ◄──────────────────► │ ossput       │
│ Claude …    │   upload_file 等     │ (dist/index) │
└─────────────┘                      └──────┬───────┘
                                            │ 上传 / 列表 / 删除
                                            ▼
                                     ┌──────────────┐
                                     │ 阿里云 OSS    │
                                     └──────────────┘

凭证：~/.config/ossput/profiles/{name}.json
Skill：教 Agent 在开发对话中何时上传、如何选 profile 与 subdir
```

| 组件 | 作用 |
|------|------|
| **MCP** | Agent 在 IDE 内管理 OSS 文件（上传、列表、删除等） |
| **Skill** | 约束 Agent 在开发场景下的用法（`setup` 自动安装） |
| **CLI** | 同一套配置下的终端操作与诊断 |

```bash
npx ossput setup              # 配置 + MCP + Skill
npx ossput skill install      # 仅重装 Skill（升级 npm 包后可选）
npx ossput setup --skip-skill # 不安装 Skill
```

**Skill 安装位置**（符号链接，升级包后仍指向新版本）：

- Cursor：`~/.cursor/skills/ossput/`
- Claude Code：`~/.claude/skills/ossput/`（可用 `/ossput` 调用）

Agent 开发细则见 [AGENTS.md](./AGENTS.md)。

### Claude Code MCP

`setup` 可写入 `~/.claude.json` 的 `mcpServers`。未自动注册时，在 `mcpServers` 中加入与 Cursor 相同的 `node` + `dist/index.js` 条目即可。

---

## 配置与多账号

| 路径 | 说明 |
|------|------|
| `~/.config/ossput/config.json` | 索引：`defaultProfile` + profile 列表（**不含密钥**） |
| `~/.config/ossput/profiles/{name}.json` | 单账号 OSS 配置（建议权限 `600`） |
| `{项目根}/.ossput.json` | 项目绑定：`{ "profile": "default" }`（**可提交 Git**） |

**Profile 解析优先级**（高 → 低）：

1. CLI / MCP 参数 `profile`
2. 环境变量 `OSSPUT_PROFILE`
3. 项目 `.ossput.json`
4. 全局 `defaultProfile`

```bash
ossput profile add client-a    # 新增账号
ossput profile list          # 列出
ossput profile use default   # 当前目录写入 .ossput.json
ossput --profile client-a put ./x.zip
```

示例文件：[config.index.example.json](./config.index.example.json)、[profiles.example/default.json](./profiles.example/default.json)、[.ossput.json.example](./.ossput.json.example)。

Profile 可选字段：

- `publicBaseUrl`：自定义 CDN 域名生成 `objectUrl`
- `allowDelete`：是否允许 `delete_object` / `ossput rm`（默认 `false`）

---

## MCP 工具

| 工具 | 说明 |
|------|------|
| `upload_file` | 上传本地单个文件 |
| `batch_upload_file` | 批量上传（单次最多 20 个） |
| `delete_object` | 删除对象（需 `allowDelete` + `confirm: true`） |
| `list_objects` | 列举文件；`format=markdown` 可预览图片 |
| `list_directories` | 列举目录前缀 |
| `list_profiles` | 列出 profile 与当前目录生效账号 |
| `get_setup_status` | 配置与 MCP 注册状态 |
| `prepare_upload` / `confirm_upload` | 高级 Presign 流程 |

所有工具均支持可选参数 `profile`，用于覆盖 `.ossput.json`。

### 手动配置 MCP（可选）

一般由 `ossput setup` 自动写入；手动示例：

```json
{
  "mcpServers": {
    "ossput": {
      "command": "node",
      "args": ["/absolute/path/to/node_modules/ossput/dist/index.js"]
    }
  }
}
```

全局安装时，将 `args` 改为本机 `ossput` 包内的 `dist/index.js` 绝对路径（`npm root -g` 下查找）。

---

## 命令行 CLI

```bash
ossput setup
ossput profile list | add | show | use | default | rm
ossput status
ossput doctor
ossput put <file> [file2 …] [--subdir 目录] [--stop-on-error]
ossput rm <objectKey> --confirm
ossput ls [subdir] [--markdown] [--images]
ossput dirs [subdir] [--markdown]
ossput skill install
ossput --profile <name> <子命令>
```

---

## 对象路径规则

上传时指定 `subdir`（如 `demo/`），实际 Object Key 形如：

```text
{profile.prefix}{subdir}{YYYY}/{MM}/{uuid}.ext
```

示例（`prefix` 为空时）：

```text
demo/2026/05/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png
```

**不会保留原始文件名**，以避免冲突。列表与上传请使用相同 `subdir`。

---

## 安全

- 使用 **RAM 子账号**，按 Bucket 前缀授权（`PutObject`、`HeadObject` 等）；删除需单独授权。示例：[官网 RAM 板块](https://devoink.github.io/ossput/#ram-policy) · [docs/ram-policy.example.json](./docs/ram-policy.example.json)
- **禁止**在 Agent 对话中粘贴 AccessKey；仅在终端运行 `setup` / `profile add`
- **可提交** `.ossput.json`；**勿提交** `profiles/*.json` 或任何含密钥的文件
- **删除**：profile 默认 `allowDelete: false`；MCP 必须 `confirm: true`，且 `objectKey` 落在 profile 的 `prefix` 下；CLI 使用 `ossput rm <key> --confirm`

---

## 限制

- 单文件 ≤ **100MB**
- 仅支持 **单次 Presigned PUT**（v1 不做分片）
- 需要 **Node.js 18+**

---

## Windows

路径通过 `%USERPROFILE%` 解析，逻辑与 macOS/Linux 一致；CI 在 Windows 上有冒烟测试，日常环境请以本机 `ossput doctor` 为准。

| 用途 | 典型路径 |
|------|----------|
| OSS 配置 | `%USERPROFILE%\.config\ossput\` |
| Cursor MCP | `%USERPROFILE%\.cursor\mcp.json` |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor Skill | `%USERPROFILE%\.cursor\skills\ossput\` |
| Claude Code Skill | `%USERPROFILE%\.claude\skills\ossput\` |

说明：

- 在资源管理器中显示隐藏项，或地址栏输入 `%USERPROFILE%\.cursor`
- Skill 优先创建 **junction**；失败则 **复制**，升级 npm 后需再执行 `ossput skill install`
- Windows 上 `chmod 600` 语义较弱，请勿将 `profiles/*.json` 提交到 Git

---

## 本地开发

**CLI / MCP 源码：**

```bash
git clone https://github.com/devoink/ossput.git
cd ossput
npm ci && npm run build
node dist/index.js setup   # 或 npx ossput setup
npm test
```

**官网静态页：** 见上文 [官网](#官网) 一节（`npm run docs:dev`）。

---

## 许可证

[MIT](./LICENSE)
