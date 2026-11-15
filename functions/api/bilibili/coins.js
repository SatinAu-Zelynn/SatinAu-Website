/*
  Cloudflare Pages Function - Bilibili Recent Coin Videos API
  接口路由: /api/bilibili/coins
  功能: 调用哔哩哔哩官方接口获取指定用户最近投币的视频列表
  
  核心策略: 使用 Cloudflare Sockets API (cloudflare:sockets) 发送原始 HTTP 请求，
  避免 fetch() 自动注入 cf-connecting-ip / cf-worker 等特征头导致 B站 412 风控拦截。
*/

import { connect } from 'cloudflare:sockets';

// ==================== MD5 纯 JS 实现 ====================
function md5(str) {
  function rot(n, s) { return (n << s) | (n >>> (32 - s)); }
  function add(x, y) {
    const lX4 = x & 0x40000000, lY4 = y & 0x40000000;
    const lX8 = x & 0x80000000, lY8 = y & 0x80000000;
    const res = (x & 0x3fffffff) + (y & 0x3fffffff);
    if (lX4 & lY4) return res ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (res & 0x40000000) return res ^ 0xc0000000 ^ lX8 ^ lY8;
      return res ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return res ^ lX8 ^ lY8;
  }
  function f(x, y, z) { return (x & y) | (~x & z); }
  function g(x, y, z) { return (x & z) | (y & ~z); }
  function h(x, y, z) { return x ^ y ^ z; }
  function i(x, y, z) { return y ^ (x | ~z); }
  function ff(a, b, c, d, x, s, ac) { return add(rot(add(add(a, f(b, c, d)), add(x, ac)), s), b); }
  function gg(a, b, c, d, x, s, ac) { return add(rot(add(add(a, g(b, c, d)), add(x, ac)), s), b); }
  function hh(a, b, c, d, x, s, ac) { return add(rot(add(add(a, h(b, c, d)), add(x, ac)), s), b); }
  function ii(a, b, c, d, x, s, ac) { return add(rot(add(add(a, i(b, c, d)), add(x, ac)), s), b); }

  const utf8 = unescape(encodeURIComponent(str));
  const words = [];
  for (let j = 0; j < utf8.length; j++) {
    words[j >> 2] |= (utf8.charCodeAt(j) & 0xff) << ((j % 4) * 8);
  }
  words[utf8.length >> 2] |= 0x80 << ((utf8.length % 4) * 8);
  words[(((utf8.length + 8) >> 6) << 4) + 14] = utf8.length * 8;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let k = 0; k < words.length; k += 16) {
    const oA = a, oB = b, oC = c, oD = d;
    a=ff(a,b,c,d,words[k+0]||0,7,0xd76aa478);d=ff(d,a,b,c,words[k+1]||0,12,0xe8c7b756);
    c=ff(c,d,a,b,words[k+2]||0,17,0x242070db);b=ff(b,c,d,a,words[k+3]||0,22,0xc1bdceee);
    a=ff(a,b,c,d,words[k+4]||0,7,0xf57c0faf);d=ff(d,a,b,c,words[k+5]||0,12,0x4787c62a);
    c=ff(c,d,a,b,words[k+6]||0,17,0xa8304613);b=ff(b,c,d,a,words[k+7]||0,22,0xfd469501);
    a=ff(a,b,c,d,words[k+8]||0,7,0x698098d8);d=ff(d,a,b,c,words[k+9]||0,12,0x8b44f7af);
    c=ff(c,d,a,b,words[k+10]||0,17,0xffff5bb1);b=ff(b,c,d,a,words[k+11]||0,22,0x895cd7be);
    a=ff(a,b,c,d,words[k+12]||0,7,0x6b901122);d=ff(d,a,b,c,words[k+13]||0,12,0xfd987193);
    c=ff(c,d,a,b,words[k+14]||0,17,0xa679438e);b=ff(b,c,d,a,words[k+15]||0,22,0x49b40821);
    a=gg(a,b,c,d,words[k+1]||0,5,0xf61e2562);d=gg(d,a,b,c,words[k+6]||0,9,0xc040b340);
    c=gg(c,d,a,b,words[k+11]||0,14,0x265e5a51);b=gg(b,c,d,a,words[k+0]||0,20,0xe9b6c7aa);
    a=gg(a,b,c,d,words[k+5]||0,5,0xd62f105d);d=gg(d,a,b,c,words[k+10]||0,9,0x02441453);
    c=gg(c,d,a,b,words[k+15]||0,14,0xd8a1e681);b=gg(b,c,d,a,words[k+4]||0,20,0xe7d3fbc8);
    a=gg(a,b,c,d,words[k+9]||0,5,0x21e1cde6);d=gg(d,a,b,c,words[k+14]||0,9,0xc33707d6);
    c=gg(c,d,a,b,words[k+3]||0,14,0xf4d50d87);b=gg(b,c,d,a,words[k+8]||0,20,0x455a14ed);
    a=gg(a,b,c,d,words[k+13]||0,5,0xa9e3e905);d=gg(d,a,b,c,words[k+2]||0,9,0xfcefa3f8);
    c=gg(c,d,a,b,words[k+7]||0,14,0x676f02d9);b=gg(b,c,d,a,words[k+12]||0,20,0x8d2a4c8a);
    a=hh(a,b,c,d,words[k+5]||0,4,0xfffa3942);d=hh(d,a,b,c,words[k+8]||0,11,0x8771f681);
    c=hh(c,d,a,b,words[k+11]||0,16,0x6d9d6122);b=hh(b,c,d,a,words[k+14]||0,23,0xfde5380c);
    a=hh(a,b,c,d,words[k+1]||0,4,0xa4beea44);d=hh(d,a,b,c,words[k+4]||0,11,0x4bdecfa9);
    c=hh(c,d,a,b,words[k+7]||0,16,0xf6bb4b60);b=hh(b,c,d,a,words[k+10]||0,23,0xbebfbc70);
    a=hh(a,b,c,d,words[k+13]||0,4,0x289b7ec6);d=hh(d,a,b,c,words[k+0]||0,11,0xeaa127fa);
    c=hh(c,d,a,b,words[k+3]||0,16,0xd4ef3085);b=hh(b,c,d,a,words[k+6]||0,23,0x04881d05);
    a=hh(a,b,c,d,words[k+9]||0,4,0xd9d4d039);d=hh(d,a,b,c,words[k+12]||0,11,0xe6db99e5);
    c=hh(c,d,a,b,words[k+15]||0,16,0x1fa27cf8);b=hh(b,c,d,a,words[k+2]||0,23,0xc4ac5665);
    a=ii(a,b,c,d,words[k+0]||0,6,0xf4292244);d=ii(d,a,b,c,words[k+7]||0,10,0x432aff97);
    c=ii(c,d,a,b,words[k+14]||0,15,0xab9423a7);b=ii(b,c,d,a,words[k+5]||0,21,0xfc93a039);
    a=ii(a,b,c,d,words[k+12]||0,6,0x655b59c3);d=ii(d,a,b,c,words[k+3]||0,10,0x8f0ccc92);
    c=ii(c,d,a,b,words[k+10]||0,15,0xffeff47d);b=ii(b,c,d,a,words[k+1]||0,21,0x85845dd1);
    a=ii(a,b,c,d,words[k+8]||0,6,0x6fa87e4f);d=ii(d,a,b,c,words[k+15]||0,10,0xfe2ce6e0);
    c=ii(c,d,a,b,words[k+6]||0,15,0xa3014314);b=ii(b,c,d,a,words[k+13]||0,21,0x4e0811a1);
    a=ii(a,b,c,d,words[k+4]||0,6,0xf7537e82);d=ii(d,a,b,c,words[k+11]||0,10,0xbd3af235);
    c=ii(c,d,a,b,words[k+2]||0,15,0x2ad7d2bb);b=ii(b,c,d,a,words[k+9]||0,21,0xeb86d391);
    a = add(a, oA); b = add(b, oB); c = add(c, oC); d = add(d, oD);
  }
  function toHex(n) {
    let s = '';
    for (let m = 0; m < 4; m++) s += ('0' + ((n >>> (m * 8)) & 0xff).toString(16)).slice(-2);
    return s;
  }
  return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
}

