/*
  Cloudflare Pages Function - Qzone recent posts
  This endpoint uses an undocumented Qzone interface and requires server-side credentials.
*/

function getCookieValue(cookie, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`));
  return match ? match[1] : '';
}

function getGtk(skey) {
  let hash = 5381;
  for (let i = 0; i < skey.length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function parseJsonp(body) {
  const start = body.indexOf('(');
  const end = body.lastIndexOf(')');
  const json = start >= 0 && end > start ? body.slice(start + 1, end) : body.trim();
  return JSON.parse(json);
}

function toUnixTimestamp(post) {
  const seconds = Number(post.created_time || post.create_time || 0);
  if (Number.isFinite(seconds) && seconds > 0) return Math.floor(seconds);

  const parsedDate = Date.parse(post.createTime || '');
  return Number.isNaN(parsedDate) ? 0 : Math.floor(parsedDate / 1000);
}

function jsonResponse(body, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, message: 'Method Not Allowed', posts: [] }, 405);
  }

  const uin = env.QZONE_UIN || '';
  const cookie = env.QZONE_COOKIE || '';
  if (!/^\d{5,12}$/.test(uin) || !cookie) {
    return jsonResponse({
      success: false,
      configured: false,
      posts: []
    });
  }

  const skey = getCookieValue(cookie, 'p_skey') || getCookieValue(cookie, 'skey');
  if (!skey) {
    return jsonResponse({
      success: false,
      configured: false,
      posts: []
    });
  }

  try {
    const params = new URLSearchParams({
      uin,
      ftype: '0',
      sort: '0',
      pos: '0',
      num: '10',
      replynum: '0',
      g_tk: String(getGtk(skey)),
      callback: 'callback',
      code_version: '1',
      format: 'jsonp',
      need_private_comment: '0',
      need_info: '1'
    });
    const qzoneToken = getCookieValue(cookie, 'qzonetoken');
    if (qzoneToken) params.set('qzonetoken', qzoneToken);

    const response = await fetch(
      `https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6?${params}`,
      {
        headers: {
          Cookie: cookie,
          Referer: `https://user.qzone.qq.com/${uin}`,
          'User-Agent': 'Mozilla/5.0'
        },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!response.ok) {
      return jsonResponse({ success: false, configured: true, posts: [] }, 502);
    }

    const payload = parseJsonp(await response.text());
    if ((payload.code !== undefined && Number(payload.code) !== 0)
      || (payload.ret !== undefined && Number(payload.ret) !== 0)) {
      return jsonResponse({ success: false, configured: true, posts: [] }, 502);
    }

    const posts = (Array.isArray(payload.msglist) ? payload.msglist : [])
      .map(post => ({
        id: typeof post.tid === 'string' ? post.tid.slice(0, 100) : '',
        text: typeof post.content === 'string' ? post.content.slice(0, 2000) : '',
        timestamp: toUnixTimestamp(post)
      }))
      .filter(post => post.text.trim())
      .slice(0, 10);

    return jsonResponse({
      success: true,
      configured: true,
      uin,
      posts
    }, 200, 'public, max-age=60, s-maxage=300');
  } catch (error) {
    console.error(
      'Qzone recent posts request failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return jsonResponse({ success: false, configured: true, posts: [] }, 502);
  }
}
