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

    // 构建HTML结构
    this.innerHTML = `
      <style>
        .nav-avatar {
          cursor: pointer;
        }
        .more-btn-svg {
          fill: light-dark(#111, #f5f5f5);
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
}

// 定义自定义元素
customElements.define('navigate-bar', NavigateBar);