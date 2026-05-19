# ossup 参考

## 配置文件

| 路径 | 内容 |
|------|------|
| `~/.config/ossup/config.json` | 索引：`defaultProfile`、`profiles` 列表（无密钥） |
| `~/.config/ossup/profiles/{name}.json` | 单账号：region、bucket、prefix、AK（`chmod 600`）；可选 `publicBaseUrl`（CDN 域名） |
| `{repo}/.ossup.json` | `{ "profile": "default" }`，可提交 Git |

## MCP 工具参数摘要

### upload_file

- `localPath`（必填）：本机绝对或相对路径
- `subdir`（可选）：逻辑子目录，如 `demo/`、`ossup_test`
- `contentType`（可选）：不传则按扩展名推断
- `profile`（可选）

返回 JSON：`objectKey`、`objectUrl`、`size`、`exists` 等。

### list_objects

- `subdir`：列出该前缀下对象
- `format`: `json` | `markdown`（图片预览用 markdown）
- `imagesOnly`: `true` 仅图片
- `maxKeys`：默认 100，最大 1000
- `previewMax`：markdown 模式下最多预览张数

### list_directories

- `subdir`：从该前缀下列「子目录」
- `format`: `json` | `markdown`

### prepare_upload / confirm_upload

用于自定义上传流程；`overwrite: true` 时保留原文件名（仍带年月目录）。常规场景用 `upload_file` 即可。

## CLI（用户在终端执行）

```bash
npx ossup setup
npx ossup profile list|add|show|use|default|rm
npx ossup status
npx ossup put <file> [--subdir name]
npx ossup ls [subdir] [--markdown] [--images]
npx ossup dirs [subdir] [--markdown]
npx ossup --profile <name> <command>
```

## 示例对话流

**上传一张本地图到 `ossup_test`：**

1. `get_setup_status` 或 `list_profiles` 确认已配置
2. `upload_file`：`localPath=/path/to/photo.jpg`，`subdir=ossup_test`
3. 把返回的 `objectUrl` 给用户

**浏览已上传图片：**

`list_objects`：`subdir=ossup_test`，`format=markdown`，`imagesOnly=true`
