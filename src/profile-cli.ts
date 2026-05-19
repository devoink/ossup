import { confirm } from "@inquirer/prompts";
import {
  formatPrefixDisplay,
  listProfileNames,
  loadConfigWithProfile,
  loadIndex,
  profileExists,
  profileFilePath,
  removeProfile,
  saveProfile,
  setDefaultProfile,
  validateProfileName,
  writeProjectBinding,
} from "./config-profiles.js";
import { maskSecret, printHint, ui } from "./setup/ui.js";
import {
  promptOssConfig,
  promptProfileIdentity,
} from "./setup/prompts.js";
import { testConnectivity } from "./setup/connectivity.js";
import { withSpinner } from "./setup/ui.js";

export async function runProfileList(): Promise<void> {
  const rows = await listProfileNames();
  if (rows.length === 0) {
    console.log("No profiles. Run: ossput setup  or  ossput profile add <name>");
    return;
  }
  for (const row of rows) {
    const mark = row.isDefault ? "*" : " ";
    const label = row.label ? `  ${row.label}` : "";
    console.log(`${mark} ${row.name}${label}`);
  }
}

export async function runProfileShow(name?: string): Promise<void> {
  const resolved = name
    ? { name, source: "arg" as const }
    : (await loadConfigWithProfile()).resolved;
  const target = name ?? resolved.name;
  const { config } = await loadConfigWithProfile({ profile: target });
  const index = await loadIndex();
  const label = index?.profiles[target]?.label;
  console.log(
    JSON.stringify(
      {
        profile: target,
        label: label ?? null,
        region: config.region,
        bucket: config.bucket,
        prefix: formatPrefixDisplay(config.prefix),
        accessKeyId: maskSecret(config.accessKeyId, 6),
        endpoint: config.endpoint,
        presignExpiresSec: config.presignExpiresSec,
        allowedExtensions: config.allowedExtensions,
        file: profileFilePath(target),
      },
      null,
      2,
    ),
  );
}

export interface ProfileAddOptions {
  name?: string;
  nonInteractive?: boolean;
  configPath?: string;
  skipConnectivity?: boolean;
  setDefault?: boolean;
  bindProject?: boolean;
  label?: string;
}

export async function runProfileAdd(options: ProfileAddOptions = {}): Promise<void> {
  let name = options.name?.trim();
  let label = options.label;

  if (!options.nonInteractive) {
    const identity = await promptProfileIdentity({
      name,
      requireNew: true,
    });
    name = identity.name;
    label = identity.label ?? label;
  } else {
    if (!name) name = "default";
    const valid = validateProfileName(name);
    if (valid !== true) throw new Error(valid);
    if (await profileExists(name)) {
      throw new Error(`Profile "${name}" already exists`);
    }
  }

  if (!name) throw new Error("Profile name is required");

  let config;
  if (options.nonInteractive && options.configPath) {
    const { readFile } = await import("node:fs/promises");
    const { parseConfig } = await import("./config.js");
    config = parseConfig(JSON.parse(await readFile(options.configPath, "utf8")));
  } else if (options.nonInteractive) {
    throw new Error("--non-interactive requires --config <path>");
  } else {
    config = await promptOssConfig({ excludeProfile: name });
  }

  await saveProfile(name, config, {
    label,
    setDefault: options.setDefault,
  });
  console.log(ui.green(`✓ 已写入 ${profileFilePath(name)}`));

  if (!options.skipConnectivity) {
    try {
      await withSpinner("正在检测 OSS 连通性", async () => {
        await testConnectivity(config);
      });
      console.log(ui.green("  ✓ Bucket 连通性正常"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(ui.yellow(`  ⚠ 连通性检测未通过：${msg}`));
    }
  }

  if (!options.nonInteractive) {
    const makeDefault =
      options.setDefault ??
      (await confirm({
        message: "是否设为全局默认账号（defaultProfile）？",
        default: !(await loadIndex()),
      }));
    if (makeDefault) {
      await setDefaultProfile(name);
      printHint(`默认账号已设为 ${ui.bold(name)}`);
    }

    const bind =
      options.bindProject ??
      (await confirm({
        message: `在当前目录写入 .ossput.json，绑定 profile「${name}」？`,
        default: true,
      }));
    if (bind) {
      const p = await writeProjectBinding(name);
      console.log(ui.green(`✓ 已写入 ${p}`));
    }
  } else {
    if (options.setDefault) await setDefaultProfile(name);
    if (options.bindProject) await writeProjectBinding(name);
  }
}

export async function runProfileUse(name: string, cwd?: string): Promise<void> {
  const valid = validateProfileName(name);
  if (valid !== true) throw new Error(valid);
  if (!(await profileExists(name))) {
    throw new Error(`Profile "${name}" not found. Run: ossput profile list`);
  }
  const path = await writeProjectBinding(name, cwd);
  console.log(ui.green(`✓ 已绑定 profile "${name}" → ${path}`));
}

export async function runProfileDefault(name: string): Promise<void> {
  await setDefaultProfile(name);
  console.log(ui.green(`✓ 默认 profile: ${name}`));
}

export async function runProfileRm(name: string): Promise<void> {
  await removeProfile(name);
  console.log(ui.green(`✓ 已删除 profile: ${name}`));
}

export async function runProfileCommand(
  sub: string,
  rest: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  switch (sub) {
    case "list":
    case "ls":
      await runProfileList();
      return 0;
    case "show":
      await runProfileShow(rest[0]);
      return 0;
    case "add": {
      await runProfileAdd({
        name: rest[0],
        nonInteractive: Boolean(flags.nonInteractive),
        configPath: typeof flags.config === "string" ? flags.config : undefined,
        skipConnectivity: Boolean(flags.skipConnectivity),
        setDefault: flags.setDefault === true || flags.setDefault === "true",
        bindProject: flags.bindProject === true || flags.bindProject === "true",
        label: typeof flags.label === "string" ? flags.label : undefined,
      });
      return 0;
    }
    case "use":
      if (!rest[0]) {
        console.error("Usage: ossput profile use <name>");
        return 1;
      }
      await runProfileUse(rest[0]);
      return 0;
    case "default":
      if (!rest[0]) {
        console.error("Usage: ossput profile default <name>");
        return 1;
      }
      await runProfileDefault(rest[0]);
      return 0;
    case "rm":
    case "remove":
      if (!rest[0]) {
        console.error("Usage: ossput profile rm <name>");
        return 1;
      }
      await runProfileRm(rest[0]);
      return 0;
    default:
      console.error(`Unknown profile command: ${sub}`);
      console.log(`Usage:
  ossput profile list
  ossput profile add [name]
  ossput profile show [name]
  ossput profile use <name>
  ossput profile default <name>
  ossput profile rm <name>`);
      return 1;
  }
}
