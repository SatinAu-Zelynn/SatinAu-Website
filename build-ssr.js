#!/usr/bin/env node
/**
 * SSR 博客页面生成脚本
 * 根据远程API获取博客列表，为每篇文章生成预渲染的HTML页面
 * 同时更新 index.json 用于客户端搜索和导航
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 尝试导入 marked，如果失败则使用简单的Markdown处理
let marked;
try {
  // CommonJS 兼容导入
  const markedModule = require('marked');
  marked = markedModule.marked || markedModule;
} catch (err) {
  console.warn('[SSR] marked 未安装，使用基础HTML渲染');
  // 降级方案：简单的Markdown转HTML
  marked = {
    parse: (md) => {
      return md
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^/gm, '<p>')
        .replace(/$/gm, '</p>')
        .replace(/<p><\/p>/g, '');
    }
  };
}

// 配置
const BLOG_API = 'https://blog.satinau.cn/blog/index.json';
const BLOG_CONTENT_BASE = 'https://blog.satinau.cn/blog/';
const OUTPUT_DIR = path.join(__dirname, 'blog');
const SITE_URL = 'https://satinau.cn';

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 将字符串转换为URL-safe的slug
 */
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]/g, '') // 移除特殊字符，保留中文和英文
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

/**
 * HTTPS GET 请求
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 计算读取统计
 */
function calculateReadingStats(mdText) {
  const chineseCount = (mdText.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishCount = (mdText.match(/[a-zA-Z]+/g) || []).length;
  const totalCount = chineseCount + englishCount;
  const readingMinutes = Math.max(
    Math.ceil(chineseCount / 300),
    Math.ceil(englishCount / 200)
  );
  return { totalCount, readingMinutes };
}

/**
 * 生成文章HTML
 */
function generateArticleHTML(post, content, slug) {
  const stats = calculateReadingStats(content);
  
  // 处理Markdown中的相对路径
  const processedContent = content
    .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
      if (!src.startsWith('http://') && !src.startsWith('https://')) {
        return `![${alt}](${BLOG_CONTENT_BASE}${src})`;
      }
      return match;
    });

  // 使用 marked 渲染Markdown
  let htmlContent = marked.parse(processedContent);

  // 处理链接
  htmlContent = htmlContent.replace(/href="(?!http[s]?:\/\/)([^"]+)"/g, (match, href) => {
    if (href.startsWith('#')) return match;
    return `href="${BLOG_CONTENT_BASE}${href}" target="_blank" rel="noopener noreferrer"`;
  });

  const pageTitle = `${post.title} - 缎金SatinAu`;
  const pageUrl = `${SITE_URL}/blog/${slug}/`;
  
  return `<!--
  Copyright 2025 缎金SatinAu

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${pageTitle}</title>
  <meta name="description" content="${post.title} - 缎金SatinAu的个人博客">
  <meta name="keywords" content="缎金,SatinAu,博客,${post.title}">
  <meta name="author" content="缎金SatinAu">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  
  <!-- Open Graph SEO -->
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${post.title} - 缎金SatinAu的个人博客">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="https://satinau.cn/public/SatinAu_logo_v3.5.png">
  <meta property="article:author" content="缎金SatinAu">
  <meta property="article:published_time" content="${post.date}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${post.title}">
  <meta name="twitter:image" content="https://satinau.cn/public/SatinAu_logo_v3.5.png">

  <link rel="canonical" href="${pageUrl}">
  <link rel="icon" type="image/x-icon" href="/public/favicon.ico">
  <link rel="stylesheet" href="/src/style.css">
  <link rel="preload" href="https://font.sec.miui.com/font/css?family=MiSans:200,300,400,450,500,600,650,700:Chinese_Simplify,Latin&display=swap" as="style" onload='this.onload=null,this.rel="stylesheet"'>
  <script src="/src/script/config.js"><\/script>
  <script src="/src/script/common.js" defer><\/script>
  <script src="/src/script/components/comment.js" defer><\/script>
  <script src="/src/script/components/CRCMenu.v2.js"><\/script>
  <script src="/src/script/components/GlobalModal.js" defer><\/script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"><\/script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/viewerjs@1.11.6/dist/viewer.min.css">
  <script src="https://cdn.jsdelivr.net/npm/viewerjs@1.11.6/dist/viewer.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>

  <script type="text/javascript">
      (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "trwlkhxzch");
  <\/script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${post.title}",
    "datePublished": "${post.date}",
    "author": {
      "@type": "Person",
      "name": "缎金SatinAu",
      "url": "https://satinau.cn"
    },
    "image": "https://satinau.cn/public/SatinAu_logo_v3.5.png",
    "url": "${pageUrl}"
  }
  <\/script>
</head>
<body id="blog-article-page">
  <div class="color-bg color-bg-1"><\/div>
  <div class="color-bg color-bg-2"><\/div>
  <div class="color-bg color-bg-3"><\/div>
  <div class="color-bg color-bg-4"><\/div>
  
  <main class="page">
    <article class="md-article">
      <div class="post-meta">
        <a href="/blog/" class="back-button" aria-label="返回">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/><\/svg>
        </a>
        <h1 id="postTitle">${post.title}</h1>
        <p id="postDate" class="post-date">${post.date} · ${stats.totalCount} 字 · 约 ${stats.readingMinutes} 分钟</p>
      </div>
      
      <div id="postContent" class="md-body">
        ${htmlContent}
      </div>
      
      <div class="post-actions-panel">
        <div class="action-item">
          <a href="/blog/" class="action-btn" aria-label="文章列表">
            <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><\/svg>
          </a>
          <span class="action-label">文章列表</span>
        </div>
        <div class="action-item">
          <button id="backToTopBtn" class="action-btn" aria-label="回到顶部">
            <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><\/svg>
          </button>
          <span class="action-label">回到顶部</span>
        </div>
        <div class="action-item">
          <button id="shareArticleBtn" class="action-btn" aria-label="分享文章">
            <svg viewBox="0 0 24 24">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor"/>
            <\/svg>
          </button>
          <span class="action-label">分享</span>
        </div>
      </div>
    </article>

    <script src="/src/script/components/footer.js"><\/script>
    <site-footer><\/site-footer>
  </main>

  <div id="toast" class="toast"><\/div>
  <global-modal id="globalModal"><\/global-modal>
  <script src="/src/script/components/navigate.js"><\/script>
  <navigate-bar><\/navigate-bar>
  
  <script>
    // 回到顶部功能
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    
    // 分享功能
    const shareBtn = document.getElementById('shareArticleBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const title = document.getElementById('postTitle')?.textContent || '未命名文章';
        const date = document.getElementById('postDate')?.textContent?.split('·')[0]?.trim() || '';
        const url = window.location.href;
        
        const modal = document.getElementById('globalModal');
        if (modal && modal.share) {
          modal.share(title, '${post.title}', url, date);
        } else {
          const tempInput = document.createElement('input');
          document.body.appendChild(tempInput);
          tempInput.value = url;
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
          if(typeof showToast === 'function') showToast('已复制文章链接');
          else alert('已复制链接');
        }
      });
    }
    
    // 初始化图片查看器
    if (window.Viewer && document.querySelector('.md-body')) {
      window.imageViewer = new Viewer(document.querySelector('.md-body'), {
        title: function(img) {
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          return '${post.title} (' + width + ' × ' + height + ')';
        },
        backdrop: true,
        toolbar: true,
        navbar: true,
        tooltip: true,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: true,
        transition: true,
        fullscreen: true,
        keyboard: true,
        className: 'viewer-custom'
      });
    }
  </script>
</body>
</html>
`;
}

