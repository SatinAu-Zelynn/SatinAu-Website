import { buildCorsHeaders, json, error, verifyToken } from "../../_utils/db-auth.js";

async function safeKvGet(env, key) {
  try {
    if (!env.KV) return null;
    return await env.KV.get(key, { type: "json" });
  } catch (err) {
    console.warn("KV get failed:", key, err);
    return null;
  }
}

async function safeKvPut(env, key, value, ttl = 3600) {
  try {
    if (!env.KV) return;
    await env.KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (err) {
    console.warn("KV put failed:", key, err);
  }
}

async function safeKvDelete(env, key) {
  try {
    if (!env.KV) return;
    await env.KV.delete(key);
  } catch (err) {
    console.warn("KV delete failed:", key, err);
  }
}

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
      await safeKvDelete(env, `comments:public:${pageId}`);
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

  try {
    const user = verifyToken(request);
    const cacheKey = `comments:public:${pageId}`;
    let finalComments = [];
    let cacheStatus = "PUBLIC_KV";

    if (forceFresh) {
      // 轮询/强刷模式只直查 D1，不写 KV，避免触发 1 write/sec 限流与竞态覆盖
      const results = user
        ? await env.DB.prepare(`
            SELECT
              c.id, c.page_id, c.content, c.parent_id, c.created_at, c.user_id, c.status,
              u.nickname, u.avatar
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.page_id = ? AND (c.status = 'approved' OR c.user_id = ?)
            ORDER BY c.created_at DESC
          `).bind(pageId, user.id).all()
        : await env.DB.prepare(`
            SELECT
              c.id, c.page_id, c.content, c.parent_id, c.created_at, c.user_id, c.status,
              u.nickname, u.avatar
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.page_id = ? AND c.status = 'approved'
            ORDER BY c.created_at DESC
          `).bind(pageId).all();

      finalComments = results.results || [];
      cacheStatus = "BYPASS_FRESH";
    } else {
      let publicComments = await safeKvGet(env, cacheKey);
      if (!Array.isArray(publicComments)) {
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
        cacheStatus = "D1_MISS";
        // 异步回填 KV，不阻塞响应且异常不影响返回
        context.waitUntil(safeKvPut(env, cacheKey, publicComments, 3600));
      }

      finalComments = publicComments;
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
          finalComments = [...finalComments, ...myPendingComments.results];
          finalComments.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          cacheStatus = "MIXED";
        }
      }
    }

    const res = json(cors, finalComments);
    res.headers.set("X-Cache-Status", cacheStatus);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("GET /api/comments error:", err);
    return error(cors, "Failed to load comments", 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = buildCorsHeaders(request);

  const user = verifyToken(request);
  if (!user) return error(cors, "Unauthorized", 401);

  const { page_id, content, parent_id } = await request.json();

  if (!page_id || !content) return error(cors, "Missing fields");
  if (content.length > 1000) return error(cors, "Content too long");

  const result = await env.DB.prepare(
    "INSERT INTO comments (page_id, user_id, content, parent_id, status) VALUES (?, ?, ?, ?, 'pending')"
  ).bind(page_id, user.id, content, parent_id || null).run();

  if (!result.success) {
    return error(cors, "Failed to post comment", 500);
  }

  const commentId = result.meta.last_row_id;

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
