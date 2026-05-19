import { createOssClient } from "../oss-client.js";
import type { AppConfig } from "../types.js";

export async function testConnectivity(config: AppConfig): Promise<void> {
  const client = createOssClient(config);
  await client.getBucketInfo(config.bucket);
}
