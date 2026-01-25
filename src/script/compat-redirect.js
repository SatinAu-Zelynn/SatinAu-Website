/*
  URL 重定向兼容性脚本
  处理从旧 CSR URL (blog.html?title=xxx) 到新 SSR URL (/blog/slug/)的重定向
  这个脚本在 common.js 加载时执行，确保向后兼容性
*/

(function() {
  // 只在 blog.html 页面执行
  if (!location.pathname.includes('/blog')) {
    return;
  }

  // 检查是否有旧的 title 参数
  const params = new URLSearchParams(window.location.search);
  const oldTitle = params.get('title');

  if (oldTitle) {
    // 将标题转换为 slug
    function titleToSlug(title) {
      return title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 100);
    }

    const slug = titleToSlug(decodeURIComponent(oldTitle));
    const newUrl = `/blog/${slug}/`;

    // 使用 301 永久重定向，用于 SEO
    // 如果浏览器支持 Navigation API，否则使用 location.replace
    if (window.location.href !== newUrl) {
      // 保留旧 URL 历史记录但立即重定向
      window.location.replace(newUrl);
    }
  }
})();
