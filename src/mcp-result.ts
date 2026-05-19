type TextContent = { type: "text"; text: string };

export type McpToolResult = {
  content: TextContent[];
  isError?: boolean;
};

export function mcpJson(data: unknown): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function mcpText(text: string): McpToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

export function mcpError(message: string, nextStep?: string): McpToolResult {
  const lines = [message];
  if (nextStep) {
    lines.push("", `下一步：${nextStep}`);
  }
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    isError: true,
  };
}

export function mcpErrorFromUnknown(err: unknown): McpToolResult {
  const message = err instanceof Error ? err.message : String(err);
  let nextStep: string | undefined;

  if (/not configured|未配置/i.test(message)) {
    nextStep = "在终端运行 npx ossup setup，然后重启 IDE";
  } else if (/upload failed|OSS upload/i.test(message)) {
    nextStep = "检查网络、RAM 权限与 presigned URL 是否过期";
  } else if (/fetch|Node\.js 18/i.test(message)) {
    nextStep = "使用 Node.js 18 或更高版本";
  } else if (/extension|subdir|refusing/i.test(message)) {
    nextStep = "检查文件类型、subdir 命名或是否误选敏感文件";
  } else if (/AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch/i.test(message)) {
    nextStep = "检查 RAM 权限与 AccessKey，或运行 ossup doctor";
  }

  return mcpError(message, nextStep);
}

export async function runMcpTool<T extends McpToolResult>(
  fn: () => Promise<T>,
): Promise<McpToolResult> {
  try {
    return await fn();
  } catch (err) {
    return mcpErrorFromUnknown(err);
  }
}
