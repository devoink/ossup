import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertDeleteEnabled,
  assertObjectKeyDeletable,
  normalizeObjectKey,
} from "../dist/object-key.js";

const withPrefix = {
  prefix: "blog/",
  allowDelete: true,
};

const bucketRoot = {
  prefix: "",
  allowDelete: true,
};

describe("normalizeObjectKey", () => {
  it("strips leading slashes", () => {
    assert.equal(normalizeObjectKey("/a/b.png"), "a/b.png");
  });

  it("rejects directory keys", () => {
    assert.throws(() => normalizeObjectKey("blog/"), /file/);
  });
});

describe("assertObjectKeyDeletable", () => {
  it("requires key under profile prefix", () => {
    const key = assertObjectKeyDeletable(withPrefix, "blog/2026/05/x.png");
    assert.equal(key, "blog/2026/05/x.png");
  });

  it("rejects keys outside prefix", () => {
    assert.throws(
      () => assertObjectKeyDeletable(withPrefix, "other/x.png"),
      /prefix/,
    );
  });

  it("requires depth when prefix is bucket root", () => {
    assert.throws(
      () => assertObjectKeyDeletable({ prefix: "", allowDelete: false }, "onlyone"),
      /allowDelete/,
    );
    const key = assertObjectKeyDeletable(bucketRoot, "ossput_test/2026/05/uuid.png");
    assert.equal(key, "ossput_test/2026/05/uuid.png");
  });
});

describe("assertDeleteEnabled", () => {
  it("requires allowDelete in profile", () => {
    assert.throws(
      () => assertDeleteEnabled({ allowDelete: false }),
      /disabled/,
    );
  });
});
