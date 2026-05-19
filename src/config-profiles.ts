import { readFile, writeFile, mkdir, access, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { constants } from "node:fs";
import type {
  AppConfig,
  OssputIndexConfig,
  ProfileBindingSource,
  ProjectBinding,
  ResolvedProfile,
} from "./types.js";
import {
  CONFIG_DIR,
  DEFAULT_ALLOWED,
  formatPrefixDisplay,
  normalizePrefix,
  parseConfig,
} from "./config.js";

export const INDEX_CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const PROFILES_DIR = join(CONFIG_DIR, "profiles");
export const PROJECT_CONFIG_FILENAME = ".ossput.json";

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export function validateProfileName(name: string): string | true {
  const t = name.trim();
  if (!t) return "Profile 名称不能为空";
  if (!PROFILE_NAME_RE.test(t)) {
    return "仅支持小写字母、数字、连字符，且不能以连字符开头";
  }
  return true;
}

export function profileFilePath(name: string): string {
  return join(PROFILES_DIR, `${name}.json`);
}

export async function ensureProfilesDir(): Promise<void> {
  await mkdir(PROFILES_DIR, { recursive: true, mode: 0o700 });
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

export function parseIndex(raw: unknown): OssputIndexConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid index config: expected JSON object");
  }
  const o = raw as Record<string, unknown>;
  const version = Number(o.version ?? 1);
  if (version !== 1) {
    throw new Error(`Unsupported config version: ${version}`);
  }
  const defaultProfile = String(o.defaultProfile ?? "").trim();
  const profilesRaw = o.profiles;
  if (!defaultProfile || !profilesRaw || typeof profilesRaw !== "object") {
    throw new Error("Invalid index: defaultProfile and profiles are required");
  }
  const profiles: OssputIndexConfig["profiles"] = {};
  for (const [key, val] of Object.entries(profilesRaw as Record<string, unknown>)) {
    const label =
      val && typeof val === "object" && "label" in val
        ? String((val as { label?: unknown }).label ?? "").trim() || undefined
        : undefined;
    profiles[key] = label ? { label } : {};
  }
  if (!profiles[defaultProfile]) {
    throw new Error(`defaultProfile "${defaultProfile}" is not in profiles`);
  }
  return { version: 1, defaultProfile, profiles };
}

export async function loadIndex(): Promise<OssputIndexConfig | null> {
  try {
    await access(INDEX_CONFIG_PATH, constants.R_OK);
  } catch {
    return null;
  }
  const raw = JSON.parse(await readFile(INDEX_CONFIG_PATH, "utf8"));
  return parseIndex(raw);
}

export async function saveIndex(index: OssputIndexConfig): Promise<void> {
  await ensureProfilesDir();
  await writeFile(
    INDEX_CONFIG_PATH,
    `${JSON.stringify(index, null, 2)}\n`,
    { mode: 0o600 },
  );
}

export async function indexExists(): Promise<boolean> {
  return (await loadIndex()) !== null;
}

