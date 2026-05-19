import { installAgentSkills, type SkillTargetId } from "./setup/skill-install.js";
import { ui } from "./setup/ui.js";

export interface SkillInstallOptions {
  targets?: SkillTargetId[];
}

export async function runSkillInstall(
  options: SkillInstallOptions = {},
): Promise<void> {
  const results = await installAgentSkills(options.targets);
  for (const r of results) {
    console.log(
      ui.green(`✓ ${r.target.displayName}`) +
        ui.dim(` — ${r.action}`) +
        `\n  ${r.dest}`,
    );
  }
  console.log("");
  console.log(ui.dim("新开 Agent 会话后 Skill 生效；Claude Code 可用 /ossup 调用。"));
}

export async function runSkillCommand(
  sub: string,
  _rest: string[],
  flags: Record<string, string | boolean>,
): Promise<number> {
  switch (sub) {
    case "install": {
      let targets: SkillTargetId[] | undefined;
      if (flags.cursor === true) {
        targets = [...(targets ?? []), "cursor"];
      }
      if (flags.claude === true) {
        targets = [...(targets ?? []), "claude"];
      }
      await runSkillInstall({ targets });
      return 0;
    }
    default:
      console.error(`Unknown skill command: ${sub || "(none)"}`);
      console.log(`Usage:
  ossup skill install          安装到 ~/.cursor/skills 与 ~/.claude/skills
  ossup skill install --cursor   仅 Cursor
  ossup skill install --claude   仅 Claude Code`);
      return 1;
  }
}
