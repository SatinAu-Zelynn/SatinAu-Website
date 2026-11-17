/*
  Cloudflare Pages Function - Qzone recent posts
  This endpoint uses an undocumented Qzone interface and requires server-side credentials.
*/

const QZONE_CACHE_FRESHNESS_MS = 30 * 60 * 1000;
const QZONE_CACHE_RETENTION_SECONDS = 90 * 24 * 60 * 60;
const QZONE_RETRY_COOLDOWN_SECONDS = 5 * 60;

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
      || hostname.endsWith('.gtimg.cn')
      || hostname === 'photo.store.qq.com'
      || hostname.endsWith('.photo.store.qq.com');
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
        picture.url2 || picture.url3 || picture.url1 || picture.smallurl || ''
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

function getQzoneCacheKey(uin) {
  return `qzone:recent:v1:${uin}`;
}

function getQzoneRetryKey(uin) {
  return `qzone:refresh-cooldown:v1:${uin}`;
}

async function readQzoneCache(namespace, key, uin) {
  if (!namespace) return null;

  try {
    const record = await namespace.get(key, 'json');
    if (!record) return null;
    if (
      record.version !== 1
      || record.uin !== uin
      || !Array.isArray(record.posts)
      || !Number.isFinite(Date.parse(record.updatedAt))
    ) {
      console.warn('Qzone KV cache record is invalid; ignoring it.');
      return null;
    }
    return record;
  } catch (error) {
    console.error(
      'Qzone KV cache read failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return null;
  }
}

async function isQzoneRefreshCoolingDown(namespace, key) {
  if (!namespace) return false;

  try {
    return Boolean(await namespace.get(key));
  } catch (error) {
    console.error(
      'Qzone KV cooldown read failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return false;
  }
}

async function setQzoneRefreshCooldown(namespace, key) {
  if (!namespace) return;

  try {
    await namespace.put(key, '1', {
      expirationTtl: QZONE_RETRY_COOLDOWN_SECONDS
    });
  } catch (error) {
    console.error(
      'Qzone KV cooldown write failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
  }
}

async function writeQzoneCache(namespace, key, uin, posts, updatedAt) {
  if (!namespace) return 'unbound';

  try {
    await namespace.put(key, JSON.stringify({
      version: 1,
      uin,
      posts,
      updatedAt
    }), {
      expirationTtl: QZONE_CACHE_RETENTION_SECONDS
    });
    return 'stored';
  } catch (error) {
    console.error(
      'Qzone KV cache write failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return 'write-failed';
  }
}

function staleQzoneResponse(record, configured = true) {
  return jsonResponse({
    success: false,
    configured,
    stale: true,
    updatedAt: record.updatedAt,
    posts: record.posts,
    message: 'Qzone refresh failed; serving the last successful cache.'
  }, 200, 'public, max-age=60, s-maxage=300');
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, message: 'Method Not Allowed', posts: [] }, 405);
  }

  const uin = env.QZONE_UIN || '';
  if (!/^\d{5,12}$/.test(uin)) {
    return jsonResponse({
      success: false,
      configured: false,
      posts: []
    });
  }

  const cacheNamespace = env.QZONE_CACHE;
  if (!cacheNamespace) {
    console.warn('QZONE_CACHE binding is missing; durable Qzone caching is disabled.');
  }
  const cacheKey = getQzoneCacheKey(uin);
  const cachedRecord = await readQzoneCache(cacheNamespace, cacheKey, uin);
  if (
    cachedRecord
    && Date.now() - Date.parse(cachedRecord.updatedAt) < QZONE_CACHE_FRESHNESS_MS
  ) {
    return jsonResponse({
      success: true,
      configured: true,
      cached: true,
      stale: false,
      updatedAt: cachedRecord.updatedAt,
      cacheStatus: 'hit',
      posts: cachedRecord.posts
    }, 200, 'public, max-age=60, s-maxage=300');
  }

  const cookie = env.QZONE_COOKIE || '';
  if (!cookie) {
    if (cachedRecord) {
      console.warn('Qzone credentials are unavailable; serving the last successful cache.');
      return staleQzoneResponse(cachedRecord, false);
    }
    return jsonResponse({
      success: false,
      configured: false,
      posts: []
    });
  }

  const skey = getCookieValue(cookie, 'p_skey') || getCookieValue(cookie, 'skey');
  if (!skey) {
    if (cachedRecord) {
      console.warn('Qzone signing cookie is unavailable; serving the last successful cache.');
      return staleQzoneResponse(cachedRecord, false);
    }
    return jsonResponse({
      success: false,
      configured: false,
      posts: []
    });
  }

  const retryKey = getQzoneRetryKey(uin);
  if (await isQzoneRefreshCoolingDown(cacheNamespace, retryKey)) {
    if (cachedRecord) return staleQzoneResponse(cachedRecord);
    return jsonResponse({
      success: false,
      configured: true,
      posts: [],
      message: 'Qzone refresh is temporarily paused after a previous failure.'
    }, 503);
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
      throw new Error(`Qzone upstream returned HTTP ${response.status}`);
    }

    const payload = parseJsonp(await response.text());
    if ((payload.code !== undefined && Number(payload.code) !== 0)
      || (payload.ret !== undefined && Number(payload.ret) !== 0)) {
      throw new Error('Qzone upstream rejected the request');
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
    const updatedAt = new Date().toISOString();
    const cacheStatus = await writeQzoneCache(
      cacheNamespace,
      cacheKey,
      uin,
      posts,
      updatedAt
    );

    return jsonResponse({
      success: true,
      configured: true,
      uin,
      updatedAt,
      cacheStatus,
      posts
    }, 200, 'public, max-age=60, s-maxage=300');
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'Unknown error';
    await setQzoneRefreshCooldown(cacheNamespace, retryKey);
    if (cachedRecord) {
      console.warn('Qzone refresh failed; serving the last successful cache:', errorName);
      return staleQzoneResponse(cachedRecord);
    }
    console.error('Qzone recent posts request failed:', errorName);
    return jsonResponse({ success: false, configured: true, posts: [] }, 502);
  }
}
