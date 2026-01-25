# 博客SSR改造说明

## 概述

本次改造将博客系统从客户端渲染(CSR)转换为服务器端渲染(SSR)，同时优化URL结构以支持SEO。

## 主要变更

### 1. URL结构优化

**旧URL结构 (CSR):**
```
/blog.html?title=文章标题
```

**新URL结构 (SSR):**
```
/blog/
/blog/文章-slug/
```

### 2. 架构变化

#### 旧架构 (CSR)
- `blog.html` - 单一页面，包含列表和详情视图
- `blog.js` - 处理所有逻辑，通过API加载数据
- URL通过查询参数传递：`?title=xxx`
- 不利于SEO（动态内容）

#### 新架构 (SSR)
- `blog.html` - 仅显示博客列表
- `blog/[slug]/index.html` - 每篇文章的独立页面
- `blog-list.js` - 处理列表页逻辑和搜索
- 完整的HTML预渲染，利于SEO

### 3. 生成流程

```
build.sh
  ├─ 生成配置文件 (config.js)
  └─ 调用 build-ssr.js
       ├─ 获取博客索引 (https://blog.satinau.cn/blog/index.json)
       ├─ 逐篇获取文章内容 (https://blog.satinau.cn/blog/{filename})
       ├─ 为每篇文章生成:
       │  ├─ blog/{slug}/index.html (完整HTML)
       │  └─ 包含SEO元数据和结构化数据
       └─ 保存 blog/index.json (供列表页使用)
```

### 4. 文件结构

```
blog/
├── index.html          # 博客列表页面 (主页)
├── index.json          # 文章元数据 (由SSR脚本生成)
└── [article-slug]/
    └── index.html      # 单篇文章 (由SSR脚本生成)
```

## 部署配置

### Cloudflare Pages

配置文件：`wrangler.toml`

- 自动检测 CF_PAGES 环境变量
- 执行 `bash build.sh` 进行构建
- 自动生成所有SSR页面

**优点:**
- 免费CDN加速
- Workers支持边缘计算
- 自动部署

### Vercel

配置文件：`vercel.json`

- 自动检测 VERCEL 环境变量
- 执行 `npm install && bash build.sh`
- 自动生成所有SSR页面

**优点:**
- 快速部署
- 预览功能完善
- 分析工具

## 向后兼容性

### 自动重定向

创建了 `src/script/compat-redirect.js` 脚本：

```javascript
// 旧URL: /blog.html?title=文章标题
// 自动重定向到: /blog/文章-slug/
```

此脚本在 `blog.html` 加载时执行，确保旧链接仍可用。

### 重定向规则

**Cloudflare Pages (_redirects):**
```
/blog.html -> /blog/     (301 永久重定向)
```

**Vercel (vercel.json):**
```json
{
  "redirects": [
    {
      "source": "/blog.html(\\?title=.*)?",
      "destination": "/blog/",
      "permanent": true
    }
  ]
}
```

## SEO优化

### 1. 元数据

每篇文章包含：
- `<title>` - 文章标题
- `<meta name="description">` - 文章描述
- `<meta name="keywords">` - 关键词
- Open Graph 标签（社交分享）
- Twitter Card 标签
- Canonical URL

### 2. 结构化数据

每篇文章包含JSON-LD结构：
```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "文章标题",
  "datePublished": "2024-01-01",
  "author": { "@type": "Person", "name": "缎金SatinAu" },
  "url": "https://satinau.cn/blog/article-slug/"
}
```

### 3. URL优化

- URL包含中文/英文关键词
- 使用 `-` 分隔（SEO最佳实践）
- URL safe slug转换
- 每篇文章唯一URL

### 4. Sitemap

需要更新 `sitemap.xml`：
```xml
<url>
  <loc>https://satinau.cn/blog/</loc>
  <lastmod>2024-01-01</lastmod>
  <changefreq>weekly</changefreq>
</url>
<url>
  <loc>https://satinau.cn/blog/article-slug/</loc>
  <lastmod>2024-01-01</lastmod>
  <changefreq>monthly</changefreq>
</url>
```

## 本地测试

### 前置要求

