/*
  Cloudflare Pages Function - SEO Enhancement via HTMLRewriter
  Dynamically injects content for crawlers without client-side JS.
*/

// 配置 CDN 地址和数据路径
const CDN_BASE = 'https://cdn-cf.satinau.cn';
const BLOG_LIST_URL = `${CDN_BASE}/blog/list.json`;

// 定义爬虫 User-Agent 关键词
const BOT_AGENTS = [
  'googlebot', 'bingbot', 'yandex', 'baiduspider', 'twitterbot',
  'facebookexternalhit', 'rogerbot', 'linkedinbot', 'embedly',
  'quora link preview', 'showyoubot', 'outbrain', 'pinterest',
  'slackbot', 'vkshare', 'w3c_validator', 'redditbot', 'applebot',
  'whatsapp', 'flipboard', 'tumblr', 'bitlybot', 'discordbot',
  'telegrambot'
];

// 判断是否为爬虫
function isBot(userAgent) {
  return BOT_AGENTS.some(bot => userAgent.toLowerCase().includes(bot));
}

// 获取博客列表数据
async function getBlogList() {
  try {
    const res = await fetch(BLOG_LIST_URL);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to fetch blog list:', e);
  }
  return [];
}

export const onRequest = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';

  // 如果不是爬虫，直接返回原始页面（让浏览器自己去渲染）
  if (!isBot(userAgent)) {
    return next();
  }

  // 获取原始响应（空白的 HTML 骨架）
  const response = await next();
  
  // 如果不是 HTML 页面，直接返回
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }

  // 针对 /blog 路径进行处理
  // 博客列表页 (satinau.cn/blog)
  if (url.pathname === '/blog' && !url.searchParams.has('id')) {
    const posts = await getBlogList();
    
    // 生成 HTML 链接列表
    // 搜索引擎最看重 <a> 标签，有了这个它就能爬到详情页
    const listHtml = posts.map(post => `
      <div class="post-preview">
        <h3><a href="/blog?id=${post.id}">${post.title}</a></h3>
        <p>${post.preview || post.title}</p>
        <span class="date">${post.date}</span>
      </div>
    `).join('');

    // 使用 HTMLRewriter 注入内容
    return new HTMLRewriter()
      .on('div#blogList', {
        element(element) {
          element.setInnerContent(listHtml, { html: true });
        }
      })
      .transform(response);
  }

  // 文章详情页 (satinau.cn/blog?id=123)
  if (url.pathname === '/blog' && url.searchParams.has('id')) {
    const postId = url.searchParams.get('id');
    const posts = await getBlogList();
    const post = posts.find(p => String(p.id) === String(postId));

    if (post) {
      // 找到文章后，修改 Title 和 Meta Description
      // 还可以尝试获取 Markdown 内容注入 body，但为了性能，
      // 至少把 Title 改对，让搜索结果好看
      return new HTMLRewriter()
        .on('title', {
          text(text) {
            text.replace(`${post.title} - 缎金SatinAu`);
          }
        })
        .on('meta[name="description"]', {
          element(element) {
            element.setAttribute('content', post.preview || post.title);
          }
        })
        // 为了 SEO，我们在 #postContent 里塞入摘要或提示
        .on('div#postContent', {
          element(element) {
            // 如果你想做得更好，可以在这里 fetch 对应的 .md 文件
            // 并简单处理一下插入进去。目前先插入标题和简介。
            const seoContent = `
              <h1>${post.title}</h1>
              <p>发布时间: ${post.date}</p>
              <div class="summary">${post.preview || ''}</div>
              <p><a href="${CDN_BASE}/blog/${post.filename || post.id}.md">查看 Markdown 原文</a></p>
            `;
            element.setInnerContent(seoContent, { html: true });
          }
        })
        .transform(response);
    }
  }

  // 其他页面不做处理
  return response;
};