/*
  Cloudflare Pages Function - SEO Enhancement (Updated)
  Path: functions/_middleware.js
*/

// 1. 配置 CDN 路径 (确保这个地址能访问到 list.json)
const CDN_BASE = 'https://cdn-cf.satinau.cn'; // 或者 'https://cdn-eo.satinau.cn'
const BLOG_LIST_URL = `${CDN_BASE}/blog/list.json`;

// 2. 爬虫 User-Agent 列表
const BOT_AGENTS = [
  'googlebot', 'bingbot', 'yandex', 'baiduspider', 'twitterbot',
  'facebookexternalhit', 'rogerbot', 'linkedinbot', 'embedly',
  'quora link preview', 'showyoubot', 'outbrain', 'pinterest',
  'slackbot', 'vkshare', 'w3c_validator', 'redditbot', 'applebot',
  'whatsapp', 'flipboard', 'tumblr', 'bitlybot', 'discordbot',
  'telegrambot', 'curl', 'wget', 'python-requests' // 方便测试，加入了 curl
];

function isBot(userAgent) {
  return BOT_AGENTS.some(bot => userAgent.toLowerCase().includes(bot));
}

// 获取博客列表
async function getBlogList() {
  try {
    const res = await fetch(BLOG_LIST_URL);
    if (res.ok) return await res.json();
  } catch (e) {
    console.log('Error fetching blog list:', e);
  }
  return [];
}

export const onRequest = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  
  // 规范化路径：去掉结尾的 / 和 .html
  let path = url.pathname.replace(/\/$/, "").replace(/\.html$/, "");

  // 1. 如果不是爬虫 且 不是博客页面，直接跳过
  if (!isBot(userAgent) || path !== '/blog') {
    return next();
  }

  // 2. 获取原始页面
  const response = await next();
  
  // 确保是 HTML 页面
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }

  // 获取数据
  const posts = await getBlogList();
  if (!posts || posts.length === 0) return response;

  // === 场景 A: 博客详情页 (有 id 或 title 参数) ===
  const queryId = url.searchParams.get('id');
  const queryTitle = url.searchParams.get('title');

  if (queryId || queryTitle) {
    let post = null;

    // 优先匹配 ID
    if (queryId) {
      post = posts.find(p => String(p.id) === String(queryId));
    } 
    // 其次匹配 Title (需要解码 URL)
    else if (queryTitle) {
      const decodedTitle = decodeURIComponent(queryTitle);
      post = posts.find(p => p.title === decodedTitle || p.title.includes(decodedTitle));
    }

    if (post) {
      // 找到了文章，注入 SEO 信息
      return new HTMLRewriter()
        .on('title', {
          element(element) {
            element.setInnerContent(`${post.title} - 缎金SatinAu`);
          }
        })
        .on('meta[name="description"]', {
          element(element) {
            element.setAttribute('content', post.preview || post.title);
          }
        })
        // 关键：在 body 中注入爬虫可见的内容
        .on('div#postContent', {
          element(element) {
            element.setInnerContent(`
              <h1>${post.title}</h1>
              <p>日期: ${post.date}</p>
              <div class="seo-summary">${post.preview || '暂无简介'}</div>
              <hr>
              <p>正文内容请访问：<a href="${CDN_BASE}/blog/${post.filename || post.id}.md">Markdown源文件</a></p>
            `, { html: true });
          }
        })
        .transform(response);
    }
  }

  // === 场景 B: 博客列表页 (无参数) ===
  else {
    const listHtml = posts.map(post => `
      <div class="post-item" style="margin-bottom: 20px;">
        <h2><a href="/blog?id=${post.id}">${post.title}</a></h2>
        <p>${post.preview || post.title}</p>
        <small>${post.date}</small>
      </div>
    `).join('');

    return new HTMLRewriter()
      .on('div#blogList', {
        element(element) {
          element.setInnerContent(listHtml, { html: true });
        }
      })
      .transform(response);
  }

  return response;
};