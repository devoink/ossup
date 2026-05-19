import {
  input,
  password,
  confirm,
  checkbox,
  select,
} from "@inquirer/prompts";
import type { AppConfig } from "../types.js";
import { DEFAULT_ALLOWED, normalizePrefix } from "../config.js";
import {
  configExists,
  indexExists,
  listProfileNames,
  loadConfigWithProfile,
  loadProfileFile,
  profileExists,
  validateProfileName,
} from "../config-profiles.js";
import { MCP_CLIENTS } from "./mcp-registry.js";
import {
  inquirerTheme,
  line,
  printHint,
  printStep,
  maskSecret,
  printWelcome,
  ui,
} from "./ui.js";
import { getPackageVersion } from "./mcp-registry.js";

const iq = { theme: inquirerTheme };

const OSS_REGIONS = [
  { value: "oss-cn-hangzhou", label: "华东 1（杭州）", description: "oss-cn-hangzhou" },
  { value: "oss-cn-shanghai", label: "华东 2（上海）", description: "oss-cn-shanghai" },
  { value: "oss-cn-nanjing", label: "华东 5（南京）", description: "oss-cn-nanjing" },
  { value: "oss-cn-beijing", label: "华北 2（北京）", description: "oss-cn-beijing" },
  { value: "oss-cn-qingdao", label: "华北 1（青岛）", description: "oss-cn-qingdao" },
  { value: "oss-cn-shenzhen", label: "华南 1（深圳）", description: "oss-cn-shenzhen" },
  { value: "oss-cn-guangzhou", label: "华南 3（广州）", description: "oss-cn-guangzhou" },
  { value: "oss-cn-chengdu", label: "西南 1（成都）", description: "oss-cn-chengdu" },
  { value: "oss-cn-hongkong", label: "中国香港", description: "oss-cn-hongkong" },
  { value: "__custom__", label: "其他地域（手动输入）", description: "自定义 region" },
] as const;

const EXTENSION_GROUPS = [
  { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
  {
    name: "文档",
    extensions: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"],
  },
  { name: "视频 / 压缩包", extensions: ["mp4", "mov", "zip"] },
];

function validateBucket(name: string): string | true {
  const v = name.trim();
  if (!v) return "Bucket 名称不能为空";
  if (v.length < 3 || v.length > 63) return "长度应在 3～63 个字符之间";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(v)) {
    return "只能包含小写字母、数字和连字符，且首尾不能为连字符";
  }
  return true;
}

function validateAccessKeyId(v: string): string | true {
  const s = v.trim();
  if (!s) return "AccessKey ID 不能为空";
  if (s.length < 8) return "格式似乎不正确，请检查是否复制完整";
  return true;
}

type SetupMode = "add" | "edit" | "mcp-only" | "cancel";

async function askSetupMode(): Promise<SetupMode> {
  if (!(await indexExists())) return "add";

  const rows = await listProfileNames();
  const names = rows.map((r) => r.name).join("、");
  printHint(`已有 ${rows.length} 个账号：${names}`);

  return select({
    ...iq,
    message: "接下来要做什么？",
    choices: [
      { value: "add" as const, name: "新增一个账号" },
      { value: "edit" as const, name: "编辑已有账号" },
      { value: "mcp-only" as const, name: "只更新 MCP 注册（不修改任何 profile）" },
      { value: "cancel" as const, name: "退出" },
    ],
  });
}

export async function promptProfileIdentity(options?: {
  name?: string;
  requireNew?: boolean;
  requireExists?: boolean;
}): Promise<{ name: string; label?: string }> {
  const name = await input({
    ...iq,
    message: "Profile 名称（小写，默认 default）",
    default: options?.name ?? "default",
    validate: async (v) => {
      const base = validateProfileName(v);
      if (base !== true) return base;
      const n = v.trim();
      if (options?.requireNew && (await profileExists(n))) {
        return `账号 ${n} 已存在，请换名或使用 ossup profile 编辑 ${n}`;
      }
      if (options?.requireExists && !(await profileExists(n))) {
        return `账号 ${n} 不存在`;
      }
      return true;
    },
  });

  const labelInput = await input({
    ...iq,
    message: "显示名称（可选，便于区分）",
    default: "",
  });
  const label = labelInput.trim() || undefined;

  return { name: name.trim(), label };
}

async function promptRegion(): Promise<string> {
  const picked = await select({
    ...iq,
    message: "Bucket 所在地域（Region）",
    choices: OSS_REGIONS.map((r) => ({
      value: r.value,
      name:
        r.value === "__custom__"
          ? r.label
          : `${r.label}  ${ui.dim(r.value)}`,
    })),
    pageSize: 10,
  });

  if (picked !== "__custom__") return picked;

  return input({
    ...iq,
    message: "请输入 Region（如 oss-cn-hangzhou）",
    validate: (v) => {
      const s = v.trim();
      if (!s) return "不能为空";
      if (!/^oss-[a-z0-9-]+$/.test(s)) {
        return "一般以 oss- 开头，例如 oss-cn-hangzhou";
      }
      return true;
    },
  });
}

