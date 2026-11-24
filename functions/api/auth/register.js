import { buildCorsHeaders, json, error, hashPassword, toHex, validateTurnstile } from "../../_utils/db-auth.js";

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = buildCorsHeaders(request);

  try {
    const { email, password, nickname, cfToken } = await request.json();
    
    if (!email || !password || !nickname) 
      return error(cors, "Missing fields");

    const ip = request.headers.get('CF-Connecting-IP');
    const isHuman = await validateTurnstile(cfToken, env.TURNSTILE_SECRET_KEY, ip);
    
    if (!isHuman) {
      return error(cors, "Turnstile validation failed (Are you a robot?)", 403);
    }

    // 1. 检查邮箱是否存在
    const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (exists) return error(cors, "Email already exists", 409);

    // 2. 密码哈希 (PBKDF2)
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPassword(password, salt);
    const storedPass = `${toHex(salt)}:${toHex(hash)}`; // 格式: salt:hash

    // 3. 插入数据库
    await env.DB.prepare(
      "INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)"
    ).bind(email, storedPass, nickname).run();

    return json(cors, { success: true });
  } catch (e) {
    return error(cors, e.message, 500);
  }
}
