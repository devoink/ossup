import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatPrefixDisplay } from "./config.js";
import {
  configExists,
  findProjectOssupJson,
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
import { inferContentType } from "./validators.js";
import { getPackageVersion } from "./setup/mcp-registry.js";

const profileField = z
  .string()
  .optional()
  .describe("Named profile; default from .ossup.json or global default");

const INSTRUCTIONS = `You are connected to ossup — Aliyun OSS direct upload (presigned PUT + curl).

When the user wants to upload files to OSS / 阿里云:
1. If not configured, ask them to run in terminal: npx ossup setup (do NOT ask for secrets in chat).
2. Call list_profiles or read .ossup.json for activeProfile; optional profile param overrides.
3. Prefer upload_file(localPath, subdir?). Object keys are: {prefix}{subdir}{YYYY}/{MM}/{uuid}.ext — not the original filename.
4. list_objects(format=markdown) for image previews; list_directories for folder prefixes.
5. Never upload .env, keys, or files over 100MB. Return objectUrl from tool results to the user.`;

async function requireResolved(profile?: string) {
  if (!(await configExists())) {
    throw new Error(
      "ossup is not configured. Run in terminal: npx ossup setup",
    );
  }
  return loadConfigWithProfile({ profile });
}

export async function startMcpServer(): Promise<void> {
  const version = await getPackageVersion();
  const server = new McpServer(
    {
      name: "ossup",
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
    },
    async () => {
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
      const projectFile = await findProjectOssupJson();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                profiles: rows,
                activeProfile: active?.resolved.name ?? null,
                bindingSource: active?.resolved.source ?? null,
                projectFile,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_setup_status",
    {
      description:
        "Check ossup configuration, active profile, and MCP client registration.",
      inputSchema: z.object({
        profile: profileField,
      }),
    },
    async ({ profile }) => {
      const configured = await configExists();
      const clientsConfigured = configured ? await listConfiguredClients() : [];
      let body: Record<string, unknown> = {
        configured,
        indexPath: INDEX_CONFIG_PATH,
        clientsConfigured,
        setupCommand: "npx ossup setup",
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
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
      };
    },
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
    },
    async ({ profile, subdir, format }) => {
      const { config } = await requireResolved(profile);
      const result = await listDirectories(config, { subdir });
      if (format === "markdown") {
        return {
          content: [
            { type: "text" as const, text: formatDirectoriesAsMarkdown(result) },
          ],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
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
    },
    async ({ profile, subdir, maxKeys, format, imagesOnly, previewMax }) => {
      const { config } = await requireResolved(profile);
      const result = await listObjects(config, { subdir, maxKeys, imagesOnly });
      if (format === "markdown") {
        return {
          content: [
            {
              type: "text" as const,
              text: formatListAsMarkdown(result, { previewMax }),
            },
          ],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "upload_file",
    {
      description:
        "Upload a local file to Aliyun OSS (presigned PUT + curl). Returns objectKey and objectUrl.",
      inputSchema: z.object({
        profile: profileField,
        localPath: z.string(),
        subdir: z.string().optional(),
        contentType: z.string().optional(),
      }),
    },
    async ({ profile, localPath, subdir, contentType }) => {
      const { config } = await requireResolved(profile);
      const result = await uploadFile(config, localPath, subdir, contentType);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
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
    },
    async ({ profile, filename, contentType, subdir, overwrite }) => {
      const { config } = await requireResolved(profile);
      const result = await prepareUpload(
        config,
        filename,
        contentType,
        subdir,
        overwrite ?? false,
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
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
    },
    async ({ profile, objectKey, expectedSizeBytes }) => {
      const { config } = await requireResolved(profile);
      const result = await confirmUpload(config, objectKey, expectedSizeBytes);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
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
    setupCommand: "npx ossup setup",
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
  };
}

export { inferContentType };
