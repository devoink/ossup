import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { lstat, readlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  configExists,
  findProjectOssupJson,
  listProfileNames,
  loadConfigWithProfile,
  INDEX_CONFIG_PATH,
} from "./config-profiles.js";
import { listConfiguredClients, MCP_CLIENTS } from "./setup/mcp-registry.js";
import { SKILL_TARGETS, resolveBundledSkillDir } from "./setup/skill-install.js";
import { testConnectivity } from "./setup/connectivity.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

async function pathOk(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function checkSkillTarget(dest: string): Promise<string> {
  if (!(await pathOk(dest))) {
    return "未安装（运行 ossup skill install）";
  }
  try {
    const st = await lstat(dest);
    if (st.isSymbolicLink()) {
      const target = await readlink(dest);
      const resolved = resolve(dirname(dest), target);
      const bundled = resolve(resolveBundledSkillDir());
      if (resolve(resolved) === resolve(bundled)) {
        return `已链接 → ${resolved}`;
      }
      return `符号链接 → ${resolved}`;
    }
    return "已复制（非符号链接，升级包后建议重装 Skill）";
  } catch {
    return "存在但无法读取";
  }
}

export async function runDoctor(profile?: string): Promise<{
  checks: DoctorCheck[];
  ok: boolean;
}> {
  const checks: DoctorCheck[] = [];

  const nodeMajor = Number(process.version.slice(1).split(".")[0]);
  checks.push({
    name: "Node.js",
    ok: nodeMajor >= 18,
    detail: nodeMajor >= 18 ? process.version : `${process.version}（需要 ≥18）`,
  });

  const curl = spawnSync("curl", ["--version"], { encoding: "utf8" });
  checks.push({
    name: "curl",
    ok: curl.status === 0,
    detail:
      curl.status === 0
        ? (curl.stdout.split("\n")[0] ?? "ok")
        : "未找到（上传依赖 curl）",
  });

  const configured = await configExists();
  checks.push({
    name: "OSS 配置",
    ok: configured,
    detail: configured ? INDEX_CONFIG_PATH : `未配置（运行 npx ossup setup）`,
  });

  if (configured) {
    try {
      const rows = await listProfileNames();
      const { config, resolved } = await loadConfigWithProfile({ profile });
      checks.push({
        name: "当前 Profile",
        ok: true,
        detail: `${resolved.name}（${resolved.source}）· ${config.bucket}`,
      });
      checks.push({
        name: "Profile 数量",
        ok: rows.length > 0,
        detail: String(rows.length),
      });

      try {
        await testConnectivity(config);
        checks.push({
          name: "Bucket 连通性",
          ok: true,
          detail: "可访问",
        });
      } catch (e) {
        checks.push({
          name: "Bucket 连通性",
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    } catch (e) {
      checks.push({
        name: "配置加载",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const clients = configured ? await listConfiguredClients() : [];
  checks.push({
    name: "MCP 注册",
    ok: clients.length > 0,
    detail:
      clients.length > 0
        ? clients
            .map(
              (id) =>
                MCP_CLIENTS.find((c) => c.id === id)?.displayName ?? id,
            )
            .join(", ")
        : "未注册（运行 ossup setup）",
  });

  for (const target of SKILL_TARGETS) {
    const dest = target.resolvePath();
    const detail = await checkSkillTarget(dest);
    checks.push({
      name: `Skill · ${target.displayName}`,
      ok: await pathOk(dest),
      detail,
    });
  }

  const projectFile = await findProjectOssupJson();
  if (projectFile) {
    checks.push({
      name: "项目绑定",
      ok: true,
      detail: projectFile,
    });
  }

  const ok = checks.every((c) => c.ok);
  return { checks, ok };
}
