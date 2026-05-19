import { basename, resolve, normalize } from "node:path";
import { stat } from "node:fs/promises";
import type { AppConfig } from "./types.js";
import { MAX_FILE_BYTES } from "./types.js";

const DENIED_SUBDIRS = ["release", "prod", "production"];

export function getExtension(filename: string): string {
  const base = basename(filename);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function inferContentType(filename: string): string {
  const ext = getExtension(filename);
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp4: "video/mp4",
    mov: "video/quicktime",
    zip: "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

export function validateSubdir(subdir?: string): string {
  if (!subdir?.trim()) return "";
  const s = subdir.trim().replace(/^\/+|\/+$/g, "");
  if (!s) return "";
  if (s.includes("..")) throw new Error("subdir must not contain '..'");
  if (!/^[a-zA-Z0-9_\-/]+$/.test(s)) {
    throw new Error("subdir may only contain letters, numbers, _, -, and /");
  }
  for (const denied of DENIED_SUBDIRS) {
    if (s === denied || s.startsWith(`${denied}/`)) {
      throw new Error(`subdir '${denied}' is not allowed`);
    }
  }
  return s.endsWith("/") ? s : `${s}/`;
}

export function validateExtension(filename: string, config: AppConfig): void {
  const ext = getExtension(filename);
  if (!ext) throw new Error("file must have an extension");
  const allowed = config.allowedExtensions.map((e) => e.toLowerCase());
  if (!allowed.includes(ext)) {
    throw new Error(
      `extension '.${ext}' not allowed. Allowed: ${allowed.join(", ")}`,
    );
  }
}

export async function validateLocalFile(localPath: string): Promise<{
  absolutePath: string;
  size: number;
  filename: string;
}> {
  const absolutePath = resolve(normalize(localPath));
  const st = await stat(absolutePath);
  if (!st.isFile()) throw new Error(`not a file: ${absolutePath}`);
  if (st.size > MAX_FILE_BYTES) {
    throw new Error(
      `file exceeds ${MAX_FILE_BYTES} bytes (100MB limit)`,
    );
  }
  const filename = basename(absolutePath);
  const lower = filename.toLowerCase();
  if (
    lower === ".env" ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key") ||
    lower.includes("id_rsa")
  ) {
    throw new Error("refusing to upload sensitive-looking files");
  }
  return { absolutePath, size: st.size, filename };
}