/**
 * 主生成函数
 */
async function generateSSRPages() {
  try {
    console.log('[SSR] 开始生成SSR页面...');
    
    // 1. 获取博客列表
    console.log('[SSR] 获取博客列表:', BLOG_API);
    const indexData = await httpsGet(BLOG_API);
    const posts = JSON.parse(indexData);
    
    console.log(`[SSR] 找到 ${posts.length} 篇文章`);
    
    if (posts.length === 0) {
      console.warn('[SSR] 警告：没有找到文章');
      return;
    }

    // 2. 为每篇文章创建目录和HTML
    for (const post of posts) {
      const slug = titleToSlug(post.title);
      const articleDir = path.join(OUTPUT_DIR, slug);
      
      // 创建目录
      if (!fs.existsSync(articleDir)) {
        fs.mkdirSync(articleDir, { recursive: true });
      }

      try {
        // 获取文章内容
        console.log(`[SSR] 获取文章: ${post.title}`);
        const content = await httpsGet(BLOG_CONTENT_BASE + post.file);
        
        // 生成HTML
        const html = generateArticleHTML(post, content, slug);
        
        // 写入文件
        const htmlPath = path.join(articleDir, 'index.html');
        fs.writeFileSync(htmlPath, html, 'utf-8');
        
        console.log(`[SSR] ✓ 生成: /blog/${slug}/`);
      } catch (err) {
        console.error(`[SSR] ✗ 失败 [${post.title}]:`, err.message);
      }
    }

    // 3. 保存博客列表JSON供客户端使用（用于搜索和列表页）
    const indexJsonPath = path.join(OUTPUT_DIR, 'index.json');
    fs.writeFileSync(indexJsonPath, JSON.stringify(posts, null, 2), 'utf-8');
    console.log('[SSR] ✓ 保存: /blog/index.json');

    console.log('[SSR] ✅ SSR页面生成完成');
  } catch (err) {
    console.error('[SSR] ❌ 生成失败:', err);
    process.exit(1);
  }
}

// 运行
generateSSRPages();
