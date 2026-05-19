import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { putPresignedFile } from "../dist/upload-pipeline.js";

describe("putPresignedFile", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it("sends PUT with file body and Content-Type", async () => {
    const file = join(tmpdir(), `ossput-test-${Date.now()}.bin`);
    await writeFile(file, "hello");

    let seen;
    globalThis.fetch = mock.fn(async (url, init) => {
      seen = { url, method: init.method, type: init.headers["Content-Type"] };
      return { ok: true, status: 200, text: async () => "" };
    });

    try {
      await putPresignedFile("https://example.com/obj", file, "text/plain");
      assert.equal(seen.url, "https://example.com/obj");
      assert.equal(seen.method, "PUT");
      assert.equal(seen.type, "text/plain");
    } finally {
      await unlink(file).catch(() => {});
    }
  });

  it("throws on non-ok HTTP status", async () => {
    const file = join(tmpdir(), `ossput-test-${Date.now()}.bin`);
    await writeFile(file, "x");

    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 403,
      text: async () => "AccessDenied",
    }));

    try {
      await assert.rejects(
        () => putPresignedFile("https://example.com/obj", file, "application/octet-stream"),
        /HTTP 403/,
      );
    } finally {
      await unlink(file).catch(() => {});
    }
  });
});
