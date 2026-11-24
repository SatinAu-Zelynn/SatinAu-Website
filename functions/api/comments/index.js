import { buildCorsHeaders, json, error, verifyToken } from "../../_utils/db-auth.js";

async function moderateCommentViaAIEngine(env, commentId, content, pageId) {
  try {
    if (!env.AI_ENGINE || typeof env.AI_ENGINE.fetch !== "function") {
      console.error("AI_ENGINE binding missing, skipping moderation");
      return;
    }

    const res = await env.AI_ENGINE.fetch("https://ai-engine.internal/v1/comment/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    let status = "approved";
    if (res.ok) {
      const data = await res.json();
      if (data?.status === "rejected") {
        status = "rejected";
      }
    }

    await env.DB.prepare("UPDATE comments SET status = ? WHERE id = ?")
      .bind(status, commentId)
      .run();

    if (status === "approved") {
      await env.KV.delete(`comments:public:${pageId}`);
    }
  } catch (err) {
    console.error("AI Moderation Error:", err);
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request),
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = buildCorsHeaders(request);

  const url = new URL(request.url);
  const pageId = url.searchParams.get("page_id");
  const forceFresh = url.searchParams.get("fresh") === "1";
  if (!pageId) return error(cors, "Missing page_id");

  // 尝试从 KV 获取 "公开且已通过" 的评论缓存
  const cacheKey = `comments:public:${pageId}`;
  let publicComments = forceFresh ? null : await env.KV.get(cacheKey, { type: "json" });

  if (!publicComments) {
    // 缓存未命中，查数据库：只查 status = 'approved'
    const results = await env.DB.prepare(`
      SELECT 
        c.id, c.page_id, c.content, c.parent_id, c.created_at, c.user_id, c.status,
        u.nickname, u.avatar
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.page_id = ? AND c.status = 'approved'
      ORDER BY c.created_at DESC
    `).bind(pageId).all();
    
    publicComments = results.results || [];
    // 写入 KV 缓存 (1小时过期，因为有后台审核更新)
    await env.KV.put(cacheKey, JSON.stringify(publicComments), { expirationTtl: 3600 });
  }

  // 检查用户是否登录，如果登录，需合并显示 "我的待审核/未通过评论"
  const user = verifyToken(request);
  let finalComments = publicComments;

  if (user) {
    const myPendingComments = await env.DB.prepare(`
      SELECT 
        c.id, c.page_id, c.content, c.parent_id, c.created_at, c.user_id, c.status,
        u.nickname, u.avatar
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.page_id = ? AND c.user_id = ? AND c.status != 'approved'
      ORDER BY c.created_at DESC
    `).bind(pageId, user.id).all();

    if (myPendingComments.results && myPendingComments.results.length > 0) {
      // 合并两个数组
      finalComments = [...finalComments, ...myPendingComments.results];
      // 重新按时间倒序排序
      finalComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  const res = json(cors, finalComments);
  // 标记缓存状态供调试
  res.headers.set("X-Cache-Status", forceFresh ? "BYPASS_FRESH" : (user ? "MIXED" : "PUBLIC_KV"));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;
  const cors = buildCorsHeaders(request);

  const user = verifyToken(request); 
  if (!user) return error(cors, "Unauthorized", 401);

  const { page_id, content, parent_id } = await request.json();

  if (!page_id || !content) return error(cors, "Missing fields");
  if (content.length > 1000) return error(cors, "Content too long");

  // 插入数据库，状态默认为 'pending'
  const result = await env.DB.prepare(
    "INSERT INTO comments (page_id, user_id, content, parent_id, status) VALUES (?, ?, ?, ?, 'pending')"
  ).bind(page_id, user.id, content, parent_id || null).run();

  if (!result.success) {
    return error(cors, "Failed to post comment", 500);
  }

  const commentId = result.meta.last_row_id;

  // 在 onRequestPost 插入评论拿到 commentId 后调用：
  context.waitUntil(moderateCommentViaAIEngine(env, commentId, content, page_id));

  const res = json(cors, {
    id: commentId,
    page_id,
    user_id: user.id,
    content,
    parent_id: parent_id || null,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
