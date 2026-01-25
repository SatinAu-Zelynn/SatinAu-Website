# SSR改造 - 快速入门指南

## 改造概览

✅ **已完成的工作：**

1. **架构改造**
   - ✅ CSR → SSR转换
   - ✅ 博客页面预渲染
   - ✅ URL结构优化：`/blog/?title=xxx` → `/blog/slug/`

2. **脚本和工具**
   - ✅ `build-ssr.js` - SSR页面生成脚本
   - ✅ `update-sitemap.js` - Sitemap自动更新
   - ✅ `blog-list.js` - 列表页前端逻辑
   - ✅ `compat-redirect.js` - 向后兼容性脚本

3. **部署配置**
   - ✅ `vercel.json` - Vercel部署配置
   - ✅ `wrangler.toml` - Cloudflare Pages配置
   - ✅ `build.sh` - 统一构建脚本
   - ✅ `package.json` - Node.js依赖定义

4. **SEO优化**
   - ✅ Open Graph元标签
   - ✅ Twitter Card支持
   - ✅ JSON-LD结构化数据
   - ✅ Sitemap自动生成

## 文件结构

```
.
├── blog.html                          # 博客列表页面
├── build.sh                           # 构建脚本
├── build-ssr.js                       # SSR生成脚本 ⭐
├── update-sitemap.js                  # Sitemap更新脚本 ⭐
├── test-ssr.js                        # 测试脚本 ⭐
├── package.json                       # Node.js依赖 ⭐
├── vercel.json                        # Vercel配置 ⭐
├── wrangler.toml                      # Cloudflare配置 ⭐
├── SSR-MIGRATION.md                   # 详细文档 ⭐
├── src/
│   └── script/
│       ├── compat-redirect.js         # 兼容性脚本 ⭐
│       └── pages/
│           ├── blog.js                # 旧版本（保留）
│           └── blog-list.js           # 新列表页脚本 ⭐
└── blog/
    ├── index.json                     # 文章元数据（自动生成）
    └── [article-slug]/
        └── index.html                 # 文章详情页（自动生成）
```

⭐ = 新增或修改的文件

## 快速测试

### 1. 验证改造

```bash
node test-ssr.js
```

输出应显示：`✅ 所有检查通过 (100%)`

### 2. 本地生成SSR页面

```bash
# 安装依赖
npm install

# 运行完整构建
npm run build

# 或单独运行SSR生成
npm run ssr
```

### 3. 启动本地服务器

```bash
# 使用 Python 3
python -m http.server 8000

# 或使用 Node.js
npx http-server
```

访问：
- 博客列表: http://localhost:8000/blog/
- 旧URL自动重定向：http://localhost:8000/blog.html?title=test

## 部署步骤

### Vercel部署

1. 连接GitHub仓库到Vercel
2. Vercel会自动检测 `vercel.json`
3. 自动执行 `npm install && bash build.sh`
4. SSR页面自动生成

```bash
# 手动部署测试
vercel
```

### Cloudflare Pages部署

1. 连接GitHub仓库到Cloudflare Pages
2. 设置构建命令：`bash build.sh`
3. 确保Node.js可用
4. 部署时自动运行SSR生成

```bash
# 使用 Wrangler CLI 部署
wrangler pages deploy
```

## 验证部署

### 测试清单

- [ ] 访问 `/blog/` 显示文章列表
- [ ] 点击文章链接跳转到 `/blog/article-slug/`
- [ ] 文章页包含：
  - [ ] 完整的HTML内容（不依赖JavaScript）
  - [ ] SEO元数据（og:title, og:description等）
  - [ ] 文章标题和日期
  - [ ] 搜索引擎可抓取
- [ ] 旧URL重定向：
  - [ ] `/blog.html?title=xxx` → `/blog/xxx/`
- [ ] 搜索功能正常
- [ ] 返回列表功能正常

### 检查搜索引擎

**Google Search Console:**
1. 提交新sitemap：`/sitemap.xml`
2. 检查索引状态
3. 验证 `/blog/` 是首选域

**百度站长工具:**
1. 提交 `/blog/` URL
2. 提交sitemap
3. 检查抓取统计

## 性能检查

```bash
# Lighthouse 审计（需要安装）
npm install -g lighthouse

# 运行审计
lighthouse http://localhost:8000/blog/ --view

# 检查关键指标
# - FCP (First Contentful Paint)
# - LCP (Largest Contentful Paint)
# - CLS (Cumulative Layout Shift)
```

## 常见问题

### Q: 为什么需要Node.js?

**A:** 为了在构建时生成SSR页面。如果部署平台（Vercel/Cloudflare）已安装Node.js，无需本地操作。

### Q: 可以继续使用旧的CSR URL吗?

**A:** 可以。`compat-redirect.js` 会自动将旧URL重定向到新URL。

### Q: 构建需要多久?

**A:** 取决于文章数量。通常 < 1 分钟（假设文章 < 100篇）。

### Q: 如何优化构建速度?

**A:** 修改 `build-ssr.js` 使用 `Promise.all()` 并发生成。详见 SSR-MIGRATION.md。

### Q: 新文章何时生效?

**A:** 需要重新部署。可以：
1. 提交新代码触发自动构建
2. 或手动运行 `npm run build`

## 回滚方案

如果需要回退到CSR版本：

```bash
# 恢复 blog.html 使用旧脚本
git checkout HEAD -- blog.html src/script/pages/blog.js

# 删除新文件
rm build-ssr.js update-sitemap.js src/script/compat-redirect.js

# 更新 build.sh 移除SSR调用
```

## 下一步

1. **监控部署** - 在两个平台上验证
2. **检查排名** - 监控Google Search Console
3. **优化性能** - 运行Lighthouse审计
4. **更新文档** - 更新团队wiki或知识库

## 获取帮助

详细文档参见：[SSR-MIGRATION.md](SSR-MIGRATION.md)

主要改动：
- `build-ssr.js` - SSR生成逻辑
- `blog-list.js` - 前端列表逻辑  
- `compat-redirect.js` - 兼容性脚本
- `SSR-MIGRATION.md` - 完整文档

## 成功指标

✅ **改造成功的标志：**

- [ ] 所有SSR检查通过（100%）
- [ ] 两个平台都能部署成功
- [ ] Google能索引 `/blog/` 页面
- [ ] 性能评分 > 80分
- [ ] 没有404错误
- [ ] 用户体验无差异

---

**祝部署顺利！** 🚀
