<div align="center">

<img width="" src="public\缎金SatinAu_logo_v3.5.png"  width=120 height=120  align="center">

# 缎金SatinAu 个人网站

### 一个 HTML+CSS+JavaScript 开发的个人网站

[![GitHub license](https://img.shields.io/github/license/SatinAu-Zelynn/SatinAu-Website-Classic)](LICENSE)

</div>

<p align="center">
<a href="#️-技术栈">技术栈</a> &nbsp;&bull;&nbsp;
<a href="#-兼容性">兼容性</a> &nbsp;&bull;&nbsp;
<a href="#-网站部署">网站部署说明</a> &nbsp;&bull;&nbsp;
<a href="#-本地运行">本地运行</a>
</p>

## 🛠️ 技术栈

- **基础框架**：HTML + CSS + JavaScript
- **组件引用**：
![Static Badge](https://img.shields.io/badge/Markdown%20rendering-marked.js-cyan)
[![Static Badge](https://img.shields.io/badge/Custom%20right%20click%20menu-CRCMenu.v2.js-yellow?logo=github)](https://github.com/add-qwq/Custom-Right-Click-Menu)
[![Static Badge](https://img.shields.io/badge/Image%20viewing-Viewer.js-pink?logo=github)](https://github.com/godShira/Viewerjs)


## 🔄 兼容性

<details>
   <summary>本项目采用现代Web技术构建，包含了Web Platform Baseline 2024和2025的新特性，展开查看兼容性参考表</summary>

| 技术特性 | 所属基准 | 支持的浏览器及版本 |
|---------|---------|-------------------|
| `light-dark()` 颜色函数 | Baseline 2024 | Chrome 111+, Firefox 117+, Safari 16.4+, Edge 111+ |
| `backdrop-filter` 背景模糊 | Baseline 2024 | Chrome 76+, Firefox 103+, Safari 9+, Edge 79+ |
| CSS Grid 网格布局 | Baseline 2024 | Chrome 57+, Firefox 52+, Safari 10.1+, Edge 16+ |
| CSS Subgrid (子网格) | Baseline 2024 | Chrome 108+, Firefox 71+, Safari 16.0+, Edge 108+ |
| 容器查询 (`@container`) | Baseline 2024 | Chrome 105+, Firefox 110+, Safari 16.0+, Edge 105+ |
| `prefers-color-scheme` 媒体查询 | Baseline 2024 | Chrome 76+, Firefox 67+, Safari 12.1+, Edge 79+ |
| 原生CSS变量（自定义属性） | Baseline 2024 | Chrome 49+, Firefox 31+, Safari 9.1+, Edge 15+ |
| 模块类型脚本 (`type="module"`) | Baseline 2024 | Chrome 61+, Firefox 60+, Safari 10.1+, Edge 79+ |
| 动态导入 (`import()`) | Baseline 2024 | Chrome 63+, Firefox 67+, Safari 11.1+, Edge 79+ |
| CSS 嵌套规则 | Baseline 2025 | Chrome 112+, Firefox 110+, Safari 16.5+, Edge 112+ |
| `:has()` 伪类 | Baseline 2025 | Chrome 105+, Firefox 121+, Safari 15.4+, Edge 105+ |
| 滚动驱动动画 (Scroll-driven) | Baseline 2025 | Chrome 115+, Firefox 121+, Safari 17.0+, Edge 115+ |

</details>

> [!TIP]
> 注：项目通过渐进式增强策略确保在旧浏览器中仍能正常运行核心功能，高级视觉效果会根据浏览器支持情况自动降级。


## 🔧 网站部署

本项目使用 `build.sh` 在构建时自动检测部署平台，并生成页面所需的版本信息。

### 1. 构建脚本行为

`build.sh` 会在构建前执行以下逻辑：

- 生成 Sitemap（若检测到 Node.js）
- 检测当前环境是否为 Cloudflare Pages、Vercel，或本地开发环境
- 根据环境变量生成站点版本信息与品牌标识
- 将结果写入 `src/script/config.js`，供前端页面展示

### 2. 部署建议

1. 在 Cloudflare Pages / Vercel 等平台上，使用 `bash build.sh` 作为构建命令。
2. 若项目在本地调试，直接在项目根目录执行：
   ```bash
   bash build.sh
   ```
3. 构建成功后，`src/script/config.js` 会被自动生成或更新，页面中会显示当前部署平台与版本信息。

### QQ 空间最近说说

首页最近动态中的 QQ 空间数据通过 Cloudflare Pages Function 获取，展示说说文字、QQ 表情和附带图片。该功能使用未公开、可能变化的 Qzone 接口，不属于腾讯官方开放 API；接口失效时将停止更新。由于服务端会话可能读取到非公开说说及图片，请确认愿意将返回内容展示给网站访客。

在 Cloudflare Pages 项目的 **Settings → Variables and Secrets** 中添加：

- `QZONE_UIN`：QQ 号码。
- `QZONE_COOKIE`：你自己的 QQ 空间会话 Cookie，作为 **Secret** 保存，不要放入仓库、前端配置或聊天内容。

在 Cloudflare 中创建一个 Workers KV namespace（例如 `qzone-recent-cache`），再到 Pages 项目的 **Settings → Functions → KV namespace bindings** 添加绑定：

- **Variable name**：`QZONE_CACHE`
- **KV namespace**：选择刚创建的 namespace

保存后重新部署。KV 数据在 30 分钟内视为新鲜；缓存过期后有访问时，接口会尝试刷新上游数据。成功结果会写入 KV 并保留 90 天。上游鉴权或网络请求失败后，接口会在 5 分钟内暂缓再次请求；如果 KV 中有旧数据，会返回旧数据并标记为过期，页面副标题会显示缓存数据的更新时间。Cookie 过期仍需维护者手动更新，KV 不会延长 Cookie 有效期。

KV 中的数据可能包含通过会话读取到的说说内容，请将 namespace 作为私有数据管理。未配置 `QZONE_CACHE` 时接口仍会尝试实时获取，但不会有持久缓存，并会在 Function 日志中提示。

不要配置他人账号的 Cookie。


## 🚀 本地运行

1. 克隆仓库：
   ```bash
   git clone https://github.com/SatinAu-Zelynn/SatinAu-Website.git
   ```

2. 进入项目目录，使用Live Server或其他本地服务器软件运行

<div align="right">
<table><td>
<a href="#缎金satinau-个人网站">👆 返回顶部</a>
</td></table>
</div>