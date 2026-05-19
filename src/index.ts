#!/usr/bin/env node
import { runCli } from "./cli.js";
import { startMcpServer } from "./mcp.js";

const argv = process.argv.slice(2);
const subcommand = argv[0];

const MCP_MODE =
  !subcommand ||
  subcommand.startsWith("-") ||
  subcommand === "mcp" ||
  process.env.OSSPUT_MCP === "1";

async function main(): Promise<void> {
  if (MCP_MODE && (!subcommand || subcommand === "mcp")) {
    await startMcpServer();
    return;
  }

  const code = await runCli(argv);
  process.exit(code);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