- Node.js 16+ 
- npm 或 yarn

### 安装依赖

```bash
npm install marked
```

### 运行SSR生成

```bash
node build-ssr.js
```

输出示例：
```
[SSR] 开始生成SSR页面...
[SSR] 获取博客列表
[SSR] 找到 5 篇文章
[SSR] 获取文章: 如何使用TypeScript
[SSR] ✓ 生成: /blog/如何使用typescript/
...
[SSR] ✅ SSR页面生成完成
```

### 启动本地服务器

```bash
# 使用 Python
python -m http.server 8000

# 或使用 Node.js
npx http-server
```

访问：
- 列表页: http://localhost:8000/blog/
- 文章页: http://localhost:8000/blog/article-slug/

## 性能考量

### 优点

1. **SEO友好**
   - 完整的HTML文本内容
   - 搜索引擎可直接爬取
   - 无需JavaScript即可访问内容

2. **首屏加载快**
   - HTML直接渲染，无需等待JavaScript
   - 可立即显示内容

3. **访问速度**
   - CDN缓存静态HTML
   - 无服务器计算需求

### 考量事项

1. **构建时间**
   - 需要逐篇获取并渲染文章
   - 文章越多，构建越慢（可优化为并发）

2. **更新延迟**
   - 新文章需要重新部署
   - 无法实时更新

3. **存储空间**
   - 每篇文章一个HTML文件
   - 对于大量文章需要考虑

## 优化建议

### 1. 并发生成（推荐）

修改 `build-ssr.js` 的生成逻辑使用 Promise.all()：

```javascript
await Promise.all(posts.map(post => generateArticle(post)));
```

### 2. 增量生成

只生成修改过的文章，需要：
- 记录文章的最后修改时间
- 比较本地版本和远程版本
- 仅生成新增或修改的文章

### 3. 缓存优化

- 配置CDN缓存规则
- 设置长期缓存头（Cache-Control）
- 使用版本哈希

## 故障排查

### 问题1：SSR脚本失败

**症状:** `build.sh` 执行时SSR生成失败

**解决:**
1. 检查 Node.js 是否安装：`node --version`
2. 检查博客API是否可访问：`curl https://blog.satinau.cn/blog/index.json`
3. 查看脚本输出的错误信息

### 问题2：博客列表为空

**症状:** `/blog/` 显示"没有找到文章"

**解决:**
1. 确保 `/blog/index.json` 存在
2. 检查网络连接
3. 验证远程API可用

### 问题3：旧URL不重定向

**症状:** `/blog.html?title=xxx` 不自动跳转

**解决:**
1. 检查 `compat-redirect.js` 是否被加载
2. 查看浏览器控制台是否有错误
3. 检查服务器重定向规则是否正确配置

## 迁移清单

- [x] 创建SSR生成脚本 (`build-ssr.js`)
- [x] 修改 `blog.html` 为列表页
- [x] 创建 `blog-list.js` 处理列表逻辑
- [x] 更新 `build.sh` 调用SSR脚本
- [x] 配置 Vercel (`vercel.json`)
- [x] 配置 Cloudflare (`wrangler.toml`)
- [x] 创建兼容性脚本 (`compat-redirect.js`)
- [ ] 更新 `sitemap.xml`
- [ ] 测试所有链接
- [ ] 验证 SEO 元数据
- [ ] 在两个平台上线

## 需要手工处理

### 1. 旧博客.html页面备份

如需保留完整兼容，可在 `pages/blog-csr-legacy.html` 中保存旧版本。

### 2. Google Search Console

- 更新首选域：https://satinau.cn/blog/
- 提交新的 sitemap.xml
- 监控索引状态

### 3. 外部链接

- 检查内部链接是否指向 `/blog/`
- 发布公告说明URL变更
- 考虑使用 301 重定向确保SEO权重转移

## 参考资源

- [Google SEO入门指南](https://developers.google.com/search/docs)
- [Markdown渲染库: marked](https://marked.js.org/)
- [Cloudflare Pages文档](https://developers.cloudflare.com/pages/)
- [Vercel部署文档](https://vercel.com/docs)
