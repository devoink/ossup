import type { AppConfig } from "./types.js";
import { formatPrefixDisplay, normalizePrefix } from "./config.js";
import { createOssClient } from "./oss-client.js";
import { validateSubdir } from "./validators.js";

export interface ListDirectoriesResult {
  prefix: string;
  count: number;
  directories: string[];
}

function buildListPrefix(config: AppConfig, subdir?: string): string {
  const sub = validateSubdir(subdir);
  if (!sub) return config.prefix;
  const normalized = sub.endsWith("/") ? sub : `${sub}/`;
  return `${config.prefix}${normalized}`;
}

async function listImmediateSubdirs(
  client: ReturnType<typeof createOssClient>,
  prefix: string,
): Promise<string[]> {
  const dirs: string[] = [];
  let marker: string | undefined;
  do {
    const page = await client.list(
      { prefix, delimiter: "/", marker, "max-keys": 1000 },
      {},
    );
    for (const p of page.prefixes ?? []) dirs.push(p);
    marker = page.isTruncated ? page.nextMarker : undefined;
  } while (marker);
  return dirs;
}

/** 递归列出 prefix 下所有「目录」（CommonPrefixes） */
export async function listDirectories(
  config: AppConfig,
  options?: { subdir?: string },
): Promise<ListDirectoriesResult> {
  const prefix = buildListPrefix(config, options?.subdir);
  const client = createOssClient(config);
  const all: string[] = [];

  async function walk(current: string): Promise<void> {
    const children = await listImmediateSubdirs(client, current);
    for (const dir of children.sort()) {
      all.push(dir);
      await walk(dir);
    }
  }

  await walk(prefix);
  return {
    prefix: formatPrefixDisplay(prefix),
    count: all.length,
    directories: all,
  };
}

export function formatDirectoriesAsMarkdown(
  result: ListDirectoriesResult,
): string {
  const lines: string[] = [
    `# OSS 目录列表`,
    ``,
    `- **前缀**: \`${result.prefix}\``,
    `- **目录数**: ${result.count}`,
    ``,
  ];
  if (result.count === 0) {
    lines.push(`_（无子目录）_`);
    return lines.join("\n");
  }

  const rootNorm = result.prefix === "/" ? "" : normalizePrefix(result.prefix);
  lines.push("```");
  for (const dir of result.directories) {
    const rel = rootNorm && dir.startsWith(rootNorm) ? dir.slice(rootNorm.length) : dir;
    const depth = rel.replace(/\/$/, "").split("/").filter(Boolean).length - 1;
    const indent = "  ".repeat(Math.max(0, depth));
    const label = rel.replace(/\/$/, "").split("/").filter(Boolean).pop() ?? dir;
    lines.push(`${indent}${label}/`);
  }
  lines.push("```");
  return lines.join("\n");
}
