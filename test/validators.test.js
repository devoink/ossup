import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateSubdir,
  getExtension,
  inferContentType,
} from "../dist/validators.js";

describe("validateSubdir", () => {
  it("normalizes trailing slash", () => {
    assert.equal(validateSubdir("ossput_test"), "ossput_test/");
  });

  it("rejects path traversal", () => {
    assert.throws(() => validateSubdir("../etc"), /must not contain/);
  });

  it("rejects reserved prod prefixes", () => {
    assert.throws(() => validateSubdir("prod"), /not allowed/);
  });
});

describe("content type helpers", () => {
  it("detects extension", () => {
    assert.equal(getExtension("a.PNG"), "png");
  });

  it("infers image/png", () => {
    assert.equal(inferContentType("x.png"), "image/png");
  });
});
