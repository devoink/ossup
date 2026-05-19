import type { AppConfig } from "./types.js";
import type { UploadFileResult } from "./types.js";
import { uploadFile } from "./upload-pipeline.js";
import { validateSubdir } from "./validators.js";

export const MAX_BATCH_FILES = 20;

export interface BatchUploadItemSuccess {
  localPath: string;
  ok: true;
  result: UploadFileResult;
}

export interface BatchUploadItemFailure {
  localPath: string;
  ok: false;
  error: string;
}

export type BatchUploadItemResult =
  | BatchUploadItemSuccess
  | BatchUploadItemFailure;

export interface BatchUploadResult {
  subdir: string;
  total: number;
  succeeded: number;
  failed: number;
  results: BatchUploadItemResult[];
}

export interface BatchUploadOptions {
  subdir?: string;
  contentType?: string;
  /** 遇错即停；默认 false，继续上传其余文件 */
  stopOnError?: boolean;
}

export async function batchUploadFile(
  config: AppConfig,
  localPaths: string[],
  options: BatchUploadOptions = {},
): Promise<BatchUploadResult> {
  if (localPaths.length === 0) {
    throw new Error("localPaths cannot be empty");
  }
  if (localPaths.length > MAX_BATCH_FILES) {
    throw new Error(
      `at most ${MAX_BATCH_FILES} files per batch (got ${localPaths.length})`,
    );
  }

  const normalizedSubdir = validateSubdir(options.subdir);
  const results: BatchUploadItemResult[] = [];

  for (const localPath of localPaths) {
    try {
      const result = await uploadFile(
        config,
        localPath,
        normalizedSubdir || undefined,
        options.contentType,
      );
      results.push({ localPath, ok: true, result });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ localPath, ok: false, error });
      if (options.stopOnError) {
        break;
      }
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return {
    subdir: normalizedSubdir,
    total: localPaths.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}
