# ossput 示例对话

## 1. 上传本地截图到 `ossput_test`

**用户**：把这张截图传到 OSS 的 ossput_test 目录。

**Agent 步骤**：

1. `get_setup_status` — 确认 `configured: true`
2. `upload_file` — `localPath=/Users/me/Desktop/shot.png`，`subdir=ossput_test`
3. 回复用户工具返回的 `objectUrl`（Key 形如 `ossput_test/2026/05/<uuid>.png`）

---

## 2. 浏览已上传图片

**用户**：看看 ossput_test 里有哪些图。

**Agent**：`list_objects`，`subdir=ossput_test`，`format=markdown`，`imagesOnly=true`

将返回的 Markdown（含图片预览）直接展示给用户。

---

## 3. 多账号项目

**用户**：这个项目要用客户 A 的桶上传。

**Agent**：

1. `list_profiles` — 看是否有 `client-a`
2. `upload_file` — `profile=client-a`，`localPath=...`，`subdir=deliverables/`

若项目根有 `.ossput.json` 且已绑定 `client-a`，可省略 `profile` 参数。

---

## 4. 删除误传文件（需开启 allowDelete）

**用户**：删掉刚才传错的那张图。

**Agent**：

1. `get_setup_status` — 确认 `allowDelete: true`，否则请用户在 profile JSON 中开启
2. `list_objects` — 找到目标 `objectKey`，**向用户展示并确认**
3. `delete_object` — `objectKey=...`，`confirm=true`（仅用户同意后）

---

## 反模式

| 不要 | 原因 |
|------|------|
| 在对话里要 AccessKey | 应让用户终端执行 `npx ossput setup` |
| 用 `prepare_upload` 做普通上传 | 优先 `upload_file` |
| 上传后 list 用不同 `subdir` | 会与上传路径不一致，列不出文件 |
| 假设 URL 含原文件名 | 默认为 UUID 文件名 |
| 未确认就 `delete_object` | 必须先展示 objectKey 并取得用户同意，且 `confirm: true` |
| 未开 `allowDelete` 仍尝试删除 | 提示编辑 profile，不要反复调用 |
