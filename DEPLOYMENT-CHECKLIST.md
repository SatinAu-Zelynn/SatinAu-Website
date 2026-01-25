# 部署前检查清单

## 改造验证

- [x] 运行 `node test-ssr.js` - 所有检查通过 (33/33)
- [x] 验证文件结构完整
- [x] 确认配置文件正确

## 本地测试

- [ ] 安装依赖：`npm install`
- [ ] 运行构建：`npm run build`
- [ ] 验证 `blog/` 目录生成
- [ ] 验证 `blog/index.json` 包含文章列表
- [ ] 启动本地服务器
- [ ] 测试 `/blog/` 列表页
- [ ] 测试 `/blog/sample-article/` 详情页
- [ ] 测试搜索功能
- [ ] 测试旧URL重定向

## 代码审查

- [ ] 检查 `blog.html` 没有旧逻辑
- [ ] 检查 `blog-list.js` 搜索功能
- [ ] 检查 `compat-redirect.js` 重定向逻辑
- [ ] 检查 `build-ssr.js` 生成逻辑
- [ ] 验证 `build.sh` 流程

## 配置验证

### Cloudflare Pages (wrangler.toml)
- [ ] 检查构建命令：`bash build.sh`
- [ ] 确认Node.js版本兼容
- [ ] 验证输出目录设置

### Vercel (vercel.json)
- [ ] 检查构建命令
- [ ] 验证重定向规则
- [ ] 确认环境变量设置

## SEO检查

- [ ] 验证 `/blog/` 包含 Open Graph 标签
- [ ] 验证文章页包含 og:title, og:description
- [ ] 验证 canonical URL 设置
- [ ] 验证 structured data (JSON-LD)
- [ ] 确认 sitemap.xml 包含 /blog/ 和文章URL

## 性能检查

- [ ] 运行 Lighthouse 审计（如可用）
- [ ] 检查首屏加载时间 < 3s
- [ ] 验证无阻塞JavaScript
- [ ] 检查图片优化

## 兼容性检查

- [ ] 测试 Chrome (最新版)
- [ ] 测试 Firefox (最新版)
- [ ] 测试 Safari (最新版)
- [ ] 测试 Edge (最新版)
- [ ] 测试 iOS Safari
- [ ] 测试 Android Chrome
- [ ] 验证响应式设计

## 搜索引擎提交

### Google Search Console
- [ ] 验证网站所有权
- [ ] 提交新 sitemap.xml
- [ ] 提交 `/blog/` URL 索引请求
- [ ] 设置首选域
- [ ] 监控爬虫错误

### 百度站长工具
- [ ] 验证网站所有权
- [ ] 提交 sitemap
- [ ] 提交新 URL
- [ ] 配置适配规则

### Bing Webmaster Tools
- [ ] 提交 sitemap
- [ ] 验证网站

## 功能验证

### 列表页 (`/blog/`)
- [ ] 显示所有文章
- [ ] 搜索功能正常
- [ ] 文章数量正确
- [ ] 排序正确（最新优先）
- [ ] 响应式布局正常

### 文章页 (`/blog/article-slug/`)
- [ ] 显示完整内容（不依赖JS）
- [ ] 标题显示正确
- [ ] 日期显示正确
- [ ] 返回列表按钮正常
- [ ] 回到顶部按钮正常
- [ ] 分享按钮正常
- [ ] 图片正确加载
- [ ] 链接都可点击
- [ ] Meta信息正确

### 兼容性重定向
- [ ] `/blog.html?title=test` 重定向成功
- [ ] 旧URL仍可访问
- [ ] 搜索引擎301重定向

## 错误处理

- [ ] 测试无网络情况
- [ ] 测试错误的URL：`/blog/nonexistent/`
- [ ] 验证404页面显示
- [ ] 测试加载失败重试

## 部署前最后检查

- [ ] 所有测试通过
- [ ] 没有控制台错误
- [ ] 没有网络错误
- [ ] 没有性能警告
- [ ] 代码已提交
- [ ] 分支已合并到main
- [ ] Git tag已创建（可选：v1.0.0-ssr）

## 部署执行

### Vercel部署
```bash
# 将代码推送到GitHub
git push origin main

# Vercel会自动触发部署
# 监控部署进度：https://vercel.com/dashboard

# 验证部署完成
curl https://satinau.cn/blog/
```

### Cloudflare Pages部署
```bash
# 如果使用Wrangler CLI
wrangler pages deploy

# 或通过GitHub自动部署
# 提交代码到连接的分支，CF会自动构建部署
```

## 部署后验证

- [ ] 访问 `https://satinau.cn/blog/` 正常
- [ ] 访问 `https://satinau.cn/blog/article-slug/` 正常
- [ ] 旧URL重定向正常
- [ ] CDN缓存正常工作
- [ ] 没有错误日志
- [ ] Google可正常爬虫
- [ ] 百度可正常爬虫

## 监控和维护

部署后7天：

- [ ] 检查 Google Search Console 索引状态
- [ ] 检查排名变化
- [ ] 监控用户行为（如有Analytics）
- [ ] 检查性能指标
- [ ] 检查错误日志

## 回滚准备

如果出现问题：

- [ ] 准备回滚脚本
- [ ] 确认备份
- [ ] 测试回滚流程
- [ ] 准备通知方案

---

## 签名和时间

| 项目 | 人员 | 日期 |
|------|------|------|
| 改造完成 | | |
| 本地测试完成 | | |
| 部署审批 | | |
| 部署执行 | | |
| 验证完成 | | |

---

**注意：** 在没有完成所有检查前，不应部署到生产环境。
