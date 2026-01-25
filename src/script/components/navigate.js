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

class NavigateBar extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    let filename = window.location.pathname.split('/').pop();
    let currentPath;

    // 移除可能的 .html 扩展名，得到用于匹配的基础路径名
    if (filename.endsWith('.html')) {
        currentPath = filename.slice(0, -5); // 移除 '.html'
    } else {
        currentPath = filename; // 如果没有 .html，直接使用文件名
    }

    if (currentPath === '' || currentPath.toLowerCase() === 'index.html') {
        currentPath = 'index';
    }
    
    // 主导航项数据
    const navItems = [
      { cn: '缎金', en: 'SatinAu', href: 'index' },
      { cn: '博客', en: 'Blog', href: 'blog' },
      { cn: '泽凌', en: 'Zelynn', href: 'zelynn' }
    ];

    // 更多选项菜单数据
    const moreItems = [
      { label: '动态', href: 'moments' },
      { label: '关于我', href: 'aboutme' },
      { label: '友情链接', href: 'friendlink' },
      { label: '歌单分享', href: 'playlist' },
      { label: '网站设置', href: 'settings' }
    ];

    // --- 用户信息逻辑 ---
    const token = localStorage.getItem('auth_token');
    const userInfoRaw = localStorage.getItem('user_info');
    let userHtml = '';

    // 判断是否登录并生成对应HTML
    if (token && userInfoRaw) {
        try {
            const user = JSON.parse(userInfoRaw);
            const avatarUrl = user.avatar || '/public/guest.png';
            userHtml = `
              <div class="nav-user-card" onclick="window.location.href='/pages/account/index.html'">
                <img src="${avatarUrl}" class="nav-user-avatar-small" alt="Avatar">
                <div class="nav-user-info">
                  <span class="nav-user-name">${user.nickname}</span>
                  <span class="nav-user-status">个人中心</span>
                </div>
              </div>
            `;
        } catch (e) {
            // 解析失败回退到登录
            userHtml = this.getLoginHtml();
        }
    } else {
        userHtml = this.getLoginHtml();
    }

    // 构建HTML结构
    this.innerHTML = `
      <style>
        .nav-avatar {
          cursor: pointer;
        }
        .more-btn-svg {
          fill: light-dark(#111, #f5f5f5);
        }
        
        /* --- 分体式菜单分割线 --- */
        .nav-separator {
          height: 1px;
          background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.1));
          margin: 8px 12px;
        }

        /* --- 用户卡片区域 --- */
        .nav-user-card {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          margin: 4px 8px 8px 8px; /* 底部留点空隙 */
          border-radius: var(--border-radius-md, 8px);
          cursor: pointer;
          transition: background 0.2s;
          text-decoration: none;
          color: inherit;
        }
        
        .nav-user-card:hover {
          background: light-dark(rgba(0,0,0,0.05), rgba(255,255,255,0.1));
        }

        .nav-user-avatar-small {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          margin-right: 12px;
          object-fit: cover;
          border: 1px solid light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.2));
        }

        .nav-user-info {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .nav-user-name {
          font-weight: 600;
          font-size: 14px;
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-user-status {
          font-size: 11px;
          opacity: 0.6;
        }

        /* 未登录时的样式调整 */
        .nav-login-btn {
          justify-content: center;
          font-weight: 600;
          color: var(--primary-color, #007aff);
        }
      </style>

      <nav class="bottom-nav">
        <div class="nav-avatar" onclick="window.location.href='/'">
          <img src="/public/favicon.ico" alt="Avatar">
        </div>
        ${navItems.map(item => `
          <a 
            href="/${item.href}.html" 
            class="${currentPath === item.href ? 'active' : ''}"
          >
            <span class="nav-cn">${item.cn}</span>
            <span class="nav-en">${item.en}</span>
          </a>
        `).join('')}
        <div class="more-menu-container">
          <button class="more-btn" onclick="toggleMoreMenu()">
            <svg class="more-btn-svg" viewBox="0 0 24 24" width="24" height="24">
              <circle cx="6" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="18" cy="12" r="2" />
            </svg>
          </button>
          <div class="more-dropdown">
            ${moreItems.map(item => {
              // 更多菜单项的激活逻辑，获取其基础文件名进行匹配
              const moreItemBaseName = item.href.split('/').pop().replace('.html', '');
              const isActive = currentPath === moreItemBaseName;
              
              return `
              <a 
                href="/pages/${item.href}.html" 
                class="dropdown-item ${isActive ? 'active' : ''}"
                onclick="window.location.href=href; return false;"
                ${item.target ? `target="${item.target}"` : ''}
              >
                ${item.label}
              </a>
            `;}).join('')}

            <!-- 分体式菜单：分割线 -->
            <div class="nav-separator"></div>

            <!-- 分体式菜单：用户区域 -->
            ${userHtml}
          </div>
        </div>
      </nav>
    `;
    // 初始化滚动监听
    let lastScrollY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
      // 检查自动隐藏开关是否开启
      const isAutohide = localStorage.getItem('setting_autohide_nav_enabled') === 'true';
      if (!isAutohide) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const nav = this.querySelector('.bottom-nav');
          if (!nav) return;

          const currentScrollY = window.scrollY;
          
          // 1. 向下滚动：隐藏
          if (currentScrollY > lastScrollY && currentScrollY > 50) {
            nav.classList.add('nav-hidden');
            // 顺便关闭可能打开的移动端菜单
            const mobileMenu = document.querySelector('.mobile-more-menu');
            if (mobileMenu && mobileMenu.classList.contains('show')) {
              mobileMenu.classList.remove('show');
              nav.classList.remove('menu-open');
            }
          } 
          // 2. 向上滚动：显示
          else if (currentScrollY < lastScrollY) {
            nav.classList.remove('nav-hidden');
          }
          
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
  
  // 辅助方法：生成未登录HTML
  getLoginHtml() {
    return `
      <div class="nav-user-card nav-login-btn" onclick="window.location.href='/pages/account/login.html'">
        <span>登录 / 注册</span>
      </div>
    `;
  }
}

// 定义自定义元素
customElements.define('navigate-bar', NavigateBar);