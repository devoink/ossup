import { homedir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "./types.js";

export const CONFIG_DIR = join(homedir(), ".config", "ossup");

export const DEFAULT_CONFIG_PATH = join(CONFIG_DIR, "config.json");

const DEFAULT_ALLOWED = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "mp4",
  "mov",
  "zip",
];

/** OSS 对象前缀；`/` 或空字符串表示 Bucket 根目录 */
export function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function formatPrefixDisplay(prefix: string): string {
  return prefix || "/";
}

export function parseConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid config: expected JSON object");
  }
  const o = raw as Record<string, unknown>;
  const region = String(o.region ?? "").trim();
  const bucket = String(o.bucket ?? "").trim();
  const prefix = normalizePrefix(String(o.prefix ?? "/"));
  const accessKeyId = String(o.accessKeyId ?? "").trim();
  const accessKeySecret = String(o.accessKeySecret ?? "").trim();

  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error(
      "Invalid config: region, bucket, accessKeyId, accessKeySecret are required",
    );
  }

  const presignExpiresSec = Number(o.presignExpiresSec ?? 900);
  const allowedExtensions = Array.isArray(o.allowedExtensions)
    ? o.allowedExtensions.map((e) => String(e).toLowerCase().replace(/^\./, ""))
    : DEFAULT_ALLOWED;

  return {
    region,
    bucket,
    prefix,
    accessKeyId,
    accessKeySecret,
    presignExpiresSec: Number.isFinite(presignExpiresSec) ? presignExpiresSec : 900,
    allowedExtensions,
    endpoint: o.endpoint != null ? String(o.endpoint) : null,
    publicBaseUrl:
      o.publicBaseUrl != null && String(o.publicBaseUrl).trim()
        ? String(o.publicBaseUrl).trim().replace(/\/+$/, "")
        : null,
  };
}

export async function resolveConfigPath(): Promise<string> {
  const { INDEX_CONFIG_PATH } = await import("./config-profiles.js");
  return INDEX_CONFIG_PATH;
}

export async function configExists(): Promise<boolean> {
  const { configExists: exists } = await import("./config-profiles.js");
  return exists();
}

export async function loadConfig(
  options?: import("./config-profiles.js").LoadConfigOptions,
): Promise<AppConfig> {
  const { loadConfigWithProfile } = await import("./config-profiles.js");
  const { config } = await loadConfigWithProfile(options);
  return config;
}

export async function ensureConfigDir(): Promise<void> {
  const { ensureProfilesDir } = await import("./config-profiles.js");
  await ensureProfilesDir();
}

export type { LoadConfigOptions } from "./config-profiles.js";
export { DEFAULT_ALLOWED };
