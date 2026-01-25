#!/usr/bin/env node
/**
 * 更新 sitemap.xml
 * 根据 blog/index.json 中的文章列表添加博客文章URL
 */

const fs = require('fs');
const path = require('path');

// 基础URL
const SITE_URL = 'https://satinau.cn';
const BLOG_INDEX_PATH = path.join(__dirname, 'blog', 'index.json');
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

// 将标题转换为URL-safe的slug
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

// 获取当前日期（YYYY-MM-DD格式）
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

// 解析现有sitemap
function parseSitemap(content) {
  const urls = [];
  const urlRegex = /<url>[\s\S]*?<\/url>/g;
  
  const matches = content.match(urlRegex) || [];
  matches.forEach(match => {
    const locMatch = match.match(/<loc>(.*?)<\/loc>/);
    if (locMatch) {
      urls.push({
        loc: locMatch[1],
        fullEntry: match
      });
    }
  });
  
  return urls;
}

// 生成URL条目
function generateUrlEntry(loc, lastmod, priority = 0.6) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
  </url>`;
}

// 主函数
async function updateSitemap() {
  try {
    // 检查博客索引文件是否存在
    if (!fs.existsSync(BLOG_INDEX_PATH)) {
      console.log('[SITEMAP] blog/index.json 不存在，跳过博客URL更新');
      return;
    }

    // 读取博客列表
    const blogIndexContent = fs.readFileSync(BLOG_INDEX_PATH, 'utf-8');
    const posts = JSON.parse(blogIndexContent);

    // 读取现有sitemap
    let sitemapContent = fs.readFileSync(SITEMAP_PATH, 'utf-8');
    const existingUrls = parseSitemap(sitemapContent);
    
    // 移除旧的博客文章条目（保留基础页面）
    existingUrls.forEach(item => {
      if (item.loc.startsWith(`${SITE_URL}/blog/`) && !item.loc.endsWith('/blog/')) {
        sitemapContent = sitemapContent.replace(item.fullEntry, '');
      }
    });

    // 生成新的博客文章URL条目
    const currentDate = getCurrentDate();
    const blogUrlEntries = posts.map(post => {
      const slug = titleToSlug(post.title);
      const loc = `${SITE_URL}/blog/${slug}/`;
      return generateUrlEntry(loc, post.date || currentDate, 0.7);
    }).join('\n');

    // 更新博客列表主页的日期
    sitemapContent = sitemapContent.replace(
      /<url>\s*<loc>https:\/\/satinau\.cn\/blog\/<\/loc>[\s\S]*?<\/url>/,
      generateUrlEntry(`${SITE_URL}/blog/`, currentDate, 0.8)
    );

    // 如果没有找到blog/的条目，插入它
    if (!sitemapContent.includes(`${SITE_URL}/blog/`)) {
      const insertBefore = '</urlset>';
      const blogEntry = `\n  <url>
    <loc>${SITE_URL}/blog/</loc>
    <lastmod>${currentDate}</lastmod>
    <priority>0.8</priority>
  </url>`;
      sitemapContent = sitemapContent.replace(insertBefore, blogEntry + '\n' + insertBefore);
    }

    // 在最后添加博客文章条目
    const insertBefore = '</urlset>';
    if (blogUrlEntries) {
      sitemapContent = sitemapContent.replace(
        insertBefore,
        '\n' + blogUrlEntries + '\n' + insertBefore
      );
    }

    // 写回sitemap
    fs.writeFileSync(SITEMAP_PATH, sitemapContent, 'utf-8');
    
    console.log(`[SITEMAP] ✓ 已添加 ${posts.length} 篇博客文章到sitemap`);
    console.log('[SITEMAP] ✅ sitemap.xml 更新完成');

  } catch (err) {
    console.error('[SITEMAP] ❌ 更新失败:', err.message);
    process.exit(1);
  }
}

// 运行
updateSitemap();
