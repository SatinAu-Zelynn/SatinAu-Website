import { buildCorsHeaders, json, error, verifyToken } from "../../_utils/db-auth.js";

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request),
  });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const cors = buildCorsHeaders(request);
  const commentId = params.id;

  const user = verifyToken(request);
  if (!user) return error(cors, "Unauthorized", 401);

  // 1. 检查评论是否存在以及是否属于该用户
  const comment = await env.DB.prepare("SELECT user_id, page_id FROM comments WHERE id = ?").bind(commentId).first();
  
  if (!comment) return error(cors, "Comment not found", 404);
  
  if (comment.user_id !== user.id) return error(cors, "Forbidden", 403);

  try {
    // 2. 执行递归删除
    await env.DB.prepare(`
      WITH RECURSIVE targets(id) AS (
        SELECT id FROM comments WHERE id = ?
        UNION ALL
        SELECT c.id FROM comments c JOIN targets t ON c.parent_id = t.id
      )
      DELETE FROM comments WHERE id IN (SELECT id FROM targets);
    `).bind(commentId).run();

    await env.KV.delete(`comments:public:${comment.page_id}`);

    return json(cors, { success: true });
  } catch (e) {
    return error(cors, "Delete failed: " + e.message, 500);
  }
}
