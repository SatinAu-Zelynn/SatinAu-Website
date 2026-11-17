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

function decodeHtmlEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    const namedEntities = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' '
    };
    if (!code.startsWith('#')) return namedEntities[code.toLowerCase()] || entity;

    const codePoint = code[1].toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    return String.fromCodePoint(codePoint);
  });
}

function normalizeQzoneContent(value) {
  return decodeHtmlEntities(value)
    .replace(/<img\b[^>]*>/gi, imageTag => {
      const source = imageTag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const url = source?.[1] || source?.[2] || source?.[3] || '';
      const emoji = url.match(/(?:^|\/)qzone\/em\/(e\d{1,7})\.(?:gif|png)(?:[?#]|$)/i);
      return emoji ? `[em]${emoji[1].toLowerCase()}[/em]` : '';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|li)>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeQzoneImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';

  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = hostname === 'qpic.cn'
      || hostname.endsWith('.qpic.cn')
      || hostname === 'gtimg.cn'
      || hostname.endsWith('.gtimg.cn');
    if (!trustedHost || !['http:', 'https:'].includes(url.protocol)) return '';

    url.protocol = 'https:';
    url.username = '';
    url.password = '';
    return url.href;
  } catch {
    return '';
  }
}

function getQzoneImages(post) {
  if (!Array.isArray(post.pic)) return [];
  return post.pic
    .map(picture => {
      if (!picture || typeof picture !== 'object') return '';
      return normalizeQzoneImageUrl(
        picture.url3 || picture.url2 || picture.url1 || picture.smallurl || ''
      );
    })
    .filter(Boolean)
    .slice(0, 3);
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
      .map(post => {
        const content = typeof post.content === 'string' ? post.content.slice(0, 4000) : '';
        return {
          id: typeof post.tid === 'string' ? post.tid.slice(0, 100) : '',
          text: normalizeQzoneContent(content).slice(0, 2000),
          images: getQzoneImages(post),
          timestamp: toUnixTimestamp(post)
        };
      })
      .filter(post => post.text.trim() || post.images.length > 0)
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
