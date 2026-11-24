import { buildCorsHeaders, json, error } from "../../_utils/db-auth.js";

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = buildCorsHeaders(request);

  // 1. 验证 Token (与 getUserProfile 逻辑相同)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return error(cors, "Unauthorized", 401);

  let userId;
  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return error(cors, "Token expired", 401);
    userId = payload.uid;
  } catch (e) {
    return error(cors, "Invalid token", 401);
  }

  // 2. 解析 FormData 获取文件
  const formData = await request.formData();
  const file = formData.get('avatar');

  if (!file || !(file instanceof File)) {
    return error(cors, "No file uploaded");
  }

  // 3. 校验大小 (后端二次校验，例如限制 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return error(cors, "File too large (Max 2MB)");
  }

  // 4. 将文件转换为 Base64 DataURI
  const arrayBuffer = await file.arrayBuffer();
  
  // 防止堆栈溢出的 Base64 转换方式
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  const mimeType = file.type || 'image/png';
  const avatarUrl = `data:${mimeType};base64,${base64}`;

  // 5. 更新数据库
  try {
    const result = await env.DB.prepare(
      "UPDATE users SET avatar = ? WHERE id = ?"
    ).bind(avatarUrl, userId).run();

    if (result.meta.changes === 0) {
      return error(cors, "User not found or update failed", 404);
    }

    await env.KV.delete(`user:${userId}`);

    // 6. 返回成功及新的头像地址
    return json(cors, { success: true, avatar: avatarUrl });

  } catch (e) {
    return error(cors, "Database error: " + e.message, 500);
  }
}
