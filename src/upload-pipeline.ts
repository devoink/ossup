import { readFile } from "node:fs/promises";
import type { AppConfig } from "./types.js";
import type {
  ConfirmUploadResult,
  PrepareUploadResult,
  UploadFileResult,
} from "./types.js";
import { MAX_FILE_BYTES } from "./types.js";
import { createOssClient, publicObjectUrl } from "./oss-client.js";
import { buildObjectKey } from "./key-builder.js";
import {
  inferContentType,
  validateExtension,
  validateLocalFile,
  validateSubdir,
} from "./validators.js";

const UPLOAD_TIMEOUT_MS = 600_000;

async function signPutUrl(
  config: AppConfig,
  objectKey: string,
  contentType: string,
): Promise<string> {
  const client = createOssClient(config);
  return client.asyncSignatureUrl(objectKey, {
    method: "PUT",
    expires: config.presignExpiresSec,
    "Content-Type": contentType,
  });
}

export async function prepareUpload(
  config: AppConfig,
  filename: string,
  contentType: string,
  subdir?: string,
  overwrite = false,
): Promise<PrepareUploadResult> {
  validateExtension(filename, config);
  const normalizedSubdir = validateSubdir(subdir);
  const objectKey = buildObjectKey(
    config.prefix,
    normalizedSubdir,
    filename,
    overwrite,
  );
  const uploadUrl = await signPutUrl(config, objectKey, contentType);
  const expiresAt = new Date(
    Date.now() + config.presignExpiresSec * 1000,
  ).toISOString();

  return {
    bucket: config.bucket,
    objectKey,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": contentType },
    expiresAt,
    maxSizeBytes: MAX_FILE_BYTES,
  };
}

function formatUploadHttpError(status: number, body: string): string {
  const snippet = body.trim().slice(0, 300);
  const detail = snippet ? `: ${snippet}` : "";
  return `OSS upload failed (HTTP ${status})${detail}`;
}

/** Presigned PUT via Node fetch (no external curl). */
export async function putPresignedFile(
  uploadUrl: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  if (typeof globalThis.fetch !== "function") {
    throw new Error(
      "当前 Node 运行时无 fetch，请使用 Node.js 18 或更高版本",
    );
  }

  const body = await readFile(filePath);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(formatUploadHttpError(response.status, text));
  }
}

export async function confirmUpload(
  config: AppConfig,
  objectKey: string,
  expectedSizeBytes?: number,
): Promise<ConfirmUploadResult> {
  const client = createOssClient(config);
  try {
    const head = await client.head(objectKey);
    const headers = head.res.headers as Record<string, string | number | undefined>;
    const size = Number(headers["content-length"] ?? 0);
    if (expectedSizeBytes != null && size !== expectedSizeBytes) {
      throw new Error(
        `size mismatch: expected ${expectedSizeBytes}, got ${size}`,
      );
    }
    const etag = headers.etag != null ? String(headers.etag) : undefined;
    const lastModified =
      headers["last-modified"] != null
        ? String(headers["last-modified"])
        : undefined;
    return {
      exists: true,
      size,
      etag,
      objectUrl: publicObjectUrl(config, objectKey),
      lastModified,
    };
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number };
    if (e.code === "NoSuchKey" || e.status === 404) {
      return {
        exists: false,
        size: 0,
        objectUrl: publicObjectUrl(config, objectKey),
      };
    }
    throw err;
  }
}

export async function uploadFile(
  config: AppConfig,
  localPath: string,
  subdir?: string,
  contentType?: string,
): Promise<UploadFileResult> {
  const { absolutePath, size, filename } = await validateLocalFile(localPath);
  const ct = contentType?.trim() || inferContentType(filename);
  const prepared = await prepareUpload(config, filename, ct, subdir, false);
  await putPresignedFile(prepared.uploadUrl, absolutePath, ct);
  const confirmed = await confirmUpload(config, prepared.objectKey, size);
  if (!confirmed.exists) {
    throw new Error("upload completed but object not found on OSS");
  }
  return { objectKey: prepared.objectKey, ...confirmed };
}
