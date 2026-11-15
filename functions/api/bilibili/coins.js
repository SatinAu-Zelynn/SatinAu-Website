/*
  Cloudflare Pages Function - Bilibili Recent Coin Videos API
  接口路由: /api/bilibili/coins
  功能: 调用哔哩哔哩官方接口获取指定用户最近投币的视频列表
*/

// 获取官方访客指纹 Cookie (buvid3 / buvid4 / b_nut)
async function getVisitorCookie() {
  try {
    const spiRes = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (spiRes.ok) {
      const spiData = await spiRes.json();
      if (spiData.code === 0 && spiData.data) {
        const b3 = spiData.data.b_3 || '';
        const b4 = spiData.data.b_4 || '';
        const now = Math.floor(Date.now() / 1000);
        return `buvid3=${b3}; buvid4=${b4}; b_nut=${now};`;
      }
    }
  } catch (e) {
    console.warn('获取B站访客指纹失败:', e);
  }
  return '';
}

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
      status: 405,
      headers: corsHeaders
    });
  }

  // 目标 UID：优先查询参数，其次环境变量，默认缎金 UID 1502522588
  const vmid = url.searchParams.get('vmid') || env.BILIBILI_UID || '1502522588';

  // 准备 Cookie：优先用户环境变量配置，其次自动获取访客指纹
  let cookieHeader = env.BILIBILI_COOKIE || url.searchParams.get('cookie') || '';
  if (!cookieHeader) {
    cookieHeader = await getVisitorCookie();
  }

  try {
    const biliApiUrl = `https://api.bilibili.com/x/space/coin/video?vmid=${encodeURIComponent(vmid)}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': `https://space.bilibili.com/${vmid}/`,
      'Origin': 'https://space.bilibili.com',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    };

    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const res = await fetch(biliApiUrl, { headers });

    // 针对 412 风控拦截进行友好处理
    if (res.status === 412) {
      return new Response(JSON.stringify({
        code: 412,
        need_cookie: true,
        message: 'B站返回 412 风控拦截：该接口需要配置 Cookie 鉴权凭证（请在 Cloudflare 环境变量中添加 BILIBILI_COOKIE，包含 SESSDATA 与 buvid3）',
        data: []
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    if (!res.ok) {
      return new Response(JSON.stringify({
        code: res.status,
        message: `Bilibili API responded with status ${res.status}`,
        data: []
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({
      code: 500,
      message: 'Failed to fetch Bilibili coins: ' + (err.message || err),
      data: []
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}
