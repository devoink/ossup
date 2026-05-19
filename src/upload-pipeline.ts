import { spawn } from "node:child_process";
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

function curlNotFoundMessage(): string {
  if (process.platform === "win32") {
    return (
      "未找到 curl（上传依赖 curl 执行 Presigned PUT）。" +
      "Windows 10 及以上一般在 PATH 中有 curl.exe，请在终端运行 curl --version 检查。" +
      "若不可用，可安装 Git for Windows，或在「设置 → 应用 → 可选功能」中启用相关组件。"
    );
  }
  if (process.platform === "darwin") {
    return "未找到 curl。macOS 通常已自带；若缺失可安装 Xcode Command Line Tools。";
  }
  return "未找到 curl。请安装 curl（例如：apt install curl / dnf install curl）。";
}

export function runCurlPut(
  uploadUrl: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  return new Promise((resolve, reject) => {
    const child = spawn(
      curlBin,
      [
        "-f",
        "-sS",
        "-X",
        "PUT",
        "-T",
        filePath,
        "-H",
        `Content-Type: ${contentType}`,
        "--max-time",
        "600",
        uploadUrl,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr?.on("data", (c) => {
      stderr += String(c);
    });
    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(curlNotFoundMessage()));
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl failed (${code}): ${stderr || "unknown"}`));
    });
  });
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
  await runCurlPut(prepared.uploadUrl, absolutePath, ct);
  const confirmed = await confirmUpload(config, prepared.objectKey, size);
  if (!confirmed.exists) {
    throw new Error("upload completed but object not found on OSS");
  }
  return { objectKey: prepared.objectKey, ...confirmed };
}
