# ossup 示例对话

## 1. 上传本地截图到 `ossup_test`

**用户**：把这张截图传到 OSS 的 ossup_test 目录。

**Agent 步骤**：

1. `get_setup_status` — 确认 `configured: true`
2. `upload_file` — `localPath=/Users/me/Desktop/shot.png`，`subdir=ossup_test`
3. 回复用户工具返回的 `objectUrl`（Key 形如 `ossup_test/2026/05/<uuid>.png`）

---

## 2. 浏览已上传图片

**用户**：看看 ossup_test 里有哪些图。

**Agent**：`list_objects`，`subdir=ossup_test`，`format=markdown`，`imagesOnly=true`

将返回的 Markdown（含图片预览）直接展示给用户。

---

## 3. 多账号项目

**用户**：这个项目要用客户 A 的桶上传。

**Agent**：

1. `list_profiles` — 看是否有 `client-a`
2. `upload_file` — `profile=client-a`，`localPath=...`，`subdir=deliverables/`

若项目根有 `.ossup.json` 且已绑定 `client-a`，可省略 `profile` 参数。

---

## 反模式

| 不要 | 原因 |
|------|------|
| 在对话里要 AccessKey | 应让用户终端执行 `npx ossup setup` |
| 用 `prepare_upload` 做普通上传 | 优先 `upload_file` |
| 上传后 list 用不同 `subdir` | 会与上传路径不一致，列不出文件 |
| 假设 URL 含原文件名 | 默认为 UUID 文件名 |
