import { randomUUID } from "node:crypto";

export function buildObjectKey(
  prefix: string,
  subdir: string,
  filename: string,
  overwrite: boolean,
): string {
  const ext = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".") + 1).toLowerCase()
    : "bin";
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const name = overwrite
    ? filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    : `${randomUUID()}.${ext}`;
  return `${prefix}${subdir}${yyyy}/${mm}/${name}`;
}
