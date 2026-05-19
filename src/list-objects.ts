import type { AppConfig, ListObjectsResult, OssObjectInfo } from "./types.js";
import { formatPrefixDisplay } from "./config.js";
import { filterObjects } from "./list-format.js";
import { createOssClient, publicObjectUrl } from "./oss-client.js";
import { validateSubdir } from "./validators.js";

export interface ListObjectsOptions {
  subdir?: string;
  maxKeys?: number;
  imagesOnly?: boolean;
}

function buildListPrefix(config: AppConfig, subdir?: string): string {
  const sub = validateSubdir(subdir);
  if (!sub) return config.prefix;
  const normalized = sub.endsWith("/") ? sub : `${sub}/`;
  return `${config.prefix}${normalized}`;
}

export async function listObjects(
  config: AppConfig,
  options?: ListObjectsOptions,
): Promise<ListObjectsResult> {
  const prefix = buildListPrefix(config, options?.subdir);
  const limit = Math.min(Math.max(options?.maxKeys ?? 1000, 1), 1000);
  const client = createOssClient(config);
  const objects: OssObjectInfo[] = [];
  let marker: string | undefined;
  let truncated = false;

  do {
    const page = await client.list(
      {
        prefix,
        marker,
        "max-keys": Math.min(limit - objects.length, 1000),
      },
      {},
    );
    for (const obj of page.objects ?? []) {
      if (obj.name.endsWith("/")) continue;
      objects.push({
        objectKey: obj.name,
        size: Number(obj.size ?? 0),
        lastModified: String(obj.lastModified ?? ""),
        objectUrl: publicObjectUrl(config, obj.name),
      });
      if (objects.length >= limit) break;
    }
    truncated = Boolean(page.isTruncated) || objects.length >= limit;
    marker = page.isTruncated ? page.nextMarker : undefined;
  } while (marker && objects.length < limit);

  const filtered = filterObjects(objects, Boolean(options?.imagesOnly));
  return {
    prefix: formatPrefixDisplay(prefix),
    count: filtered.length,
    objects: filtered,
    truncated,
  };
}
