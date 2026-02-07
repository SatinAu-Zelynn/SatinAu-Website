/*
  Cloudflare Pages Function - SEO Middleware (Final)
  适配 satinau.cn 的 index.json 结构 (file, title, date)
*/

const CDN_BASE = 'https://cdn-cf.satinau.cn';
// ✅ 你的数据源
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
    
    // 匹配逻辑：
    // JSON里的 key 是 "file" (e.g. "文章.md")
    // URL里的 id 可能是 "文章" (无后缀) 或 "文章.md" (有后缀)
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
      // 找到了文章！开始注入 SEO 信息
      return new HTMLRewriter()
        .on('title', {
          element(el) { el.setInnerContent(`${post.title} - 缎金SatinAu`); }
        })
        .on('meta[name="description"]', {
          // 你的JSON没有 preview 字段，这里用 title + date 组合一下，或者截取 title
          element(el) { el.setAttribute('content', `${post.title} - 发布于 ${post.date}`); }
        })
        // 移除 display:none 让爬虫认为内容可见
        .on('article#postView', {
          element(el) { el.removeAttribute('style'); } 
        })
        // 隐藏列表 div
        .on('div#blogList', {
          element(el) { el.setAttribute('style', 'display:none'); }
        })
        // 填入标题
        .on('h2#postTitle', {
          element(el) { el.setInnerContent(post.title); }
        })
        // 填入日期
        .on('p#postDate', {
          element(el) { el.setInnerContent(post.date); }
        })
        // 填入内容区域
        .on('div#postContent', {
          element(el) {
            const contentHTML = `
              <div class="seo-content">
                <h1>${post.title}</h1>
                <p><strong>发布时间：</strong>${post.date}</p>
                <hr>
                <p>（注：这是针对搜索引擎的预览页面，完整交互体验请使用浏览器访问）</p>
                <!-- 生成 Markdown 链接 -->
                <p><a href="${CDN_BASE}/blog/${post.file}">点击下载 Markdown 源文件</a></p>
              </div>
            `;
            el.setInnerContent(contentHTML, { html: true });
          }
        })
        .transform(response);
    }
  }

  // === 场景 B: 列表页 (无参数) ===
  else {
    const listHtml = posts.map(post => {
      // 生成不带 .md 后缀的 ID，让 URL 看上去更干净
      // 例如：file="abc.md" -> id="abc"
      const cleanId = post.file.replace(/\.md$/, '');
      
      return `
      <div class="contact-card" style="display:block; margin-bottom:15px;">
        <div class="text">
          <div class="label">
            <a href="/blog?id=${encodeURIComponent(cleanId)}" style="text-decoration:none; color:inherit;">
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