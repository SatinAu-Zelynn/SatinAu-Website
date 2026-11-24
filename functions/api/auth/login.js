import { buildCorsHeaders, json, error, hashPassword, toHex, fromHex, validateTurnstile } from "../../_utils/db-auth.js";

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
    const { email, password, cfToken } = await request.json();

    const ip = request.headers.get('CF-Connecting-IP');
    const isHuman = await validateTurnstile(cfToken, env.TURNSTILE_SECRET_KEY, ip);

    if (!isHuman) {
      return error(cors, "Turnstile validation failed", 403);
    }
    
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (!user) return error(cors, "User not found", 401);

    // 验证密码
    const [saltHex, hashHex] = user.password_hash.split(':');
    const salt = fromHex(saltHex);
    const verifyHash = await hashPassword(password, salt);
    
    if (toHex(verifyHash) !== hashHex) {
      return error(cors, "Invalid password", 401);
    }

    // 生成 Token
    // 格式: userId.expiryTimestamp.signature(fake)
    const token = btoa(JSON.stringify({ uid: user.id, exp: Date.now() + 86400000 })); 

    return json(cors, { 
      token, 
      user: { id: user.id, nickname: user.nickname, email: user.email, avatar: user.avatar } 
    });
  } catch (e) {
    return error(cors, e.message, 500);
  }
}