type OssCredentials = Pick<AppConfig, "accessKeyId" | "accessKeySecret">;

async function promptManualCredentials(): Promise<OssCredentials> {
  printHint("请使用 RAM 子账号，并仅授权目标 Bucket 前缀的 PutObject / HeadObject。");
  const accessKeyId = await input({
    ...iq,
    message: "AccessKey ID",
    validate: validateAccessKeyId,
  });
  const accessKeySecret = await password({
    ...iq,
    message: "AccessKey Secret",
    mask: "*",
    validate: (v) => (v.trim() ? true : "不能为空"),
  });
  return {
    accessKeyId: accessKeyId.trim(),
    accessKeySecret: accessKeySecret.trim(),
  };
}

async function promptReuseOssupProfile(
  excludeProfile?: string,
): Promise<OssCredentials> {
  const rows = (await listProfileNames()).filter((r) => r.name !== excludeProfile);
  if (rows.length === 0) {
    throw new Error("没有可复用的 profile");
  }

  const sourceName =
    rows.length === 1
      ? rows[0]!.name
      : await select({
          ...iq,
          message: "选择要复用凭证的 profile",
          choices: rows.map((r) => ({
            value: r.name,
            name: r.label ? `${r.name} — ${r.label}` : r.name,
          })),
        });

  const source = await loadProfileFile(sourceName);
  printHint(
    `将复用 profile「${ui.bold(sourceName)}」的 AccessKey ${maskSecret(source.accessKeyId)}`,
  );

  return {
    accessKeyId: source.accessKeyId,
    accessKeySecret: source.accessKeySecret,
  };
}

async function promptCredentials(options?: {
  excludeProfile?: string;
}): Promise<OssCredentials> {
  const existingProfiles = (await listProfileNames()).filter(
    (r) => r.name !== options?.excludeProfile,
  );

  if (existingProfiles.length === 0) {
    return promptManualCredentials();
  }

  const hint =
    existingProfiles.length === 1
      ? `（${existingProfiles[0]!.name}）`
      : `（${existingProfiles.length} 个可选）`;

  const mode = await select({
    ...iq,
    message: "凭证来源",
    choices: [
      {
        value: "reuse" as const,
        name: `复用已有 profile 的 AccessKey${hint}`,
      },
      {
        value: "manual" as const,
        name: "手动输入 AccessKey（RAM 子账号推荐）",
      },
    ],
  });

  if (mode === "reuse") {
    return promptReuseOssupProfile(options?.excludeProfile);
  }

  return promptManualCredentials();
}

async function promptAllowedExtensions(): Promise<string[]> {
  const useDefault = await confirm({
    ...iq,
    message: "使用默认可上传类型？（图片、Office、PDF、MP4、ZIP）",
    default: true,
  });
  if (useDefault) return [...DEFAULT_ALLOWED];

  const choices = EXTENSION_GROUPS.flatMap((g) =>
    g.extensions.map((ext) => ({
      name: `${ext}`,
      value: ext,
      checked: DEFAULT_ALLOWED.includes(ext),
    })),
  );

  const selected = await checkbox({
    ...iq,
    message: "允许上传的扩展名（空格切换，回车确认）",
    choices,
    required: true,
    loop: false,
  });

  return selected.map((e) => e.toLowerCase());
}

export async function promptOssConfig(options?: {
  stepOffset?: number;
  stepTotal?: number;
  excludeProfile?: string;
}): Promise<AppConfig> {
  const base = options?.stepOffset ?? 1;
  const total = options?.stepTotal ?? 4;

  printStep(base, total, "Bucket 与路径");
  const region = await promptRegion();

  const bucket = await input({
    ...iq,
    message: "Bucket 名称",
    validate: validateBucket,
  });

  let prefix = await input({
    ...iq,
    message: "对象前缀（/ 表示 Bucket 根目录，或填 uploads/）",
    default: "/",
    validate: (v) => {
      const t = v.trim();
      if (!t || t === "/") return true;
      if (t.includes("..")) return "前缀不能包含 ..";
      return true;
    },
  });
  const normalized = normalizePrefix(prefix);
  if (!normalized) {
    printHint("将使用 Bucket 根目录（无前缀）");
  } else if (normalized !== prefix.trim() && !prefix.trim().endsWith("/")) {
    printHint(`已自动规范前缀为：${ui.bold(normalized)}`);
  }
  prefix = normalized;

  printStep(base + 1, total, "访问凭证");
  const creds = await promptCredentials({
    excludeProfile: options?.excludeProfile,
  });

  printStep(base + 2, total, "高级选项（可选）");
  const configureAdvanced = await confirm({
    ...iq,
    message: "配置高级选项？（Endpoint、签名有效期、文件类型）",
    default: false,
  });

  let endpoint: string | null = null;
  let presignExpiresSec = 900;
  let allowedExtensions = [...DEFAULT_ALLOWED];

  if (configureAdvanced) {
    const endpointInput = await input({
      ...iq,
      message: "自定义 Endpoint（内网 / VPC 时填写，公网留空）",
      default: "",
    });
    endpoint = endpointInput.trim() || null;

    const expiresChoice = await select({
      ...iq,
      message: "Presigned URL 有效期",
      choices: [
        { value: 900, name: "15 分钟（推荐）" },
        { value: 1800, name: "30 分钟" },
        { value: 3600, name: "1 小时" },
      ],
    });
    presignExpiresSec = expiresChoice;

    allowedExtensions = await promptAllowedExtensions();
  }

  return {
    region: region.trim(),
    bucket: bucket.trim(),
    prefix,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    presignExpiresSec,
    allowedExtensions,
    endpoint,
  };
}

