import { runSetup, type SetupOptions } from "./setup/run-setup.js";
import { printAsciiLogo } from "./setup/logo.js";
import { loadConfig, configExists, resolveConfigPath } from "./config.js";
import type { LoadConfigOptions } from "./config-profiles.js";
import { formatDirectoriesAsMarkdown, listDirectories } from "./list-directories.js";
import { formatListAsMarkdown } from "./list-format.js";
import { listObjects } from "./list-objects.js";
import { uploadFile } from "./upload-pipeline.js";
import { getSetupStatusJson } from "./mcp.js";
import { getPackageVersion } from "./setup/mcp-registry.js";
import { runProfileCommand } from "./profile-cli.js";
import { runSkillCommand } from "./skill-cli.js";
import { runDoctor } from "./doctor.js";
import { ui } from "./setup/ui.js";

function printUsage(): void {
  console.log(`ossup — 阿里云 OSS 直传（MCP + 命令行）

用法:
  ossup                      启动 MCP 服务
  ossup setup                安装向导（首个账号 + MCP）
  ossup profile <子命令>     管理多账号（list / add / use …）
  ossup skill install        安装 Agent Skill 到本机（setup 会自动执行）
  ossup put <文件>           上传文件
  ossup ls [子目录]          列出对象（--markdown 图片预览）
  ossup dirs [子目录]        列出目录（--markdown）
  ossup status               状态
  ossup doctor               诊断环境（Node/curl/配置/MCP/Skill）

全局选项:
  --profile <name>           指定账号（覆盖 .ossup.json）

Profile 示例:
  ossup profile add client-a
  ossup profile use site
  ossup profile list

上传示例:
  ossup put ./photo.png --subdir demo/2026-05
  ossup --profile client-a put ./x.zip
`);
}

function parseArgs(argv: string[]): {
  command: string;
  rest: string[];
  flags: Record<string, string | boolean>;
  profile?: string;
} {
  let profile: string | undefined;
  const args: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--profile" && argv[i + 1]) {
      profile = argv[++i];
    } else {
      args.push(argv[i]);
    }
  }

  const command = args[0] ?? "";
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--non-interactive") flags.nonInteractive = true;
    else if (a === "--skip-connectivity") flags.skipConnectivity = true;
    else if (a === "--set-default") flags.setDefault = true;
    else if (a === "--bind-project") flags.bindProject = true;
    else if (a === "--config" && args[i + 1]) {
      flags.config = args[++i];
    } else if (a === "--profile-name" && args[i + 1]) {
      flags.profileName = args[++i];
    } else if (a === "--label" && args[i + 1]) {
      flags.label = args[++i];
    } else if (a === "--subdir" && args[i + 1]) {
      flags.subdir = args[++i];
    } else if (a === "--content-type" && args[i + 1]) {
      flags.contentType = args[++i];
    } else if (a === "--max-keys" && args[i + 1]) {
      flags.maxKeys = args[++i];
    } else if (a === "--preview-max" && args[i + 1]) {
      flags.previewMax = args[++i];
    } else if (a === "--markdown") flags.markdown = true;
    else if (a === "--images") flags.images = true;
    else if (a === "--skip-skill") flags.skipSkill = true;
    else if (a === "--cursor") flags.cursor = true;
    else if (a === "--claude") flags.claude = true;
    else if (a.startsWith("--")) {
      /* ignore */
    } else {
      rest.push(a);
    }
  }

  return { command, rest, flags, profile };
}

function loadOpts(profile?: string): LoadConfigOptions {
  return profile ? { profile } : {};
}

export async function runCli(argv: string[]): Promise<number> {
  const { command, rest, flags, profile } = parseArgs(argv);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return 0;
  }

  if (command === "profile") {
    return runProfileCommand(rest[0] ?? "list", rest.slice(1), flags);
  }

  if (command === "skill") {
    return runSkillCommand(rest[0] ?? "install", rest.slice(1), flags);
  }

  if (command === "setup") {
    const options: SetupOptions = {
      nonInteractive: Boolean(flags.nonInteractive),
      configPath: typeof flags.config === "string" ? flags.config : undefined,
      profileName:
        typeof flags.profileName === "string" ? flags.profileName : undefined,
      skipConnectivity: Boolean(flags.skipConnectivity),
      skipSkillInstall: Boolean(flags.skipSkill),
    };
    await runSetup(options);
    return 0;
  }

  if (command === "doctor") {
    const { checks, ok } = await runDoctor(profile);
    for (const c of checks) {
      const mark = c.ok ? ui.green("✓") : ui.red("✗");
      console.log(`${mark} ${c.name}: ${c.detail}`);
    }
    console.log(ok ? `\n${ui.green("全部通过")}` : `\n${ui.red("存在问题，请按提示修复")}`);
    return ok ? 0 : 1;
  }

  if (command === "status") {
    const version = await getPackageVersion();
    printAsciiLogo(version);
    const status = await getSetupStatusJson(profile);
    console.log(JSON.stringify(status, null, 2));
    if (!(await configExists())) {
      console.log("\nRun: ossup setup");
    }
    return 0;
  }

  const cfgOpts = loadOpts(profile);

  if (command === "dirs" || command === "directories") {
    if (!(await configExists())) {
      console.error(
        `Not configured. Run: ossup setup\nIndex: ${await resolveConfigPath()}`,
      );
      return 1;
    }
    const config = await loadConfig(cfgOpts);
    const subdir =
      rest[0] ?? (typeof flags.subdir === "string" ? flags.subdir : undefined);
    const result = await listDirectories(config, { subdir });
    if (flags.markdown) {
      console.log(formatDirectoriesAsMarkdown(result));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return 0;
  }

  if (command === "ls" || command === "list") {
    if (!(await configExists())) {
      console.error(
        `Not configured. Run: ossup setup\nIndex: ${await resolveConfigPath()}`,
      );
      return 1;
    }
    const config = await loadConfig(cfgOpts);
    const subdir =
      rest[0] ?? (typeof flags.subdir === "string" ? flags.subdir : undefined);
    const maxKeys =
      typeof flags.maxKeys === "string" ? Number(flags.maxKeys) : undefined;
    const previewMax =
      typeof flags.previewMax === "string" ? Number(flags.previewMax) : undefined;
    const result = await listObjects(config, {
      subdir,
      maxKeys: Number.isFinite(maxKeys) ? maxKeys : undefined,
      imagesOnly: Boolean(flags.images),
    });
    if (flags.markdown) {
      console.log(
        formatListAsMarkdown(result, {
          previewMax: Number.isFinite(previewMax) ? previewMax : undefined,
        }),
      );
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return 0;
  }

  if (command === "put") {
    const file = rest[0];
    if (!file) {
      console.error("Error: missing file path. Usage: ossup put <file>");
      return 1;
    }
    if (!(await configExists())) {
      console.error(
        `Not configured. Run: ossup setup\nIndex: ${await resolveConfigPath()}`,
      );
      return 1;
    }
    const config = await loadConfig(cfgOpts);
    const subdir = typeof flags.subdir === "string" ? flags.subdir : undefined;
    const contentType =
      typeof flags.contentType === "string" ? flags.contentType : undefined;
    const result = await uploadFile(config, file, subdir, contentType);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  return 1;
}
