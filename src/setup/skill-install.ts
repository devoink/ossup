import { access, cp, lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";

export const SKILL_NAME = "ossup";

export type SkillTargetId = "cursor" | "claude";

export interface SkillTarget {
  id: SkillTargetId;
  displayName: string;
  resolvePath: () => string;
}

export const SKILL_TARGETS: SkillTarget[] = [
  {
    id: "cursor",
    displayName: "Cursor（用户级）",
    resolvePath: () => join(homedir(), ".cursor", "skills", SKILL_NAME),
  },
  {
    id: "claude",
    displayName: "Claude Code（用户级）",
    resolvePath: () => join(homedir(), ".claude", "skills", SKILL_NAME),
  },
];

/** npm 包内 `.cursor/skills/ossup` 的绝对路径 */
export function resolveBundledSkillDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", ".cursor", "skills", SKILL_NAME);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function sameSymlinkTarget(linkPath: string, expectedSrc: string): Promise<boolean> {
  try {
    const st = await lstat(linkPath);
    if (!st.isSymbolicLink()) return false;
    const raw = await readlink(linkPath);
    return resolve(dirname(linkPath), raw) === resolve(expectedSrc);
  } catch {
    return false;
  }
}

export interface SkillInstallResult {
  target: SkillTarget;
  dest: string;
  action: string;
}

export async function installSkillToTarget(
  target: SkillTarget,
  options?: { preferSymlink?: boolean },
): Promise<SkillInstallResult> {
  const src = resolve(resolveBundledSkillDir());
  const dest = target.resolvePath();

  try {
    await access(src, constants.R_OK);
  } catch {
    throw new Error(`找不到内置 Skill：${src}`);
  }

  if (await sameSymlinkTarget(dest, src)) {
    return { target, dest, action: "已链接（无需更新）" };
  }

  if (await pathExists(dest)) {
    await rm(dest, { recursive: true, force: true });
  }

  await mkdir(dirname(dest), { recursive: true });

  const preferSymlink = options?.preferSymlink !== false;
  if (preferSymlink) {
    try {
      const type = process.platform === "win32" ? "junction" : "dir";
      await symlink(src, dest, type);
      return { target, dest, action: "已创建符号链接" };
    } catch {
      /* fall through to copy */
    }
  }

  await cp(src, dest, { recursive: true });
  return { target, dest, action: "已复制（符号链接不可用）" };
}

export async function installAgentSkills(
  targetIds?: SkillTargetId[],
): Promise<SkillInstallResult[]> {
  const ids = targetIds ?? SKILL_TARGETS.map((t) => t.id);
  const results: SkillInstallResult[] = [];
  for (const id of ids) {
    const target = SKILL_TARGETS.find((t) => t.id === id);
    if (!target) continue;
    results.push(await installSkillToTarget(target));
  }
  return results;
}