export async function runInteractiveSetup(): Promise<{
  profileName: string;
  profileLabel?: string;
  config: AppConfig;
  clientIds: string[];
  skippedOssConfig: boolean;
  bindProject: boolean;
}> {
  const version = await getPackageVersion();
  printWelcome(version);

  const mode = await askSetupMode();
  if (mode === "cancel") {
    console.log("");
    line(ui.dim("已退出安装。"));
    console.log("");
    process.exit(0);
  }

  let profileName: string;
  let profileLabel: string | undefined;
  let config: AppConfig;
  let skippedOssConfig = false;

  if (mode === "mcp-only") {
    if (!(await configExists())) {
      throw new Error("尚无账号配置，请先新增账号");
    }
    const loaded = await loadConfigWithProfile();
    profileName = loaded.resolved.name;
    config = loaded.config;
    skippedOssConfig = true;
    printHint(`使用账号 ${ui.bold(profileName)}，跳过 OSS 设置。`);
  } else if (mode === "edit") {
    const rows = await listProfileNames();
    profileName = await select({
      ...iq,
      message: "选择要编辑的账号",
      choices: rows.map((r) => ({
        value: r.name,
        name: r.label ? `${r.name} — ${r.label}` : r.name,
      })),
    });
    const row = rows.find((r) => r.name === profileName);
    profileLabel = row?.label;
    config = await promptOssConfig({
      stepOffset: 2,
      stepTotal: 4,
      excludeProfile: profileName,
    });
  } else {
    printStep(1, 6, "账号标识");
    const identity = await promptProfileIdentity({ requireNew: true });
    profileName = identity.name;
    profileLabel = identity.label;
    config = await promptOssConfig({
      stepOffset: 2,
      stepTotal: 6,
      excludeProfile: profileName,
    });
  }

  let clientIds: string[] = [];
  let bindProject = false;

  if (mode === "mcp-only") {
    printStep(1, 1, "MCP 客户端");
  } else {
    const mcpStep = mode === "edit" ? 4 : 5;
    const mcpTotal = mode === "edit" ? 4 : 6;
    printStep(mcpStep, mcpTotal, "MCP 客户端");
  }
  printHint("将写入 mcp.json，不包含密钥。");
  clientIds = await promptForClients();

  if (!skippedOssConfig && mode !== "edit") {
    bindProject = await confirm({
      ...iq,
      message: `在当前目录写入 .ossup.json，绑定 profile「${profileName}」？`,
      default: true,
    });
  } else if (!skippedOssConfig && mode === "edit") {
    bindProject = await confirm({
      ...iq,
      message: `在当前目录写入 .ossup.json，绑定 profile「${profileName}」？`,
      default: false,
    });
  }

  return {
    profileName,
    profileLabel,
    config,
    clientIds,
    skippedOssConfig,
    bindProject,
  };
}

export async function promptForClients(): Promise<string[]> {
  const choices = MCP_CLIENTS.map((c) => {
    const p = c.resolveConfigPath();
    return {
      name: p ? `${c.displayName}  ${p}` : `${c.displayName}（当前系统不可用）`,
      value: c.id,
      checked: c.id === "cursor" || c.id === "claude-code",
      disabled: p ? false : true,
    };
  });

  return checkbox({
    ...iq,
    message: "要注册 MCP 的客户端（空格勾选，回车确认）",
    choices,
    required: true,
    loop: false,
  });
}

export async function promptOverwriteExisting(serverLabel: string): Promise<boolean> {
  return confirm({
    ...iq,
    message: `${serverLabel} 已有 ossup 配置且内容不同，是否覆盖？`,
    default: true,
  });
}
