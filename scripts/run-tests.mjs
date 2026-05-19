#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const dir = "test";
const entries = await readdir(dir);
const files = entries
  .filter((name) => name.endsWith(".test.js"))
  .map((name) => join(dir, name))
  .sort();

if (files.length === 0) {
  console.error("No test files found in test/");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
