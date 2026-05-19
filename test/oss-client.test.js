import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { publicObjectUrl } from "../dist/oss-client.js";

const baseConfig = {
  region: "oss-cn-hangzhou",
  bucket: "my-bucket",
  prefix: "",
  accessKeyId: "x",
  accessKeySecret: "y",
  presignExpiresSec: 900,
  allowedExtensions: ["png"],
};

describe("publicObjectUrl", () => {
  it("uses publicBaseUrl when set", () => {
    const url = publicObjectUrl(
      { ...baseConfig, publicBaseUrl: "https://cdn.example.com" },
      "a/b.png",
    );
    assert.equal(url, "https://cdn.example.com/a/b.png");
  });

  it("falls back to regional endpoint", () => {
    const url = publicObjectUrl(baseConfig, "x/y.zip");
    assert.equal(
      url,
      "https://my-bucket.oss-cn-hangzhou.aliyuncs.com/x/y.zip",
    );
  });
});
