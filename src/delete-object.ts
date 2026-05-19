import type { AppConfig, DeleteObjectResult } from "./types.js";
import { createOssClient, publicObjectUrl } from "./oss-client.js";
import {
  assertDeleteEnabled,
  assertObjectKeyDeletable,
} from "./object-key.js";

export interface DeleteObjectOptions {
  /** 必须为 true，防止 Agent 误删 */
  confirm: boolean;
}

export async function deleteObject(
  config: AppConfig,
  objectKey: string,
  options: DeleteObjectOptions,
): Promise<DeleteObjectResult> {
  if (options.confirm !== true) {
    throw new Error(
      "refusing to delete without confirm: true — show the user objectKey and get explicit approval first",
    );
  }

  assertDeleteEnabled(config);
  const key = assertObjectKeyDeletable(config, objectKey);

  const client = createOssClient(config);
  try {
    await client.head(key);
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number };
    if (e.code === "NoSuchKey" || e.status === 404) {
      throw new Error(`object not found: ${key}`);
    }
    throw err;
  }

  await client.delete(key);

  return {
    objectKey: key,
    deleted: true,
    objectUrl: publicObjectUrl(config, key),
  };
}
