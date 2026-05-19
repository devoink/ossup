import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatPrefixDisplay } from "./config.js";
import {
  configExists,
  findProjectOssputJson,
  listProfileNames,
  loadConfigWithProfile,
  INDEX_CONFIG_PATH,
} from "./config-profiles.js";
import { listConfiguredClients } from "./setup/mcp-registry.js";
import {
  formatDirectoriesAsMarkdown,
  listDirectories,
} from "./list-directories.js";
import { formatListAsMarkdown } from "./list-format.js";
import { listObjects } from "./list-objects.js";
import {
  confirmUpload,
  prepareUpload,
  uploadFile,
} from "./upload-pipeline.js";
import { batchUploadFile, MAX_BATCH_FILES } from "./batch-upload.js";
import { deleteObject } from "./delete-object.js";
import { inferContentType } from "./validators.js";
import { getPackageVersion } from "./setup/mcp-registry.js";
import { mcpJson, mcpText, runMcpTool } from "./mcp-result.js";
import {
  MCP_DESTRUCTIVE,
  MCP_READ_ONLY,
  MCP_WRITE,
} from "./mcp-annotations.js";
import { NPX_DOCTOR, NPX_SETUP } from "./constants.js";

const profileField = z
  .string()
  .optional()
  .describe("Named profile; default from .ossput.json or global default");

const INSTRUCTIONS = `You are connected to ossput — manage Aliyun OSS files during development (upload, list, delete via MCP).

When the user wants to upload files to OSS / 阿里云:
1. If not configured, ask them to run in terminal: ${NPX_SETUP} (do NOT ask for secrets in chat).
2. Call list_profiles or read .ossput.json for activeProfile; optional profile param overrides.
3. Prefer upload_file(localPath, subdir?). Object keys are: {prefix}{subdir}{YYYY}/{MM}/{uuid}.ext — not the original filename.
4. list_objects(format=markdown) for image previews; list_directories for folder prefixes.
5. Never upload .env, keys, or files over 100MB. Return objectUrl from tool results to the user.
6. delete_object: ONLY after user confirms exact objectKey; requires profile allowDelete:true and confirm:true.
7. Multiple local files: prefer batch_upload_file (max ${MAX_BATCH_FILES} per call) over many upload_file calls.`;

async function requireResolved(profile?: string) {
  if (!(await configExists())) {
    throw new Error(
      `ossput is not configured. Run in terminal: ${NPX_SETUP}`,
    );
  }
  return loadConfigWithProfile({ profile });
}

