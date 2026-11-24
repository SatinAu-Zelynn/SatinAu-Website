const ALLOWED_PATHS = new Set(["/v1/chat", "/v1/blog/summary"]);

function jsonError(message, status = 500, code = "INTERNAL_ERROR") {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;

  if (!env.AI_ENGINE || typeof env.AI_ENGINE.fetch !== "function") {
    return jsonError("AI_ENGINE service binding is not configured", 503, "BINDING_MISSING");
  }

  const rawPath = Array.isArray(params.path)
    ? params.path.join("/")
    : String(params.path || "");
  const upstreamPath = `/${rawPath}`.replace(/\/+$/, "") || "/";

  if (!ALLOWED_PATHS.has(upstreamPath)) {
    return jsonError(`Route not found: ${upstreamPath}`, 404, "NOT_FOUND");
  }

  if (request.method !== "POST") {
    return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("Content-Type") || "application/json");
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  if (origin) headers.set("Origin", origin);
  if (referer) headers.set("Referer", referer);

  const upstreamUrl = new URL(upstreamPath, "https://ai-engine.internal");
  const upstreamRequest = new Request(upstreamUrl.toString(), {
    method: "POST",
    headers,
    body: request.body,
  });

  return env.AI_ENGINE.fetch(upstreamRequest);
}
