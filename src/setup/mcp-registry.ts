import { readFile, writeFile, copyFile, access, mkdir } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { constants } from "node:fs";
import { readFile as readPkg } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface McpClientDefinition {
  id: string;
  displayName: string;
  resolveConfigPath: () => string | null;
}

function claudeDesktopPath(): string | null {
  if (platform() === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (platform() === "win32") {
    return join(
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
      "Claude",
      "claude_desktop_config.json",
    );
  }
  return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
}

export const MCP_CLIENTS: McpClientDefinition[] = [
  {
    id: "cursor",
    displayName: "Cursor",
    resolveConfigPath: () => join(homedir(), ".cursor", "mcp.json"),
  },
  {
    id: "claude-code",
    displayName: "Claude Code",
    resolveConfigPath: () => join(homedir(), ".claude.json"),
  },
  {
    id: "claude-desktop",
    displayName: "Claude Desktop",
    resolveConfigPath: claudeDesktopPath,
  },
];

export const MCP_SERVER_NAME = "ossup";

export async function getPackageVersion(): Promise<string> {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(dir, "..", "..", "package.json");
    const raw = JSON.parse(await readPkg(pkgPath, "utf8")) as { version?: string };
    return raw.version ?? "0.0.1";
  } catch {
    return "0.0.1";
  }
}

/** 使用当前安装包内的 dist/index.js，避免未发布到 npm 时 npx 404 */
export function buildMcpServerEntry(_version: string): Record<string, unknown> {
  const indexJs = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "index.js",
  );
  return {
    command: "node",
    args: [indexJs],
  };
}

type McpJson = { mcpServers?: Record<string, unknown> };

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readMcpEntry(
  configPath: string,
  serverName: string,
): Promise<unknown | undefined> {
  if (!(await fileExists(configPath))) return undefined;
  const text = await readFile(configPath, "utf8");
  const doc = JSON.parse(text) as McpJson;
  return doc.mcpServers?.[serverName];
}

export async function readOurMcpEntry(
  configPath: string,
): Promise<unknown | undefined> {
  return readMcpEntry(configPath, MCP_SERVER_NAME);
}

export async function mergeMcpConfig(
  configPath: string,
  serverName: string,
  entry: Record<string, unknown>,
  options?: { force?: boolean },
): Promise<"created" | "updated" | "skipped"> {
  await mkdir(dirname(configPath), { recursive: true });

  let doc: McpJson = { mcpServers: {} };
  const exists = await fileExists(configPath);

  if (exists) {
    const text = await readFile(configPath, "utf8");
    try {
      doc = JSON.parse(text) as McpJson;
    } catch {
      throw new Error(`配置文件不是合法 JSON：${configPath}`);
    }
    await copyFile(configPath, `${configPath}.bak`);
  }

  if (!doc.mcpServers || typeof doc.mcpServers !== "object") {
    doc.mcpServers = {};
  }

  if (doc.mcpServers[serverName] != null) {
    const existing = JSON.stringify(doc.mcpServers[serverName]);
    const next = JSON.stringify(entry);
    if (existing === next) return "skipped";
    if (!options?.force) {
      return "skipped";
    }
  }

  doc.mcpServers[serverName] = entry;
  await writeFile(configPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return exists ? "updated" : "created";
}

export async function listConfiguredClients(): Promise<string[]> {
  const found: string[] = [];
  for (const client of MCP_CLIENTS) {
    const p = client.resolveConfigPath();
    if (!p) continue;
    try {
      const text = await readFile(p, "utf8");
      const doc = JSON.parse(text) as McpJson;
      if (doc.mcpServers?.[MCP_SERVER_NAME]) {
        found.push(client.id);
      }
    } catch {
      /* not configured */
    }
  }
  return found;
}

const ACTION_LABEL: Record<string, string> = {
  created: "新建",
  updated: "已更新",
  skipped: "无变化（已是最新）",
};

export function formatMergeAction(action: string): string {
  return ACTION_LABEL[action] ?? action;
}
