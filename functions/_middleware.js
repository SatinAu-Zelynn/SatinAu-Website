/*
  Cloudflare Pages Function - Full SEO Middleware
  功能：拦截爬虫 -> 获取列表 -> 获取Markdown正文 -> 转换HTML -> 注入页面
*/

const CDN_BASE = 'https://cdn-cf.satinau.cn';
const BLOG_LIST_URL = `${CDN_BASE}/blog/index.json`;

// 爬虫 User-Agent 列表
const BOT_AGENTS = [
  'googlebot', 'bingbot', 'yandex', 'baiduspider', 'twitterbot',
  'facebookexternalhit', 'rogerbot', 'linkedinbot', 'embedly',
  'quora link preview', 'showyoubot', 'outbrain', 'pinterest',
  'slackbot', 'vkshare', 'w3c_validator', 'redditbot', 'applebot',
  'whatsapp', 'flipboard', 'tumblr', 'bitlybot', 'discordbot',
  'telegrambot', 'curl', 'wget', 'python-requests'
];

function isBot(userAgent) {
  return BOT_AGENTS.some(bot => userAgent.toLowerCase().includes(bot));
}

// 1. 获取文章列表
async function getBlogList() {
  try {
    const res = await fetch(BLOG_LIST_URL, {
      headers: { 'User-Agent': 'Cloudflare-Pages-Worker-SEO' }
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.log('Error fetching blog list:', e);
  }
  return [];
}

// 2. 获取 Markdown 正文内容
async function getMarkdownContent(filename) {
  try {
    // 确保文件名经过编码（处理中文）
    const url = `${CDN_BASE}/blog/${encodeURIComponent(filename)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Cloudflare-Pages-Worker-SEO' }
    });
    if (res.ok) return await res.text();
  } catch (e) {
    console.log(`Error fetching markdown for ${filename}:`, e);
  }
  return null;
}

// 3. 简单的 Markdown 转 HTML (为了 SEO，不需要完美样式，只需要结构)
function simpleMarkdownToHtml(markdown) {
  if (!markdown) return '';
  
  let html = markdown
    // 移除 Frontmatter (--- ... ---)
    .replace(/^---[\s\S]*?---/, '')
    // 标题 (# -> h1-h6)
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    // 粗体 (**text**)
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    // 图片 (![alt](url)) -> 转换为绝对路径，方便图片索引
    .replace(/!\[(.*?)\]\((.*?)\)/gim, (match, alt, src) => {
      // 如果图片是相对路径，加上 CDN 前缀
      const fullSrc = src.startsWith('http') ? src : `${CDN_BASE}/blog/${src}`;
      return `<img src="${fullSrc}" alt="${alt}">`;
    })
    // 链接 ([text](url))
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
    // 引用 (> text)
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    // 列表 (- item)
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    // 换行 -> 段落
    .replace(/\n\n/g, '</p><p>');

  return `<div class="seo-article-body"><p>${html}</p></div>`;
}

export const onRequest = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  
  // 路径规范化
  let path = url.pathname.replace(/\/$/, "").replace(/\.html$/, "");

  // 1. 过滤：非爬虫 或 非/blog页面 -> 跳过
  if (!isBot(userAgent) || path !== '/blog') {
    return next();
  }

  // 2. 获取原始页面
  const response = await next();
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }

  // 3. 获取数据
  const posts = await getBlogList();
  if (!posts || posts.length === 0) return response;

  // === 场景 A: 详情页 (带有 ?id=xxx 或 ?title=xxx) ===
  const queryId = url.searchParams.get('id');
  const queryTitle = url.searchParams.get('title');

  if (queryId || queryTitle) {
    let post = null;
    
    // 匹配逻辑
    if (queryId) {
      post = posts.find(p => 
        p.file === queryId || 
        p.file === `${queryId}.md` || 
        p.file.replace('.md', '') === queryId
      );
    } else if (queryTitle) {
      const decodedTitle = decodeURIComponent(queryTitle);
      post = posts.find(p => p.title.includes(decodedTitle));
    }

    if (post) {
      // 🔥 核心步骤：获取并解析 Markdown 内容
      const rawMarkdown = await getMarkdownContent(post.file);
      const contentHtml = simpleMarkdownToHtml(rawMarkdown);
      const cleanId = post.file.replace(/\.md$/, '');

      // 构造当前页面的规范链接 (Canonical URL)
      // 如果你的 Sitemap 用的是 title，这里最好也保持一致，或者统一用 title
      const canonicalUrl = `https://satinau.cn/blog?title=${encodeURIComponent(post.title)}`;

      return new HTMLRewriter()
        // 修改 Title
        .on('title', {
          element(el) { el.setInnerContent(`${post.title} - 缎金SatinAu`); }
        })
        // 修改 Description
        .on('meta[name="description"]', {
          element(el) { 
            // 截取正文前100字作为描述，如果没有正文则用标题
            const desc = rawMarkdown 
              ? rawMarkdown.replace(/[#*`\[\]]/g, '').slice(0, 150).replace(/\n/g, ' ') + '...'
              : `${post.title} - 发布于 ${post.date}`;
            el.setAttribute('content', desc); 
          }
        })
        // 修改 Canonical (防止重复收录)
        .on('link[rel="canonical"]', {
            element(el) { el.setAttribute('href', canonicalUrl); }
        })
        // 移除 display:none
        .on('article#postView', {
          element(el) { el.removeAttribute('style'); } 
        })
        // 隐藏列表
        .on('div#blogList', {
          element(el) { el.setAttribute('style', 'display:none'); }
        })
        // 填入元数据
        .on('h2#postTitle', {
          element(el) { el.setInnerContent(post.title); }
        })
        .on('p#postDate', {
          element(el) { el.setInnerContent(post.date); }
        })
        // 🔥 填入转换后的 HTML 正文
        .on('div#postContent', {
          element(el) {
            // 在正文中加入一些引导性结构
            const fullHtml = `
              <div class="article-header">
                <h1>${post.title}</h1>
                <p><strong>发布时间：</strong>${post.date}</p>
              </div>
              <hr>
              ${contentHtml || '<p>文章加载中...</p>'}
              <hr>
              <div class="article-footer">
                <p>本文由 缎金SatinAu 原创。</p>
                <p><a href="${canonicalUrl}">访问原文链接</a></p>
              </div>
            `;
            el.setInnerContent(fullHtml, { html: true });
          }
        })
        .transform(response);
    }
  }

  // === 场景 B: 列表页 (无参数) ===
  else {
    const listHtml = posts.map(post => {
      // 为了配合 Sitemap，这里列表页的链接优先使用 ?title=
      // 这样爬虫从列表页爬进去的链接，和你 sitemap.xml 里的链接就是一样的了
      const targetUrl = `/blog?title=${encodeURIComponent(post.title)}`;
      
      return `
      <div class="contact-card" style="display:block; margin-bottom:15px;">
        <div class="text">
          <div class="label">
            <a href="${targetUrl}" style="text-decoration:none; color:inherit; font-weight:bold; font-size:1.1em;">
              ${post.title}
            </a>
          </div>
          <div class="value">${post.date}</div>
        </div>
      </div>
      `;
    }).join('');

    return new HTMLRewriter()
      .on('div#blogList', {
        element(el) {
          el.setInnerContent(listHtml, { html: true });
        }
      })
      .transform(response);
  }

  return response;
};