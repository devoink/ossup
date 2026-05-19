import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildObjectKey } from "../dist/key-builder.js";

describe("buildObjectKey", () => {
  it("uses UUID filename by default", () => {
    const key = buildObjectKey("blog/", "demo/", "photo.png", false);
    assert.match(key, /^blog\/demo\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
  });

  it("keeps original filename when overwrite is true", () => {
    const key = buildObjectKey("", "x/", "My File.png", true);
    assert.match(key, /^x\/\d{4}\/\d{2}\/My_File\.png$/);
  });

  it("honors empty prefix as bucket root path", () => {
    const key = buildObjectKey("", "", "a.zip", false);
    assert.match(key, /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.zip$/);
  });
});
