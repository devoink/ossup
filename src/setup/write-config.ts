import type { AppConfig } from "../types.js";
import {
  profileFilePath,
  saveProfile,
} from "../config-profiles.js";

export async function writeProfileConfig(
  name: string,
  config: AppConfig,
  options?: { label?: string; setDefault?: boolean },
): Promise<string> {
  await saveProfile(name, config, options);
  return profileFilePath(name);
}
