export function buildCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const isAllowedOrigin = /^https:\/\/(?:[a-zA-Z0-9-]+\.)*satinau\.cn(?::\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "https://satinau.cn",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

export function json(cors, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function error(cors, msg, status = 400) {
  return json(cors, { error: msg }, status);
}

export function verifyToken(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return { id: payload.uid };
  } catch {
    return null;
  }
}
