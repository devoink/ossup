import { readFile } from "node:fs/promises";
import { confirm } from "@inquirer/prompts";
import { parseConfig } from "../config.js";
import {
  indexExists,
  profileFilePath,
  writeProjectBinding,
} from "../config-profiles.js";
import type { AppConfig } from "../types.js";
import { testConnectivity } from "./connectivity.js";
import {
  buildMcpServerEntry,
  formatMergeAction,
  getPackageVersion,
  MCP_CLIENTS,
  mergeMcpConfig,
  readOurMcpEntry,
  MCP_SERVER_NAME,
} from "./mcp-registry.js";
import {
  promptOverwriteExisting,
  runInteractiveSetup,
} from "./prompts.js";
import { writeProfileConfig } from "./write-config.js";
import { installAgentSkills, type SkillInstallResult } from "./skill-install.js";
import {
  printConfigSummary,
  printError,
  printSuccessFooter,
  printWarn,
  ui,
  withSpinner,
} from "./ui.js";

const SERVER_NAME = MCP_SERVER_NAME;

export interface SetupOptions {
  nonInteractive?: boolean;
  configPath?: string;
  profileName?: string;
  clientIds?: string[];
  skipConnectivity?: boolean;
  skipSkillInstall?: boolean;
}

export async function runSetup(options: SetupOptions = {}): Promise<void> {
  let profileName: string;
  let profileLabel: string | undefined;
  let config: AppConfig;
  let clientIds: string[];
  let skippedOssConfig = false;
  let bindProject = false;

  if (options.nonInteractive && options.configPath) {
    const raw = JSON.parse(await readFile(options.configPath, "utf8"));
    config = parseConfig(raw);
    profileName = options.profileName?.trim() || "default";
    clientIds = options.clientIds ?? MCP_CLIENTS.map((c) => c.id);
    const path = await writeProfileConfig(profileName, config, {
      setDefault: true,
    });
    console.log(ui.dim(`正在写入 → ${path}`));
    console.log(ui.green(`✓ 配置已保存`));
  } else if (options.nonInteractive) {
    throw new Error("--non-interactive 需要同时指定 --config <配置文件路径>");
  } else {
    const interactive = await runInteractiveSetup();
    profileName = interactive.profileName;
    profileLabel = interactive.profileLabel;
    config = interactive.config;
    clientIds = interactive.clientIds;
    skippedOssConfig = interactive.skippedOssConfig;
    bindProject = interactive.bindProject;

    if (!skippedOssConfig) {
      const path = profileFilePath(profileName);
      printConfigSummary(
        config,
        path,
        profileLabel ? { name: profileName, label: profileLabel } : { name: profileName },
      );
      const saveOk = await confirm({
        message: "确认保存以上配置？",
        default: true,
      });
      if (!saveOk) {
        console.log(ui.dim("\n  已取消。\n"));
        process.exit(0);
      }
      const hadIndex = await indexExists();
      await writeProfileConfig(profileName, config, {
        label: profileLabel,
        setDefault: !hadIndex,
      });
      console.log(ui.green(`\n  ✓ 账号已保存（权限 600）`));
      console.log(ui.dim(`    ${path}\n`));
    }
  }

  if (!options.skipConnectivity && !skippedOssConfig) {
    try {
      await withSpinner("正在检测 OSS 连通性", async () => {
        await testConnectivity(config);
      });
      console.log(ui.green("  ✓ Bucket 连通性正常，凭证有效"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      printWarn(`OSS 连通性检测未通过：${msg}`);
      printWarn("配置已保存，请检查 Region / Bucket / 密钥 / 网络后重试上传。");
      const cont = options.nonInteractive
        ? true
        : await confirm({
            message: "是否仍继续写入 MCP 配置？",
            default: true,
          });
      if (!cont) {
        console.log(ui.dim("\n  已中止。\n"));
        process.exit(1);
      }
    }
  } else if (skippedOssConfig) {
    printWarn("已跳过 OSS 连通性检测。");
  }

  if (bindProject) {
    const p = await writeProjectBinding(profileName);
    console.log(ui.green(`  ✓ 已写入 ${p}`));
  }

  const version = await getPackageVersion();
  const entry = buildMcpServerEntry(version);
  const mergedClients: { name: string; path: string; action: string }[] = [];

  console.log("");
  console.log(ui.bold("  正在注册 MCP 客户端…"));

  for (const id of clientIds) {
    const client = MCP_CLIENTS.find((c) => c.id === id);
    if (!client) {
      printWarn(`未知客户端：${id}`);
      continue;
    }
    const mcpPath = client.resolveConfigPath();
    if (!mcpPath) {
      printWarn(`${client.displayName}：当前系统无默认配置路径，请手动添加。`);
      continue;
    }

    try {
      const existing = await readOurMcpEntry(mcpPath);
      let force = true;
      if (existing != null) {
        const same = JSON.stringify(existing) === JSON.stringify(entry);
        if (!same && !options.nonInteractive) {
          force = await promptOverwriteExisting(client.displayName);
          if (!force) {
            printWarn(`${client.displayName}：保留原有 MCP 条目，未修改。`);
            mergedClients.push({
              name: client.displayName,
              path: mcpPath,
              action: "已跳过",
            });
            continue;
          }
        }
      }

      const result = await mergeMcpConfig(mcpPath, SERVER_NAME, entry, {
        force,
      });
      mergedClients.push({
        name: client.displayName,
        path: mcpPath,
        action: formatMergeAction(result),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      printError(`${client.displayName}：${msg}`);
    }
  }

  let skillResults: SkillInstallResult[] = [];
  if (!options.skipSkillInstall) {
    console.log("");
    console.log(ui.bold("  正在安装 Agent Skill（用户级，无需复制到项目）…"));
    try {
      skillResults = await installAgentSkills();
      for (const r of skillResults) {
        console.log(ui.dim(`    ${r.target.displayName} → ${r.action}`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      printWarn(`Agent Skill 安装失败：${msg}`);
      printWarn("可稍后执行：ossup skill install");
    }
  }

  printSuccessFooter(mergedClients, profileName, skillResults);
}
