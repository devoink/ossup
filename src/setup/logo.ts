const supportsColor =
  process.stdout.isTTY && process.env.NO_COLOR !== "1" && process.env.TERM !== "dumb";

function style(codes: string, text: string): string {
  return supportsColor ? `\x1b[${codes}m${text}\x1b[0m` : text;
}

const front = (t: string) => style("1;96", t);
const dim = (t: string) => style("2", t);

/** ANSI-Shadow 风格 OSSUP 整字标 */
const LOGO_LINES = [
  " ██████╗  ██████╗  ██████╗  ██╗   ██╗ ███████╗ ",
  "██╔═══██╗ ██╔════╝ ██╔════╝ ██║   ██║ ██    ██╗",
  "██║   ██║ ╚█████╗  ╚█████╗  ██║   ██║ ██████╔╝ ",
  "██║   ██║  ╚═══██╗  ╚═══██╗ ██║   ██║ ██║      ",
  "╚██████╔╝ ██████╔╝ ██████╔╝ ╚██████╔╝ ██║      ",
  " ╚═════╝ ╚═════╝  ╚═════╝   ╚═════╝   ╚══╝     ",
] as const;

function pad(text: string, spaces: number): string {
  return " ".repeat(spaces) + text;
}

export function printAsciiLogo(version?: string): void {
  console.log("");
  for (const row of LOGO_LINES) {
    console.log(pad(front(row), 2));
  }

  const tag =
    version != null
      ? `── ossup v${version} · Aliyun OSS direct upload MCP ──`
      : "── ossup · Aliyun OSS MCP ──";
  console.log("");
  console.log(pad(dim(tag), 2));
  console.log("");
}
