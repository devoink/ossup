import type { AppConfig } from "./types.js";
import { formatPrefixDisplay } from "./config.js";

/** 规范化 OSS 对象 Key（无前导斜杠） */
export function normalizeObjectKey(objectKey: string): string {
  const key = objectKey.trim().replace(/^\/+/, "");
  if (!key) {
    throw new Error("objectKey cannot be empty");
  }
  if (key.includes("..")) {
    throw new Error("objectKey must not contain '..'");
  }
  if (key.endsWith("/")) {
    throw new Error("objectKey must point to a file, not a directory prefix");
  }
  return key;
}

/**
 * 删除前校验 Key 落在当前 profile 允许范围内。
 * - 有 prefix：Key 必须以 prefix 开头且长于 prefix
 * - 无 prefix（桶根）：须 allowDelete，且至少 subdir/file 两段路径
 */
export function assertObjectKeyDeletable(
  config: AppConfig,
  objectKey: string,
): string {
  const key = normalizeObjectKey(objectKey);
  const prefix = config.prefix;

  if (prefix) {
    if (!key.startsWith(prefix)) {
      throw new Error(
        `objectKey must start with profile prefix '${formatPrefixDisplay(prefix)}'`,
      );
    }
    if (key.length <= prefix.length) {
      throw new Error("objectKey must name a file under the profile prefix");
    }
    return key;
  }

  if (config.allowDelete !== true) {
    throw new Error(
      "delete is disabled when profile prefix is bucket root; set allowDelete: true in profile JSON only if you accept the risk",
    );
  }

  const segments = key.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(
      "with bucket-root prefix, objectKey must be at least subdir/filename (2 path segments)",
    );
  }

  return key;
}

export function assertDeleteEnabled(config: AppConfig): void {
  if (config.allowDelete !== true) {
    throw new Error(
      "delete is disabled for this profile; set allowDelete: true in ~/.config/ossput/profiles/<name>.json",
    );
  }
}