// ==================== WBI 签名 ====================
const MIXIN_KEY_ENC_TAB = [
  46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,
  27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,
  37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,
  22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52
];

function getMixinKey(origKey) {
  let mixin = '';
  for (const idx of MIXIN_KEY_ENC_TAB) {
    if (origKey[idx]) mixin += origKey[idx];
  }
  return mixin.slice(0, 32);
}

function signWbiParams(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey);
  const wts = Math.floor(Date.now() / 1000);
  const newParams = { ...params, wts };
  const sortedKeys = Object.keys(newParams).sort();
  const queryParts = [];
  for (const k of sortedKeys) {
    const v = String(newParams[k]).replace(/[!'()*]/g, '');
    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  const queryStr = queryParts.join('&');
  const w_rid = md5(queryStr + mixinKey);
  return `${queryStr}&w_rid=${w_rid}`;
}

// ==================== 原始 TCP Socket 请求 ====================
/**
 * 通过 Cloudflare Sockets API 发送原始 HTTPS 请求，
 * 彻底避免 fetch() 自动注入 cf-connecting-ip 等特征头。
 */
async function rawHttpsRequest(hostname, path, headers) {
  const socket = connect({ hostname, port: 443 }, { secureTransport: 'on' });

  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n');

  const rawRequest = `GET ${path} HTTP/1.1\r\nHost: ${hostname}\r\n${headerLines}\r\nConnection: close\r\n\r\n`;

  const encoder = new TextEncoder();
  const writer = socket.writable.getWriter();
  await writer.write(encoder.encode(rawRequest));
  await writer.close();

  const reader = socket.readable.getReader();
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // 合并所有 chunk
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }

  const decoder = new TextDecoder();
  const raw = decoder.decode(merged);

  // 解析 HTTP 响应：分离 headers 与 body
  const headerEnd = raw.indexOf('\r\n\r\n');
  if (headerEnd === -1) {
    return { status: 0, headers: '', body: raw };
  }

  const respHeaders = raw.substring(0, headerEnd);
  let body = raw.substring(headerEnd + 4);

  // 提取 HTTP 状态码
  const statusMatch = respHeaders.match(/HTTP\/[\d.]+ (\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

  // 处理 chunked transfer encoding
  if (respHeaders.toLowerCase().includes('transfer-encoding: chunked')) {
    body = decodeChunked(body);
  }

  return { status, headers: respHeaders, body };
}

/** 解码 chunked transfer encoding */
function decodeChunked(raw) {
  let result = '';
  let pos = 0;
  while (pos < raw.length) {
    const lineEnd = raw.indexOf('\r\n', pos);
    if (lineEnd === -1) break;
    const sizeHex = raw.substring(pos, lineEnd).trim();
    const size = parseInt(sizeHex, 16);
    if (isNaN(size) || size === 0) break;
    pos = lineEnd + 2;
    result += raw.substring(pos, pos + size);
    pos += size + 2; // skip trailing \r\n
  }
  return result;
}

// ==================== 主函数 ====================
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=600, s-maxage=600'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ code: 405, message: 'Method Not Allowed' }), {
      status: 405, headers: corsHeaders
    });
  }

  const vmid = url.searchParams.get('vmid') || (env && env.BILIBILI_UID) || '1502522588';
  let cookieHeader = (env && env.BILIBILI_COOKIE) || '';

  // 获取 WBI 密钥 (优先环境变量，否则尝试动态获取)
  let imgKey = (env && env.BILIBILI_WBI_IMG_KEY) || '';
  let subKey = (env && env.BILIBILI_WBI_SUB_KEY) || '';

  if (!imgKey || !subKey) {
    try {
      const navRes = await rawHttpsRequest('api.bilibili.com', '/x/web-interface/nav', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json, text/plain, */*'
      });
      if (navRes.status === 200 && navRes.body) {
        const navJson = JSON.parse(navRes.body);
        const navImgUrl = navJson.data?.wbi_img?.img_url || '';
        const navSubUrl = navJson.data?.wbi_img?.sub_url || '';
        imgKey = navImgUrl.split('/').pop().split('.')[0] || '';
        subKey = navSubUrl.split('/').pop().split('.')[0] || '';
      }
    } catch (e) {
      console.warn('Socket获取WBI keys失败:', e);
    }
  }

  // 构建查询参数 (带 WBI 签名)
  let queryString = `vmid=${encodeURIComponent(vmid)}`;
  const hasWbiKeys = Boolean(imgKey && subKey);
  if (hasWbiKeys) {
    queryString = signWbiParams({ vmid }, imgKey, subKey);
  }

  const apiPath = `/x/space/coin/video?${queryString}`;

  // 构建干净的请求头 (无任何 cf-* 特征)
  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': `https://space.bilibili.com/${vmid}/`,
    'Origin': 'https://space.bilibili.com',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  };

  if (cookieHeader) {
    reqHeaders['Cookie'] = cookieHeader;
  }

  try {
    // 方案 A: 使用原始 TCP Socket 请求 (绕过 cf-* 特征头)
    const result = await rawHttpsRequest('api.bilibili.com', apiPath, reqHeaders);

    if (result.status === 412) {
      // Socket 方式也被拦截，返回详细诊断信息
      const availableKeys = env ? Object.keys(env) : [];
      return new Response(JSON.stringify({
        code: 412,
        need_cookie: true,
        message: 'B站返回 412 风控拦截 (已使用 Socket 直连)',
        debug: {
          method: 'socket',
          has_env_cookie: Boolean(env && env.BILIBILI_COOKIE),
          cookie_has_sessdata: Boolean(cookieHeader && cookieHeader.includes('SESSDATA')),
          cookie_has_buvid3: Boolean(cookieHeader && cookieHeader.includes('buvid3')),
          has_wbi_keys: hasWbiKeys,
          response_status: result.status,
          response_headers_preview: result.headers.substring(0, 500),
          detected_env_keys: availableKeys
        },
        data: []
      }), { status: 200, headers: corsHeaders });
    }

    if (result.status !== 200 || !result.body) {
      return new Response(JSON.stringify({
        code: result.status || 500,
        message: `Bilibili API responded with status ${result.status}`,
        debug: {
          method: 'socket',
          response_headers_preview: result.headers.substring(0, 500),
          body_preview: (result.body || '').substring(0, 200)
        },
        data: []
      }), { status: 200, headers: corsHeaders });
    }

    // 尝试解析 JSON
    let data;
    try {
      data = JSON.parse(result.body);
    } catch (parseErr) {
      // body 可能被 gzip 压缩或格式异常
      return new Response(JSON.stringify({
        code: 500,
        message: 'Failed to parse Bilibili response as JSON',
        debug: {
          method: 'socket',
          body_preview: result.body.substring(0, 500),
          response_headers_preview: result.headers.substring(0, 500)
        },
        data: []
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });

  } catch (socketErr) {
    // Socket 方式失败，回退到标准 fetch 方式
    console.warn('Socket方式失败，回退fetch:', socketErr);

    try {
      const fallbackUrl = `https://api.bilibili.com/x/space/coin/video?${queryString}`;
      const fallbackHeaders = { ...reqHeaders };
      const fallbackRes = await fetch(fallbackUrl, { headers: fallbackHeaders });

      if (fallbackRes.status === 412) {
        const availableKeys = env ? Object.keys(env) : [];
        return new Response(JSON.stringify({
          code: 412,
          need_cookie: true,
          message: 'B站返回 412 风控拦截 (Socket失败后回退fetch，仍被拦截)',
          debug: {
            method: 'fetch_fallback',
            socket_error: socketErr.message || String(socketErr),
            has_env_cookie: Boolean(env && env.BILIBILI_COOKIE),
            cookie_has_sessdata: Boolean(cookieHeader && cookieHeader.includes('SESSDATA')),
            cookie_has_buvid3: Boolean(cookieHeader && cookieHeader.includes('buvid3')),
            has_wbi_keys: hasWbiKeys,
            detected_env_keys: availableKeys
          },
          data: []
        }), { status: 200, headers: corsHeaders });
      }

      if (!fallbackRes.ok) {
        return new Response(JSON.stringify({
          code: fallbackRes.status,
          message: `Bilibili API responded with status ${fallbackRes.status}`,
          data: []
        }), { status: 200, headers: corsHeaders });
      }

      const data = await fallbackRes.json();
      return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });

    } catch (fetchErr) {
      return new Response(JSON.stringify({
        code: 500,
        message: 'All methods failed',
        debug: {
          socket_error: socketErr.message || String(socketErr),
          fetch_error: fetchErr.message || String(fetchErr)
        },
        data: []
      }), { status: 200, headers: corsHeaders });
    }
  }
}
