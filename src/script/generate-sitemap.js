/*
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
*/

/**
 * 自动生成Sitemap脚本
 * 从blog API获取博客文章列表，生成/更新sitemap.xml
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    blogApiUrl: 'https://blog.satinau.cn/blog/index.json',
    sitemapPath: path.join(__dirname, '../../sitemap.xml'),
    baseUrl: 'https://satinau.cn',
    timeout: 10000,
};

// 默认页面配置（优先级和频率）
const DEFAULT_PAGES = [
    { path: '/', priority: 1.0, changefreq: 'weekly' },
    { path: '/blog', priority: 0.8, changefreq: 'daily' },
    { path: '/zelynn', priority: 0.8, changefreq: 'monthly' },
    { path: '/pages/character', priority: 0.6, changefreq: 'monthly' },
    { path: '/pages/moments', priority: 0.6, changefreq: 'weekly' },
    { path: '/pages/aboutme', priority: 0.6, changefreq: 'monthly' },
    { path: '/pages/friendlink', priority: 0.6, changefreq: 'monthly' },
    { path: '/pages/playlist', priority: 0.6, changefreq: 'monthly' },
    { path: '/pages/settings', priority: 0.4, changefreq: 'yearly' },
];

/**
 * 获取当前日期（ISO 8601格式）
 */
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 通过HTTPS获取JSON数据
 */
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`请求超时: ${url}`));
        }, CONFIG.timeout);

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://satinau.cn/',
                'Cache-Control': 'no-cache'
            }
        };

        https.get(url, options, (res) => {
            let data = '';

            if (res.statusCode !== 200) {
                clearTimeout(timeoutId);
                reject(new Error(`HTTP ${res.statusCode}: ${url}`));
                return;
            }

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                clearTimeout(timeoutId);
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON解析失败: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}

/**
 * 生成单个URL条目
 */
function generateUrlEntry(loc, lastmod, priority, changefreq = 'monthly') {
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`;
}

/**
 * 生成Sitemap XML内容
 */
function generateSitemapXML(pages, blogs = []) {
    const currentDate = getCurrentDate();
    const entries = [];

    // 添加默认页面
    for (const page of pages) {
        const fullUrl = `${CONFIG.baseUrl}${page.path}`;
        const changefreq = page.changefreq || 'monthly';
        entries.push(generateUrlEntry(fullUrl, currentDate, page.priority, changefreq));
    }

    // 添加博客文章页面
    for (const blog of blogs) {
        // 使用blog的日期作为lastmod，如果没有则使用当前日期
        const lastmod = blog.date || currentDate;
        const blogUrl = `${CONFIG.baseUrl}/blog?title=${encodeURIComponent(blog.title)}`;
        entries.push(generateUrlEntry(blogUrl, lastmod, 0.7, 'monthly'));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

    return xml;
}

/**
 * 主函数
 */
async function main() {
    console.log('[Sitemap] 开始生成Sitemap...');
    console.log(`[Sitemap] 博客API: ${CONFIG.blogApiUrl}`);

    try {
        // 获取博客列表
        console.log('[Sitemap] 正在获取博客文章列表...');
        const blogs = await fetchJSON(CONFIG.blogApiUrl);

        if (!Array.isArray(blogs)) {
            throw new Error('API返回数据格式错误：期望数组');
        }

        console.log(`[Sitemap] 成功获取 ${blogs.length} 篇博客文章`);

        // 生成Sitemap
        const sitemapXML = generateSitemapXML(DEFAULT_PAGES, blogs);

        // 写入文件
        fs.writeFileSync(CONFIG.sitemapPath, sitemapXML, 'utf8');
        console.log(`[Sitemap] ✓ Sitemap已生成: ${CONFIG.sitemapPath}`);
        console.log(`[Sitemap] 总URL数: ${DEFAULT_PAGES.length + blogs.length}`);
        console.log('[Sitemap] Sitemap生成完成！');
    } catch (error) {
        console.error('[Sitemap] ✗ 生成Sitemap失败:');
        console.log('[Sitemap] 正在回退到生成仅含静态页面的Sitemap...');
        const fallbackXML = generateSitemapXML(DEFAULT_PAGES, []); 
        fs.writeFileSync(CONFIG.sitemapPath, fallbackXML, 'utf8');
        process.exit(0); 
    }
}

main();
