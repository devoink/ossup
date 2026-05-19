import OSS from "ali-oss";
import type { AppConfig } from "./types.js";

export function createOssClient(config: AppConfig): OSS {
  const opts: OSS.Options = {
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: true,
  };
  if (config.endpoint) {
    opts.endpoint = config.endpoint;
  }
  return new OSS(opts);
}

export function publicObjectUrl(config: AppConfig, objectKey: string): string {
  if (config.endpoint) {
    const host = config.endpoint.replace(/^https?:\/\//, "");
    return `https://${config.bucket}.${host}/${objectKey}`;
  }
  return `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;
}
