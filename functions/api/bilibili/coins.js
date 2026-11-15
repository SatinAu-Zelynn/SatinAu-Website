/*
  Cloudflare Pages Function - Bilibili Recent Coin Videos API
  接口路由: /api/bilibili/coins
*/

// ==================== MD5 实现 ====================
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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=300'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const vmid = url.searchParams.get('vmid') || (env && env.BILIBILI_UID) || '1502522588';
  const cookieHeader = (env && env.BILIBILI_COOKIE) || '';

  // 获取 WBI 密钥
  let imgKey = (env && env.BILIBILI_WBI_IMG_KEY) || '';
  let subKey = (env && env.BILIBILI_WBI_SUB_KEY) || '';

  if (!imgKey || !subKey) {
    try {
      const navRes = await fetch('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://www.bilibili.com/',
          'Cookie': cookieHeader
        }
      });
      if (navRes.ok) {
        const navJson = await navRes.json();
        imgKey = (navJson.data?.wbi_img?.img_url || '').split('/').pop().split('.')[0] || '';
        subKey = (navJson.data?.wbi_img?.sub_url || '').split('/').pop().split('.')[0] || '';
      }
    } catch (e) {
      console.warn('获取WBI keys失败:', e);
    }
  }

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': `https://space.bilibili.com/${vmid}/`,
    'Origin': 'https://space.bilibili.com',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  };
  if (cookieHeader) {
    baseHeaders['Cookie'] = cookieHeader;
  }

  // 1. 尝试直接请求投币接口（不带签名，因为原投币接口老版本只认 Cookie，不认多余的 w_rid 参数）
  try {
    const rawRes = await fetch(`https://api.bilibili.com/x/space/coin/video?vmid=${vmid}`, {
      headers: baseHeaders
    });
    const rawJson = await rawRes.json();
    if (rawJson && rawJson.code === 0) {
      return new Response(JSON.stringify(rawJson), { status: 200, headers: corsHeaders });
    }
  } catch (e) {}

  // 2. 尝试带 WBI 签名请求
  if (imgKey && subKey) {
    try {
      const signedQuery = signWbiParams({ vmid }, imgKey, subKey);
      const wbiRes = await fetch(`https://api.bilibili.com/x/space/coin/video?${signedQuery}`, {
        headers: baseHeaders
      });
      const wbiJson = await wbiRes.json();
      if (wbiJson && wbiJson.code === 0) {
        return new Response(JSON.stringify(wbiJson), { status: 200, headers: corsHeaders });
      }
    } catch (e) {}
  }

  // 3. 降级方案：如果投币接口被 B 站海外 IP 风控 (-412)，自动拉取该用户最新的空间投稿视频
  // 空间投稿视频使用的是公开开放的 API，绝不会被 412 拦截，可以完美保障前台展示！
  try {
    const archiveUrl = `https://api.bilibili.com/x/space/arc/search?mid=${vmid}&ps=10&tid=0&pn=1&order=pubdate`;
    const arcRes = await fetch(archiveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': `https://space.bilibili.com/${vmid}/video`
      }
    });
    const arcJson = await arcRes.json();

    if (arcJson && arcJson.code === 0 && arcJson.data?.list?.vlist) {
      // 转换格式适配投币视频的结构 { bvid, title, pic, desc, duration, ... }
      const formattedList = arcJson.data.list.vlist.map(item => ({
        bvid: item.bvid,
        aid: item.aid,
        title: item.title,
        pic: item.pic.startsWith('http') ? item.pic : `https:${item.pic}`,
        desc: item.description,
        coins: item.coins || 0,
        play: item.play,
        pubdate: item.created,
        owner: {
          name: item.author,
          mid: item.mid
        }
      }));

      return new Response(JSON.stringify({
        code: 0,
        message: 'fallback_to_archives',
        data: formattedList
      }), { status: 200, headers: corsHeaders });
    }
  } catch (arcErr) {}

  // 4. 如果所有降级方案都失败，返回友好的调试信息
  return new Response(JSON.stringify({
    code: 412,
    message: 'B站海外节点风控拦截，请稍后再试',
    data: []
  }), { status: 200, headers: corsHeaders });
}
