/*
  Cloudflare Pages Function - Bilibili Recent Coin Videos API
  接口路由: /api/bilibili/coins
  功能: 调用哔哩哔哩官方接口获取指定用户最近投币的视频列表
*/

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

  try {
    const biliApiUrl = `https://api.bilibili.com/x/space/coin/video?vmid=${encodeURIComponent(vmid)}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': `https://space.bilibili.com/${vmid}/`,
      'Accept': 'application/json, text/plain, */*'
    };

    if (env.BILIBILI_COOKIE) {
      headers['Cookie'] = env.BILIBILI_COOKIE;
    }

    const res = await fetch(biliApiUrl, { headers });
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