export async function profileExists(name: string): Promise<boolean> {
  try {
    await access(profileFilePath(name), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function parseProjectBinding(raw: unknown): ProjectBinding {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid .ossput.json: expected object");
  }
  const o = raw as Record<string, unknown>;
  const forbidden = ["accessKeyId", "accessKeySecret", "bucket", "region"];
  for (const key of forbidden) {
    if (key in o) {
      throw new Error(`.ossput.json must not contain "${key}"; use profiles only`);
    }
  }
  const profile = String(o.profile ?? "").trim();
  const valid = validateProfileName(profile);
  if (valid !== true) throw new Error(valid);
  return { profile };
}

export async function findProjectOssputJson(
  startDir = process.cwd(),
): Promise<string | null> {
  let dir = resolve(startDir);
  const root = resolve("/");
  while (true) {
    const candidate = join(dir, PROJECT_CONFIG_FILENAME);
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch {
      /* not in this dir */
    }
    if (dir === root) break;
    dir = dirname(dir);
  }
  return null;
}

export async function readProjectBinding(
  cwd?: string,
): Promise<{ binding: ProjectBinding; path: string } | null> {
  const path = await findProjectOssputJson(cwd);
  if (!path) return null;
  const raw = JSON.parse(await readFile(path, "utf8"));
  return { binding: parseProjectBinding(raw), path };
}

export async function writeProjectBinding(
  profileName: string,
  cwd = process.cwd(),
): Promise<string> {
  const valid = validateProfileName(profileName);
  if (valid !== true) throw new Error(valid);
  const path = join(resolve(cwd), PROJECT_CONFIG_FILENAME);
  await writeFile(
    path,
    `${JSON.stringify({ profile: profileName }, null, 2)}\n`,
    "utf8",
  );
  return path;
}

export interface ResolveProfileOptions {
  profile?: string;
  cwd?: string;
}

export async function resolveActiveProfile(
  options: ResolveProfileOptions = {},
): Promise<ResolvedProfile> {
  if (options.profile?.trim()) {
    const name = options.profile.trim();
    const valid = validateProfileName(name);
    if (valid !== true) throw new Error(valid);
    return { name, source: "arg" };
  }

  const envProfile = process.env.OSSPUT_PROFILE?.trim();
  if (envProfile) {
    const name = envProfile;
    const valid = validateProfileName(name);
    if (valid !== true) throw new Error(valid);
    return { name, source: "env" };
  }

  const project = await readProjectBinding(options.cwd);
  if (project) {
    return {
      name: project.binding.profile,
      source: "project",
      projectFile: project.path,
    };
  }

  const index = await loadIndex();
  if (!index) {
    throw new Error(
      "ossput is not configured. Run: ossput setup  or  ossput profile add <name>",
    );
  }
  return { name: index.defaultProfile, source: "default" };
}

export async function loadProfileFile(name: string): Promise<AppConfig> {
  const path = profileFilePath(name);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot load profile "${name}" at ${path}: ${msg}`);
  }
  return parseConfig(raw);
}

async function applyEnvOverrides(config: AppConfig): Promise<AppConfig> {
  if (process.env.OSS_ACCESS_KEY_ID?.trim()) {
    config.accessKeyId = process.env.OSS_ACCESS_KEY_ID.trim();
  }
  if (process.env.OSS_ACCESS_KEY_SECRET?.trim()) {
    config.accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET.trim();
  }
  if (process.env.OSS_REGION?.trim()) config.region = process.env.OSS_REGION.trim();
  if (process.env.OSS_BUCKET?.trim()) config.bucket = process.env.OSS_BUCKET.trim();
  if (process.env.OSS_PREFIX?.trim()) {
    config.prefix = normalizePrefix(process.env.OSS_PREFIX);
  }
  return config;
}

export interface LoadConfigOptions extends ResolveProfileOptions {}

export async function loadConfigWithProfile(
  options: LoadConfigOptions = {},
): Promise<{ config: AppConfig; resolved: ResolvedProfile }> {
  const resolved = await resolveActiveProfile(options);
  if (!(await profileExists(resolved.name))) {
    throw new Error(
      `Profile "${resolved.name}" not found. Run: ossput profile list`,
    );
  }
  const config = await applyEnvOverrides(await loadProfileFile(resolved.name));
  return { config, resolved };
}

export async function configExists(): Promise<boolean> {
  const index = await loadIndex();
  if (!index) return false;
  return profileExists(index.defaultProfile);
}

export async function listProfileNames(): Promise<
  { name: string; label?: string; isDefault: boolean }[]
> {
  const index = await loadIndex();
  if (!index) return [];
  return Object.keys(index.profiles)
    .sort()
    .map((name) => ({
      name,
      label: index.profiles[name]?.label,
      isDefault: name === index.defaultProfile,
    }));
}

export async function saveProfile(
  name: string,
  config: AppConfig,
  options?: { label?: string; setDefault?: boolean },
): Promise<void> {
  const valid = validateProfileName(name);
  if (valid !== true) throw new Error(valid);

  await ensureProfilesDir();
  const payload = {
    region: config.region,
    bucket: config.bucket,
    prefix: formatPrefixDisplay(config.prefix),
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    presignExpiresSec: config.presignExpiresSec,
    allowedExtensions: config.allowedExtensions,
    endpoint: config.endpoint ?? null,
  };
  await writeFile(profileFilePath(name), `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });

  let index = await loadIndex();
  if (!index) {
    index = {
      version: 1,
      defaultProfile: name,
      profiles: {},
    };
  }
  index.profiles[name] = options?.label ? { label: options.label } : {};
  if (options?.setDefault === true) {
    index.defaultProfile = name;
  } else if (options?.setDefault !== false) {
    const count = Object.keys(index.profiles).length;
    if (count === 1 || !index.defaultProfile || !index.profiles[index.defaultProfile]) {
      index.defaultProfile = name;
    }
  }
  await saveIndex(index);
}

export async function setDefaultProfile(name: string): Promise<void> {
  const index = await loadIndex();
  if (!index) throw new Error("No profiles configured");
  if (!index.profiles[name]) {
    throw new Error(`Profile "${name}" is not registered in index`);
  }
  if (!(await profileExists(name))) {
    throw new Error(`Profile file for "${name}" does not exist`);
  }
  index.defaultProfile = name;
  await saveIndex(index);
}

export async function removeProfile(name: string): Promise<void> {
  const index = await loadIndex();
  if (!index) throw new Error("No profiles configured");
  if (!index.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  const names = Object.keys(index.profiles).filter((n) => n !== name);
  if (names.length === 0) {
    await unlink(INDEX_CONFIG_PATH).catch(() => {});
    await unlink(profileFilePath(name)).catch(() => {});
    return;
  }
  if (index.defaultProfile === name) {
    throw new Error(
      `Cannot remove default profile "${name}". Run: ossput profile default <other>`,
    );
  }
  delete index.profiles[name];
  await saveIndex(index);
  await unlink(profileFilePath(name)).catch(() => {});
}

export { DEFAULT_ALLOWED, formatPrefixDisplay };
