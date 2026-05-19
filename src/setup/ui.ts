const supportsColor =
  process.stdout.isTTY && process.env.NO_COLOR !== "1" && process.env.TERM !== "dumb";

function c(code: string, text: string): string {
  return supportsColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export const ui = {
  bold: (t: string) => c("1", t),
  dim: (t: string) => c("2", t),
  green: (t: string) => c("32", t),
  yellow: (t: string) => c("33", t),
  cyan: (t: string) => c("36", t),
  red: (t: string) => c("31", t),
};

const MARGIN = "  ";

export function line(text = ""): void {
  console.log(MARGIN + text);
}

function rule(char = "─", width = 44): void {
  line(ui.dim(char.repeat(width)));
}

import { printAsciiLogo } from "./logo.js";

/** 统一 inquirer 前缀，避免默认 `?` 与正文脱节 */
export const inquirerTheme = {
  style: {
    answer: (text: string) => ui.green(text),
    highlight: (text: string) => ui.cyan(text),
    description: (text: string) => ui.dim(text),
  },
  prefix: supportsColor ? c("36", "›") : ">",
};

export function printWelcome(version: string): void {
  printAsciiLogo(version);
  rule("═");
  line(ui.bold("安装向导"));
  line(ui.dim("阿里云 OSS 直传 · 一键配置 MCP"));
  rule("═");
  console.log("");
  line(ui.dim("将依次完成："));
  bullet("创建本机账号配置（profiles/，密钥不会写入 mcp.json）");
  bullet("注册 Cursor / Claude Desktop 等 MCP 客户端");
  bullet("检测与 Bucket 的连通性");
  console.log("");
  line(ui.dim("请在下方终端输入 AccessKey，勿粘贴到 AI 对话中。"));
  console.log("");
}

function bullet(text: string): void {
  line(`${ui.dim("·")} ${text}`);
}

function numbered(n: number, text: string): void {
  line(`${ui.dim(String(n).padStart(2))}  ${text}`);
}

export function printStep(current: number, total: number, title: string): void {
  console.log("");
  rule();
  line(
    ui.dim(`[${current}/${total}]`) + "  " + ui.bold(title),
  );
  rule();
  console.log("");
}

export function printBlock(title: string): void {
  console.log("");
  line(ui.bold(title));
}

export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible) return "****";
  return `${value.slice(0, visible)}${"*".repeat(Math.min(12, value.length - visible))}`;
}

export function printConfigSummary(
  config: {
    region: string;
    bucket: string;
    prefix: string;
    accessKeyId: string;
    endpoint?: string | null;
    presignExpiresSec: number;
    allowedExtensions: string[];
  },
  configPath: string,
  profile?: { name: string; label?: string },
): void {
  printBlock("确认配置");
  console.log("");
  const rows: [string, string][] = [
    ...(profile
      ? [
          [
            "Profile",
            profile.label ? `${profile.name}（${profile.label}）` : profile.name,
          ] as [string, string],
        ]
      : []),
    ["Region", config.region],
    ["Bucket", config.bucket],
    ["Prefix", config.prefix ? config.prefix : "/ (根目录)"],
    ["AccessKey ID", maskSecret(config.accessKeyId, 6)],
    ["URL expires", `${config.presignExpiresSec}s`],
    ["Endpoint", config.endpoint || ui.dim("(default public)")],
    ["Extensions", config.allowedExtensions.join(", ")],
    ["Config file", configPath],
  ];
  for (const [k, v] of rows) {
    line(`${ui.dim(pad(k, 12))}  ${v}`);
  }
  console.log("");
}

function pad(s: string, n: number): string {
  const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
  return s + " ".repeat(Math.max(0, n - w));
}

export async function withSpinner<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!process.stdout.isTTY) {
    line(ui.dim(`${label}...`));
    return fn();
  }

  const frames = ["-", "\\", "|", "/"];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${MARGIN}${ui.cyan(frames[i++ % frames.length])} ${label}...`);
  }, 120);

  try {
    return await fn();
  } finally {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K");
  }
}

export function printSuccessFooter(
  clients: { name: string; path: string; action: string }[],
  activeProfile?: string,
  skills: { target: { displayName: string }; dest: string; action: string }[] = [],
): void {
  console.log("");
  rule("═");
  line(ui.green(ui.bold("安装完成")));
  rule("═");
  console.log("");

  if (clients.length > 0) {
    line(ui.bold("MCP 配置"));
    for (const cl of clients) {
      line(`  ${ui.dim("·")} ${cl.name}  ${ui.dim(`(${cl.action})`)}`);
      line(ui.dim(`    ${cl.path}`));
    }
    console.log("");
  }

  if (skills.length > 0) {
    line(ui.bold("Agent Skill（用户级）"));
    for (const sk of skills) {
      line(`  ${ui.dim("·")} ${sk.target.displayName}  ${ui.dim(`(${sk.action})`)}`);
      line(ui.dim(`    ${sk.dest}`));
    }
    console.log("");
  }

  line(ui.bold("接下来"));
  numbered(1, "完全退出并重新打开 Cursor / Claude Desktop / Claude Code");
  numbered(2, "设置 → MCP → 确认 " + ui.bold("ossup") + " 已连接");
  if (skills.length > 0) {
    numbered(3, "新开 Agent 会话；Skill 已写入本机目录，无需复制到项目");
  }
  const n = skills.length > 0 ? 4 : 3;
  if (activeProfile) {
    numbered(n, `本仓库 profile: ${ui.bold(activeProfile)}（见 .ossup.json）`);
    numbered(n + 1, "对 Agent 说：把 ./file.png 上传到 OSS，目录 demo/test");
  } else {
    numbered(n, "对 Agent 说：把 ./file.png 上传到 OSS，目录 demo/test");
  }
  console.log("");
  line(ui.dim("命令行：npx ossup put ./file.png --subdir demo/test"));
  console.log("");
}

export function printHint(message: string): void {
  console.log("");
  line(ui.dim(`提示：${message}`));
}

export function printWarn(message: string): void {
  line(ui.yellow(`注意：${message}`));
}

export function printError(message: string): void {
  line(ui.red(`错误：${message}`));
}
