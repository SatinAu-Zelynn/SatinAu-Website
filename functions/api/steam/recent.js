/*
  Cloudflare Pages Function - Steam Recently Played Games API
  接口路由: /api/steam/recent
  功能: 调用 Steam 官方 Web API 获取指定用户近两周游玩的在线游戏数据
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
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  // Steam 认证参数：优先查询参数，其次 Cloudflare 环境变量
  const steamid = url.searchParams.get('steamid') || env.STEAM_ID || '';
  const apiKey = url.searchParams.get('key') || env.STEAM_API_KEY || '';

  // 若未配置 API Key 或 Steam ID，返回友好的未配置状态及指引
  if (!apiKey || !steamid) {
    return new Response(JSON.stringify({
      success: false,
      configured: false,
      code: 'CONFIG_REQUIRED',
      message: 'Steam API 需要配置 STEAM_API_KEY 与 STEAM_ID 环境变量或参数',
      total_count: 0,
      games: []
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const steamApiUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamid)}&format=json&count=10`;
    
    const res = await fetch(steamApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({
        success: false,
        configured: true,
        message: `Steam API responded with status ${res.status}`,
        total_count: 0,
        games: []
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    const data = await res.json();
    const rawGames = data.response?.games || [];

    const games = rawGames.map(game => ({
      appid: game.appid,
      name: game.name,
      playtime_2weeks: game.playtime_2weeks || 0, // 分钟
      playtime_forever: game.playtime_forever || 0, // 分钟
      icon_url: game.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
        : '',
      header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      capsule_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/capsule_616x353.jpg`,
      store_url: `https://store.steampowered.com/app/${game.appid}/`
    }));

    return new Response(JSON.stringify({
      success: true,
      configured: true,
      total_count: data.response?.total_count || games.length,
      games: games
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      configured: true,
      message: 'Failed to fetch Steam games: ' + (err.message || err),
      total_count: 0,
      games: []
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}
