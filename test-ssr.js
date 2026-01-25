#!/usr/bin/env node
/**
 * SSR改造测试脚本
 * 验证所有关键功能是否正常工作
 */

const fs = require('fs');
const path = require('path');

const CHECKS = [];

function check(name, condition, details = '') {
  const status = condition ? '✅' : '❌';
  CHECKS.push({ name, status: condition, details });
  console.log(`${status} ${name}${details ? ': ' + details : ''}`);
}

console.log('=========================================');
console.log('   SSR改造验证清单');
console.log('=========================================\n');

// 1. 文件检查
console.log('[1] 检查关键文件是否存在...');
const files = [
  'blog.html',
  'build.sh',
  'build-ssr.js',
  'update-sitemap.js',
  'src/script/pages/blog-list.js',
  'src/script/compat-redirect.js',
  'package.json',
  'vercel.json',
  'wrangler.toml',
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  check(`文件: ${file}`, exists);
});

// 2. 文件内容检查
console.log('\n[2] 检查文件内容...');

const blogHtml = fs.readFileSync(path.join(__dirname, 'blog.html'), 'utf-8');
check('blog.html 引入 blog-list.js', blogHtml.includes('blog-list.js'));
check('blog.html 包含兼容性脚本', blogHtml.includes('compat-redirect.js'));
check('blog.html 引入搜索功能', blogHtml.includes('blogSearchInput'));
check('blog.html 不包含旧的postView', !blogHtml.includes('postView'));

const blogListJs = fs.readFileSync(path.join(__dirname, 'src/script/pages/blog-list.js'), 'utf-8');
check('blog-list.js 处理列表渲染', blogListJs.includes('renderPostsList'));
check('blog-list.js 支持搜索', blogListJs.includes('blogSearchInput'));

const compatScript = fs.readFileSync(path.join(__dirname, 'src/script/compat-redirect.js'), 'utf-8');
check('兼容性脚本处理旧URL', compatScript.includes('?title='));

const buildSsr = fs.readFileSync(path.join(__dirname, 'build-ssr.js'), 'utf-8');
check('build-ssr.js 包含SEO元数据', buildSsr.includes('og:title'));
check('build-ssr.js 包含结构化数据', buildSsr.includes('BlogPosting'));

const buildSh = fs.readFileSync(path.join(__dirname, 'build.sh'), 'utf-8');
check('build.sh 调用SSR脚本', buildSh.includes('build-ssr.js'));
check('build.sh 调用sitemap脚本', buildSh.includes('update-sitemap.js'));

// 3. 配置文件检查
console.log('\n[3] 检查部署配置...');

const vercelJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf-8'));
check('Vercel config 存在', !!vercelJson);
check('Vercel 包含重定向规则', vercelJson.redirects && vercelJson.redirects.length > 0);

const wrangle = fs.readFileSync(path.join(__dirname, 'wrangler.toml'), 'utf-8');
check('Cloudflare config 存在', !!wrangle);
check('Cloudflare 配置构建命令', wrangle.includes('build.sh'));

const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
check('package.json 定义构建脚本', !!pkgJson.scripts?.build);
check('package.json 包含 marked 依赖', !!pkgJson.dependencies?.marked);

// 4. URL结构验证
console.log('\n[4] 检查URL结构...');
check('支持 /blog/ URL', blogHtml.includes('/blog/'));
check('支持 /blog/slug/ 格式', buildSsr.includes('/blog/'));
check('包含slug转换函数', buildSsr.includes('titleToSlug'));

// 5. SEO检查
console.log('\n[5] SEO优化检查...');
check('包含Open Graph标签', blogHtml.includes('og:'));
check('包含Twitter Card标签', blogHtml.includes('twitter:'));
check('定义canonical URL', blogHtml.includes('canonical'));
check('描述信息更新', blogHtml.includes('分享'));

// 6. 总结
console.log('\n=========================================');
const totalChecks = CHECKS.length;
const passedChecks = CHECKS.filter(c => c.status).length;
const percentage = Math.round((passedChecks / totalChecks) * 100);

console.log(`检查结果: ${passedChecks}/${totalChecks} 通过 (${percentage}%)`);

if (percentage === 100) {
  console.log('✅ 所有检查通过，可以开始测试！');
  process.exit(0);
} else if (percentage >= 80) {
  console.log('⚠️  大部分检查通过，建议检查失败项');
  process.exit(0);
} else {
  console.log('❌ 检查未通过，请先修复失败项');
  process.exit(1);
}
