import { buildCorsHeaders, json, error } from "../../_utils/db-auth.js";

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request),
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = buildCorsHeaders(request);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return error(cors, "Unauthorized", 401);

  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token));
    
    if (payload.exp < Date.now()) return error(cors, "Token expired", 401);

    const userId = payload.uid;
    const cacheKey = `user:${userId}`;

    const cachedUser = await env.KV.get(cacheKey, { type: "json" });
    if (cachedUser) {
      const res = json(cors, cachedUser);
      res.headers.set("X-Cache", "HIT");
      return res;
    }

    const user = await env.DB.prepare(
      "SELECT id, nickname, email, avatar, created_at FROM users WHERE id = ?"
    ).bind(userId).first();

    if (user) {
      await env.KV.put(cacheKey, JSON.stringify(user), { expirationTtl: 3600 });
    }

    const res = json(cors, user);
    res.headers.set("X-Cache", "MISS");
    return res;

  } catch (e) {
    return error(cors, "Invalid token", 401);
  }
}
