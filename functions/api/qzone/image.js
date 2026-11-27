const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

function normalizeImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = hostname === 'qpic.cn'
      || hostname.endsWith('.qpic.cn')
      || hostname === 'gtimg.cn'
      || hostname.endsWith('.gtimg.cn')
      || hostname === 'photo.store.qq.com'
      || hostname.endsWith('.photo.store.qq.com');
    if (!trustedHost || url.protocol !== 'https:') return '';

    url.username = '';
    url.password = '';
    return url.href;
  } catch {
    return '';
  }
}

function errorResponse(status) {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'GET') return errorResponse(405);

  const requestUrl = new URL(request.url);
  let imageUrl = normalizeImageUrl(requestUrl.searchParams.get('src'));
  if (!imageUrl) return errorResponse(400);

  // 优先读取 Cloudflare 边缘缓存
  const cache = caches.default;
  const cacheKey = new Request(requestUrl.toString(), { method: 'GET' });
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) return cachedResponse;

  const uin = /^\d{5,12}$/.test(env.QZONE_UIN || '') ? env.QZONE_UIN : '';
  const referer = uin
    ? `https://user.qzone.qq.com/${uin}/`
    : 'https://user.qzone.qq.com/';

  try {
    for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
      const response = await fetch(imageUrl, {
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
          Referer: referer,
          'User-Agent': 'Mozilla/5.0'
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000)
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        await response.body?.cancel();
        if (!location || redirectCount === 3) return errorResponse(502);

        imageUrl = normalizeImageUrl(new URL(location, imageUrl).href);
        if (!imageUrl) return errorResponse(502);
        continue;
      }

      if (!response.ok) return errorResponse(502);

      const contentType = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.has(contentType)) return errorResponse(502);

      const contentLength = Number(response.headers.get('Content-Length'));
      if (Number.isFinite(contentLength) && contentLength > 10 * 1024 * 1024) {
        return errorResponse(413);
      }

      const finalResponse = new Response(response.body, {
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=86400',
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cross-Origin-Resource-Policy': 'same-origin'
        }
      });
      if (typeof waitUntil === 'function') {
        waitUntil(cache.put(cacheKey, finalResponse.clone()));
      }
      return finalResponse;
    }

    return errorResponse(502);
  } catch (error) {
    console.error(
      'Qzone image request failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return errorResponse(502);
  }
}
