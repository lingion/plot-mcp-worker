export type JsonRpcId = string | number | null;

export function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, mcp-session-id",
    ...extra,
  };
}

export function jsonRpc(id: JsonRpcId, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: corsHeaders() });
}

export function jsonRpcError(id: JsonRpcId, code: number, message: string, data?: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message, data } }, { status: 200, headers: corsHeaders() });
}

export function toolResultPayload(result: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
}