export async function startMcpServer(): Promise<void> {
  const version = await getPackageVersion();
  const server = new McpServer(
    {
      name: "ossput",
      version,
    },
    {
      instructions: INSTRUCTIONS,
    },
  );

  server.registerTool(
    "list_profiles",
    {
      description:
        "List configured OSS profiles and which profile is active in the current workspace.",
      inputSchema: z.object({}),
      annotations: MCP_READ_ONLY,
    },
    async () =>
      runMcpTool(async () => {
        const rows = await listProfileNames();
        let active: Awaited<ReturnType<typeof loadConfigWithProfile>> | null =
          null;
        if (rows.length > 0) {
          try {
            active = await loadConfigWithProfile();
          } catch {
            active = null;
          }
        }
        const projectFile = await findProjectOssputJson();
        return mcpJson({
          profiles: rows,
          activeProfile: active?.resolved.name ?? null,
          bindingSource: active?.resolved.source ?? null,
          projectFile,
        });
      }),
  );

  server.registerTool(
    "get_setup_status",
    {
      description:
        "Check ossput configuration, active profile, and MCP client registration.",
      inputSchema: z.object({
        profile: profileField,
      }),
      annotations: MCP_READ_ONLY,
    },
    async ({ profile }) =>
      runMcpTool(async () => {
        const configured = await configExists();
        const clientsConfigured = configured
          ? await listConfiguredClients()
          : [];
        let body: Record<string, unknown> = {
          configured,
          indexPath: INDEX_CONFIG_PATH,
          clientsConfigured,
          setupCommand: NPX_SETUP,
          doctorCommand: NPX_DOCTOR,
        };
        if (configured) {
          const { config, resolved } = await loadConfigWithProfile({ profile });
          body = {
            ...body,
            activeProfile: resolved.name,
            bindingSource: resolved.source,
            projectFile: resolved.projectFile ?? null,
            prefix: formatPrefixDisplay(config.prefix),
            bucket: config.bucket,
            region: config.region,
            publicBaseUrl: config.publicBaseUrl ?? null,
            allowDelete: config.allowDelete === true,
          };
        }
        return mcpJson(body);
      }),
  );

  server.registerTool(
    "list_directories",
    {
      description:
        "List subdirectory prefixes under configured prefix. format=markdown for tree view.",
      inputSchema: z.object({
        profile: profileField,
        subdir: z.string().optional(),
        format: z.enum(["json", "markdown"]).optional(),
      }),
      annotations: MCP_READ_ONLY,
    },
    async ({ profile, subdir, format }) =>
      runMcpTool(async () => {
        const { config } = await requireResolved(profile);
        const result = await listDirectories(config, { subdir });
        if (format === "markdown") {
          return mcpText(formatDirectoriesAsMarkdown(result));
        }
        return mcpJson(result);
      }),
  );

  server.registerTool(
    "list_objects",
    {
      description:
        "List OSS objects. format=markdown for image previews; imagesOnly to filter images.",
      inputSchema: z.object({
        profile: profileField,
        subdir: z.string().optional(),
        maxKeys: z.number().int().min(1).max(1000).optional(),
        format: z.enum(["json", "markdown"]).optional(),
        imagesOnly: z.boolean().optional(),
        previewMax: z.number().int().min(1).max(50).optional(),
      }),
      annotations: MCP_READ_ONLY,
    },
    async ({ profile, subdir, maxKeys, format, imagesOnly, previewMax }) =>
      runMcpTool(async () => {
        const { config } = await requireResolved(profile);
        const result = await listObjects(config, {
          subdir,
          maxKeys,
          imagesOnly,
        });
        if (format === "markdown") {
          return mcpText(formatListAsMarkdown(result, { previewMax }));
        }
        return mcpJson(result);
      }),
  );

  server.registerTool(
    "upload_file",
    {
      description:
        "Upload a local file to Aliyun OSS (presigned PUT). Returns objectKey and objectUrl.",
      inputSchema: z.object({
        profile: profileField,
        localPath: z.string(),
        subdir: z.string().optional(),
        contentType: z.string().optional(),
      }),
      annotations: MCP_WRITE,
    },
    async ({ profile, localPath, subdir, contentType }) =>
      runMcpTool(async () => {
        const { config } = await requireResolved(profile);
        const result = await uploadFile(config, localPath, subdir, contentType);
        return mcpJson(result);
      }),
  );

  server.registerTool(
    "batch_upload_file",
    {
      description: `Batch upload local files (max ${MAX_BATCH_FILES} per call). Same rules as upload_file. Returns per-file success or error.`,
      inputSchema: z.object({
        profile: profileField,
        localPaths: z.array(z.string()).min(1).max(MAX_BATCH_FILES),
        subdir: z.string().optional(),
        contentType: z.string().optional(),
        stopOnError: z.boolean().optional(),
      }),
      annotations: MCP_WRITE,
    },
    async ({ profile, localPaths, subdir, contentType, stopOnError }) =>
      runMcpTool(async () => {
        const { config } = await requireResolved(profile);
        const result = await batchUploadFile(config, localPaths, {
          subdir,
          contentType,
          stopOnError: stopOnError ?? false,
        });
        return mcpJson(result);
      }),
  );

  server.registerTool(
    "delete_object",
    {
      description:
        "Delete one OSS object. Destructive: requires profile allowDelete:true, objectKey under profile prefix, and confirm:true after user approval.",
      inputSchema: z.object({
        profile: profileField,
        objectKey: z.string().describe("Exact key from list_objects or upload result"),
        confirm: z
          .literal(true)
          .describe("Must be true after the user explicitly confirms deletion"),
      }),
      annotations: MCP_DESTRUCTIVE,
    },
    async ({ profile, objectKey, confirm }) =>
      runMcpTool(async () => {
        const { config } = await requireResolved(profile);
        const result = await deleteObject(config, objectKey, { confirm });
        return mcpJson(result);
      }),
  );

  server.registerTool(
    "prepare_upload",
    {
      description: "Generate presigned PUT URL and objectKey.",
      inputSchema: z.object({
        profile: profileField,
        filename: z.string(),
        contentType: z.string(),
        subdir: z.string().optional(),
        overwrite: z.boolean().optional(),
      }),
      annotations: MCP_WRITE,
    },
    async ({ profile, filename, contentType, subdir, overwrite }) =>
      runMcpTool(async () => {
        const { config } = await requireResolved(profile);
        const result = await prepareUpload(
          config,
          filename,
          contentType,
          subdir,
          overwrite ?? false,
        );
        return mcpJson(result);
      }),
  );

  server.registerTool(
    "confirm_upload",
    {
      description: "Verify object exists on OSS after upload.",
      inputSchema: z.object({
        profile: profileField,
        objectKey: z.string(),
        expectedSizeBytes: z.number().optional(),
      }),
      annotations: MCP_READ_ONLY,
    },
    async ({ profile, objectKey, expectedSizeBytes }) =>
      runMcpTool(async () => {
        const { config } = await requireResolved(profile);
        const result = await confirmUpload(
          config,
          objectKey,
          expectedSizeBytes,
        );
        return mcpJson(result);
      }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function getSetupStatusJson(
  profile?: string,
): Promise<Record<string, unknown>> {
  const configured = await configExists();
  const base: Record<string, unknown> = {
    configured,
    indexPath: INDEX_CONFIG_PATH,
    clientsConfigured: configured ? await listConfiguredClients() : [],
    setupCommand: NPX_SETUP,
    doctorCommand: NPX_DOCTOR,
  };
  if (!configured) return base;
  const { config, resolved } = await loadConfigWithProfile({ profile });
  return {
    ...base,
    activeProfile: resolved.name,
    bindingSource: resolved.source,
    projectFile: resolved.projectFile ?? null,
    prefix: formatPrefixDisplay(config.prefix),
    bucket: config.bucket,
    region: config.region,
    publicBaseUrl: config.publicBaseUrl ?? null,
  };
}

export { inferContentType };
