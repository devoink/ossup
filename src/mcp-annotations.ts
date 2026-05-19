/** MCP tool annotation hints for clients (non-authoritative). */
export const MCP_READ_ONLY = {
  readOnlyHint: true,
  openWorldHint: true,
} as const;

export const MCP_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
} as const;

export const MCP_DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;
