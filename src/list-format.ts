import { formatPrefixDisplay } from "./config.js";
import type { ListObjectsResult, OssObjectInfo } from "./types.js";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

export function isPreviewableImage(objectKey: string): boolean {
  const dot = objectKey.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXT.has(objectKey.slice(dot + 1).toLowerCase());
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(objectKey: string): string {
  const slash = objectKey.lastIndexOf("/");
  return slash >= 0 ? objectKey.slice(slash + 1) : objectKey;
}

export function filterObjects(
  objects: OssObjectInfo[],
  imagesOnly: boolean,
): OssObjectInfo[] {
  if (!imagesOnly) return objects;
  return objects.filter((o) => isPreviewableImage(o.objectKey));
}

export function formatListAsMarkdown(
  result: ListObjectsResult,
  options?: { previewMax?: number },
): string {
  const previewMax = Math.min(options?.previewMax ?? 20, 50);
  const lines: string[] = [
    `# OSS 文件列表`,
    ``,
    `- **前缀**: \`${formatPrefixDisplay(result.prefix)}\``,
    `- **数量**: ${result.count}${result.truncated ? "（已截断，可增大 maxKeys 或缩小 subdir）" : ""}`,
    ``,
  ];

  const images = result.objects.filter((o) => isPreviewableImage(o.objectKey));
  const others = result.objects.filter((o) => !isPreviewableImage(o.objectKey));

  if (images.length > 0) {
    lines.push(`## 图片预览`, ``);
    for (const obj of images.slice(0, previewMax)) {
      const name = basename(obj.objectKey);
      lines.push(
        `### ${name}`,
        ``,
        `![${name}](${obj.objectUrl})`,
        ``,
        `- **地址**: ${obj.objectUrl}`,
        `- **Key**: \`${obj.objectKey}\``,
        `- **大小**: ${formatBytes(obj.size)}`,
        `- **更新**: ${obj.lastModified}`,
        ``,
      );
    }
    if (images.length > previewMax) {
      lines.push(`_… 另有 ${images.length - previewMax} 张图片未展示预览_`, ``);
    }
  }

  const listOthers = images.length > 0 ? others : result.objects;
  if (listOthers.length > 0) {
    lines.push(`## 文件地址`, ``);
    lines.push(`| 文件 | 大小 | 地址 |`, `| --- | --- | --- |`);
    for (const obj of listOthers) {
      const name = basename(obj.objectKey);
      lines.push(
        `| ${name} | ${formatBytes(obj.size)} | ${obj.objectUrl} |`,
      );
    }
    lines.push(``);
  }

  return lines.join("\n");
}
