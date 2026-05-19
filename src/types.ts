export interface AppConfig {
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  accessKeySecret: string;
  presignExpiresSec: number;
  allowedExtensions: string[];
  endpoint?: string | null;
  /** 公网访问根 URL，如 https://cdn.example.com（无尾斜杠） */
  publicBaseUrl?: string | null;
  /** 是否允许 delete_object（默认 false，须在 profile 中显式开启） */
  allowDelete?: boolean;
}

export interface OssputIndexConfig {
  version: 1;
  defaultProfile: string;
  profiles: Record<string, { label?: string }>;
}

export interface ProjectBinding {
  profile: string;
}

export type ProfileBindingSource = "arg" | "env" | "project" | "default";

export interface ResolvedProfile {
  name: string;
  source: ProfileBindingSource;
  projectFile?: string;
}

export interface PrepareUploadResult {
  bucket: string;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
}

export interface ConfirmUploadResult {
  exists: boolean;
  size: number;
  etag?: string;
  objectUrl: string;
  lastModified?: string;
}

export interface UploadFileResult extends ConfirmUploadResult {
  objectKey: string;
}

export interface OssObjectInfo {
  objectKey: string;
  size: number;
  lastModified: string;
  objectUrl: string;
}

export interface ListObjectsResult {
  prefix: string;
  count: number;
  objects: OssObjectInfo[];
  truncated: boolean;
}

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export interface DeleteObjectResult {
  objectKey: string;
  deleted: boolean;
  objectUrl: string;
}

export interface BatchUploadResult {
  subdir: string;
  total: number;
  succeeded: number;
  failed: number;
  results: Array<
    | {
        localPath: string;
        ok: true;
        result: UploadFileResult;
      }
    | {
        localPath: string;
        ok: false;
        error: string;
      }
  >;
}
