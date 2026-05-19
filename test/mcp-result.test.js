import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mcpError,
  mcpErrorFromUnknown,
  mcpJson,
} from "../dist/mcp-result.js";

describe("mcp-result", () => {
  it("marks errors with isError", () => {
    const r = mcpError("failed", "npx ossput setup");
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /下一步/);
  });

  it("suggests setup for unconfigured", () => {
    const r = mcpErrorFromUnknown(new Error("ossput is not configured"));
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /setup/);
  });

  it("returns JSON for success", () => {
    const r = mcpJson({ ok: true });
    assert.equal(r.isError, undefined);
    assert.equal(JSON.parse(r.content[0].text).ok, true);
  });
});
