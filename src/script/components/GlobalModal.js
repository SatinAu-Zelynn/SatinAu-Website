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

class GlobalModal extends HTMLElement {
  constructor() {
    super();
    // 弹窗图层栈：统一管理所有叠加图层
    this.layers = [];
    // 存储触发动画的源元素
    this.pendingTrigger = null;

    // 滚动锁定状态
    this.isScrollLocked = false;
  }

  connectedCallback() {
    this.innerHTML = '';
    this.bindEvents();
  }

  renderStructure() {}

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      // 按 Escape 键时，统一关闭当前最顶层图层
      if (e.key === 'Escape' && this.layers.length > 0) {
        this.layers[this.layers.length - 1].close();
      }
    });
  }

  // === 内部辅助：锁定/解锁页面滚动 ===
  _lockScroll() {
    // 避免重复锁定
    if (this.isScrollLocked) return;

    // 计算滚动条宽度 (窗口总宽 - 视口宽)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // 补偿页面抖动：给 body 添加右内边距
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.documentElement.style.setProperty('--scrollbar-compensate', `${scrollbarWidth}px`);
    }
    
    // 同时锁定 html 和 body
    // 只锁定 body 在部分浏览器/CSS重置下无效
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    
    // 移动端防止滚动穿透 (Overscroll Behavior)
    document.body.style.overscrollBehavior = 'none';

    this.isScrollLocked = true;
  }

  _unlockScroll() {
    if (!this.isScrollLocked) return;

    // 恢复样式：清空设置，让其回退到 CSS 文件中的默认值
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.body.style.overscrollBehavior = '';
    document.documentElement.style.removeProperty('--scrollbar-compensate');
    
    this.isScrollLocked = false;
  }

  // === 核心接口：设置触发源 ===
  // 使用方法：document.getElementById('globalModal').with(this).email()
  with(element) {
    this.pendingTrigger = element;
    // 防止链式调用异常中断导致触发源残留到下一次无关弹窗
    setTimeout(() => {
      if (this.pendingTrigger === element) {
        this.pendingTrigger = null;
      }
    }, 0);
    return this; // 返回 this 实现链式调用
  }

  // ==========================================
  // 统一底层引擎：开启独立弹窗图层
  // ==========================================
  open({ className = 'modal', content = '', onMount = null }) {
    const trigger = this.pendingTrigger;
    this.pendingTrigger = null; // 消费触发源

    // 计算当前层级 z-index，保证新弹窗始终覆盖在旧弹窗上方
    const baseZ = 9980 + this.layers.length * 10;

    // 1. 构建独立图层 DOM
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = baseZ;

    const modal = document.createElement('div');
    modal.className = className;
    modal.style.zIndex = baseZ + 1;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'modal-content-wrapper';
    if (typeof content === 'string') {
      contentWrapper.innerHTML = content;
    } else if (content instanceof Node) {
      contentWrapper.appendChild(content);
    }
    modal.appendChild(contentWrapper);

    this.appendChild(overlay);
    this.appendChild(modal);

    let cleanupTimer = null;
    let audioInstance = null;

    // 2. 清理状态并从 DOM 中移除图层
    const destroyLayer = () => {
      overlay.remove();
      modal.remove();
      this.layers = this.layers.filter(l => l !== layer);
      // 当所有弹窗全部关闭后，恢复页面滚动
      if (this.layers.length === 0) {
        this._unlockScroll();
      }
    };

    // 3. 统一动画核心：关闭
    const closeLayer = () => {
      // 避免重复触发退出动画
      if (layer.isClosing) return;
      layer.isClosing = true;

      if (audioInstance) {
        audioInstance.pause();
        audioInstance = null;
      }

      // 清除可能存在的旧定时器
      if (cleanupTimer) clearTimeout(cleanupTimer);

      // 如果没有触发源，降级为默认关闭 (普通淡出)
      if (!trigger) {
        overlay.classList.remove('show');
        modal.classList.remove('show');
        
        // 等待 CSS transition (0.4s) 完成后再清理
        cleanupTimer = setTimeout(destroyLayer, 350);
        return;
      }

      // 执行反向 Hero 动画
      const modalRect = modal.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const deltaX = (triggerRect.left + triggerRect.width / 2) - (modalRect.left + modalRect.width / 2);
      const deltaY = (triggerRect.top + triggerRect.height / 2) - (modalRect.top + modalRect.height / 2);
      const scaleX = triggerRect.width / modalRect.width;
      const scaleY = triggerRect.height / modalRect.height;

      contentWrapper.style.opacity = '0';
      contentWrapper.style.transition = 'opacity 0.2s ease';
      modal.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease';
      modal.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scaleX}, ${scaleY})`;
      modal.style.opacity = '0';
      overlay.classList.remove('show');

      cleanupTimer = setTimeout(() => {
        trigger.style.opacity = '';
        trigger.classList.remove('hero-hidden');
        destroyLayer();
      }, 400);
    };

    overlay.addEventListener('click', closeLayer);

    const layer = {
      overlay,
      modal,
      content: contentWrapper,
      close: closeLayer,
      isClosing: false,
      setAudio: (audio) => { audioInstance = audio; }
    };

    this.layers.push(layer);
    
    // 锁定页面滚动
    this._lockScroll();

    // 4. 统一动画核心：显示
    // 如果没有触发源，降级为默认淡入动画
    if (!trigger) {
      requestAnimationFrame(() => {
        overlay.classList.add('show');
        modal.classList.add('show');
      });
    } else {
      // 准备 Hero 动画
      // 记录源元素位置 (First)
      const triggerRect = trigger.getBoundingClientRect();
      
      // 临时隐藏源元素 (占位)
      trigger.style.opacity = '0';
      trigger.classList.add('hero-hidden'); // 标记类，防止冲突

      // 准备模态框状态
      overlay.classList.add('show');
      modal.classList.add('hero-animating', 'show'); // 添加动画控制类
      
      // 为了计算 Final 状态，先让模态框渲染但不可见
      modal.style.visibility = 'hidden';
      modal.style.display = 'block';

      // 获取模态框最终位置 (Last)
      const modalRect = modal.getBoundingClientRect();
      
      // 计算 Invert (差值)
      const deltaX = (triggerRect.left + triggerRect.width / 2) - (modalRect.left + modalRect.width / 2);
      const deltaY = (triggerRect.top + triggerRect.height / 2) - (modalRect.top + modalRect.height / 2);
      const scaleX = triggerRect.width / modalRect.width;
      const scaleY = triggerRect.height / modalRect.height;

      // 应用初始状态 (Start at Trigger position)
      modal.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scaleX}, ${scaleY})`;
      modal.style.transformOrigin = 'center center'; // 确保缩放中心正确
      modal.style.opacity = '1'; // 确保可见（背景色过渡）
      
      // 内容先透明，防止拉伸变形太难看
      contentWrapper.style.opacity = '0';
      contentWrapper.style.transition = 'none';

      // Play (执行动画)
      modal.style.visibility = 'visible';

      // 强制重绘
      void modal.offsetHeight;

      // 切换到动画状态
      requestAnimationFrame(() => {
        // 恢复 CSS 定义的 transition
        modal.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease, border-radius 0.4s ease';
        contentWrapper.style.transition = 'opacity 0.3s ease 0.15s'; // 内容稍微延迟显示

        // 移动到最终位置
        modal.style.transform = 'translate(-50%, -50%) scale(1)';
        modal.style.opacity = '1';
        contentWrapper.style.opacity = '1';
      });
    }

    if (typeof onMount === 'function') {
      onMount(layer);
    }

    return layer;
  }

  // 关闭当前最顶层未处于关闭中的弹窗
  close() {
    const activeLayer = [...this.layers].reverse().find(l => !l.isClosing);
    if (activeLayer) {
      activeLayer.close();
    }
  }

  // ==========================================
  // iOS 风格跳转提示
  // ==========================================
  alert(message, url, appUrl = null) {
    this.open({
      className: 'modal ios-alert',
      // 渲染内容
      content: `
        <p>${message}</p>
        <div class="actions">
          <button class="cancel" id="modalCancel">取消</button>
          <button class="confirm" id="modalConfirm">确定</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        // 绑定按钮事件
        modal.querySelector('#modalCancel').onclick = close;
        modal.querySelector('#modalConfirm').onclick = () => {
          // 存储跳转逻辑
          if (this.isMobileDevice() && appUrl) {
            this.tryOpenApp(url, appUrl, close);
          } else {
            window.open(url, "_blank");
            close();
          }
        };
      }
    });
  }

  // ==========================================
  // 通用确认操作
  // ==========================================
  confirmAction(message, onConfirm, confirmBtnText = '确认') {
    this.open({
      className: 'modal ios-alert',
      // 使用 pre-line 保留换行符，并设置危险操作的红色按钮
      content: `
        <p style="white-space: pre-line;">${message}</p>
        <div class="actions">
          <button class="cancel" id="modalCancel">取消</button>
          <button class="confirm" id="modalConfirm" style="color: #ff3b30; font-weight: 600;">${confirmBtnText}</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        // 绑定按钮事件
        modal.querySelector('#modalCancel').onclick = close;
        modal.querySelector('#modalConfirm').onclick = () => {
          if (onConfirm) onConfirm();
          close();
        };
      }
    });
  }

  // ==========================================
  // 微信二维码
  // ==========================================
  wechat() {
    this.open({
      className: 'modal wechat-qr',
      content: `
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https://u.wechat.com/MASBAq1qageU9c51LoYg2-Q?s=2" alt="WeChat QR">
        <p>微信扫码加我</p>
      `
    });
  }

  // ==========================================
  // 邮箱列表
  // ==========================================
  email() {
    this.open({
      className: 'modal', // 使用默认样式
      // 注意：这里复用了 style.css 中的 .email-list 样式
      content: `
        <p style="margin-bottom:12px; font-weight:600;">邮箱地址</p>
        <div class="email-list">
          ${this.renderEmailItem('zelynn@satinau.cn')}
          ${this.renderEmailItem('contact@satinau.cn')}
        </div>
        <div class="actions" style="margin-top:16px;">
          <button class="cancel" id="modalClose" style="width:100%">关闭</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        // 绑定关闭按钮
        modal.querySelector('#modalClose').onclick = close;
        
        // 绑定复制按钮事件 (使用事件委托或直接绑定)
        modal.querySelectorAll('.copy-btn').forEach(btn => {
          btn.onclick = (e) => this.copyToClipboard(e.target.dataset.email);
        });
      }
    });
  }

  renderEmailItem(email) {
    return `
      <div class="email-item">
        <span>${email}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <a href="mailto:${email}" style="font-size: 14px; text-decoration: none; color: inherit; opacity: 0.8;">打开</a>
          <button class="copy-btn" data-email="${email}">复制</button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // 通用网页/Iframe 弹窗
  // ==========================================
  openWeb(url) {
    this.open({
      className: 'modal web-modal',
      // 渲染内容
      content: `
        <div class="doc-container">
          <div class="loading-overlay show" id="webLoadingOverlay">
            <div class="spinner"></div>
          </div>
          <iframe id="webFrame" src="${url}" title="Web Content" allowfullscreen></iframe>
          <div class="doc-controls">
            <!-- 全屏切换按钮 -->
            <button id="docZoomBtn" class="doc-float-btn" title="全屏查看 / Fullscreen">
              <svg id="icon-expand" viewBox="0 0 24 24"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/></svg>
              <svg id="icon-compress" viewBox="0 0 24 24" style="display: none;"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5z"/></svg>
            </button>
            
            <!-- 关闭按钮 -->
            <button id="docCloseBtn" class="doc-float-btn close-btn" title="关闭 / Close">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
      `,
      onMount: ({ modal, close }) => {
        // 绑定事件
        const zoomBtn = modal.querySelector('#docZoomBtn');
        const closeBtn = modal.querySelector('#docCloseBtn');
        const iconExpand = modal.querySelector('#icon-expand');
        const iconCompress = modal.querySelector('#icon-compress');
        const webFrame = modal.querySelector('#webFrame');
        const loadingOverlay = modal.querySelector('#webLoadingOverlay');

        // 监听 iframe 加载完成
        if (webFrame && loadingOverlay) {
          webFrame.addEventListener('load', () => {
            loadingOverlay.classList.remove('show');
            setTimeout(() => loadingOverlay.remove(), 300);
          });
        }

        // 关闭逻辑
        closeBtn.onclick = () => {
          // 如果处于全屏模式，先退出全屏再关闭，动画更自然
          if (modal.classList.contains('fullscreen-mode')) {
            modal.classList.remove('fullscreen-mode');
            // 延迟一点点再执行真正的关闭动画
            setTimeout(close, 100);
          } else {
            close();
          }
        };

        // 全屏切换逻辑
        zoomBtn.onclick = () => {
          // 切换 class
          const isFullscreen = modal.classList.toggle('fullscreen-mode');
          
          // 切换图标
          if (isFullscreen) {
            iconExpand.style.display = 'none';
            iconCompress.style.display = 'block';
            zoomBtn.title = "退出全屏 / Exit Fullscreen";
          } else {
            iconExpand.style.display = 'block';
            iconCompress.style.display = 'none';
            zoomBtn.title = "全屏查看 / Fullscreen";
          }
        };
      }
    });
  }

  // ==========================================
  // 网站设置大型浮窗
  // ==========================================
  showSettings(anchorId = null) {
    // 检查当前是否已打开设置弹窗，若已存在则直接滚动到目标锚点，避免新建图层
    const existingLayer = this.layers.find(l => l.modal.classList.contains('settings-modal'));
    if (existingLayer) {
      if (anchorId) {
        const target = existingLayer.modal.querySelector(`#${anchorId}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.transition = 'box-shadow 0.3s ease';
          target.style.boxShadow = '0 0 0 2px var(--primary-color)';
          setTimeout(() => { target.style.boxShadow = ''; }, 1500);
        }
      }
      return;
    }

    this.open({
      className: 'modal settings-modal',
      onMount: (layer) => {
        const context = {
          modal: layer.modal,
          content: layer.content,
          close: layer.close,
          show: () => {
            layer.modal.classList.add('show');
          },
          querySelector: (s) => layer.modal.querySelector(s),
          querySelectorAll: (s) => layer.modal.querySelectorAll(s),
          openWeb: (url) => this.openWeb(url),
          showToast: (msg) => this.showToast(msg),
          confirmAction: (msg, onConfirm, text) => this.confirmAction(msg, onConfirm, text),
          with: (el) => this.with(el)
        };

        const mount = () => window.mountSettingsToModal(context, anchorId);

        if (typeof window.mountSettingsToModal === 'function') {
          mount();
          return;
        }

        const scriptId = 'settings-modal-script';
        let script = document.getElementById(scriptId);
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.src = '/src/script/components/SettingsModal.js';
          script.onload = mount;
          script.onerror = () => {
            layer.content.innerHTML = `<p style="padding:20px;">设置组件加载失败，请检查网络</p>`;
            setTimeout(layer.close, 2000);
          };
          document.head.appendChild(script);
        } else {
          script.addEventListener('load', mount, { once: true });
        }
      }
    });
  }

  // ==========================================
  // 壁纸弹窗
  // ==========================================
  showWallpaper() {
    this.open({
      className: 'modal ios-alert',
      content: `
        <div style="padding: 10px 0;">
          <h2 style="margin: 0 0 10px; font-size: 20px; opacity: 1">壁纸</h2>
          <p style="font-size: 15px; color: var(--word-color); opacity: 0.8; margin-bottom: 0;">敬请期待</p>
        </div>
        <div class="actions">
          <button class="cancel" id="modalClose">关闭</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        modal.querySelector('#modalClose').onclick = close;
      }
    });
  }

  // ==========================================
  // 装扮弹窗
  // ==========================================
  showDecoration() {
    this.open({
      className: 'modal ios-alert',
      content: `
        <div style="padding: 10px 0;">
          <h2 style="margin: 0 0 15px; font-size: 20px; opacity: 1">装扮</h2>
          <a href="https://club.vip.qq.com/openKuikly/vas_gxh_dress_detail?open_kuikly_info=%7B%22bundle_name%22%3A%22vas_gxh_dress_detail%22%7D&qqmc_config=vas_kuikly_config&page_name=vas_gxh_dress_detail&from=share&kr_turbo_display=2_2144217&app_id=2&item_id=2144217" target="_blank" style="display: block; margin-bottom: 10px;">
            <img src="/public/qqbubble.png" alt="QQ气泡" style="width: 100%; border-radius: var(--border-radius-md); box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: transform 0.2s ease; background: light-dark(#f5f5f5, #111);" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
          </a>
          <p style="font-size: 15px; color: var(--word-color); opacity: 0.8; margin: 0;">敬请期待</p>
        </div>
        <div class="actions">
          <button class="cancel" id="modalClose">关闭</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        modal.querySelector('#modalClose').onclick = close;
      }
    });
  }

  // ==========================================
  // 整点报时
  // ==========================================
  showChime(hour) {
    // 格式化时间显示
    const displayHour = hour < 10 ? `0${hour}` : hour;

    this.open({
      className: 'modal ios-alert chime-modal',
      content: `
        <div style="padding: 10px 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">🕰️</div>
          <h2 style="margin: 0 0 10px; font-size: 24px;">整点报时</h2>
          <p style="font-size: 18px; font-weight: bold; color: var(--primary-color);">
            现在是 ${displayHour}:00
          </p>
          <p style="font-size: 14px; opacity: 0.7; margin-top:10px;">Westminster Quarters</p>
        </div>
        <div class="actions">
          <button class="cancel" id="modalClose">关闭</button>
        </div>
      `,
      onMount: ({ modal, close, setAudio }) => {
        // 绑定关闭按钮
        modal.querySelector('#modalClose').onclick = close;
        
        // 初始化音频
        try {
          const audio = new Audio('/public/Westminster.ogg');
          setAudio(audio);
          audio.addEventListener('ended', close);
          audio.play().catch(e => {
            console.warn("自动播放被浏览器拦截，用户需先与页面交互:", e);
            this.showToast("未能播放报时音效（需先点击页面）");
          });
        } catch (err) {
          console.error("音频加载失败", err);
        }
      }
    });
  }

  // ==========================================
  // 分享文章卡片
  // ==========================================
  async share(title, excerpt, url, date) {
    // 1. 显示加载中
    const layer = this.open({
      className: 'modal share-modal', // 设置特定样式
      content: `
        <div style="padding: 20px;">
          <div class="ai-loading-spinner" style="margin: 0 auto 10px;"></div>
          <p style="font-size:14px; color:var(--word-color)">正在生成分享卡片...</p>
        </div>
      `
    });

    // 2. 创建用于生成的 DOM 结构
    // 移除旧的容器（如果存在）
    const oldContainer = document.getElementById('share-card-container');
    if (oldContainer) oldContainer.remove();

    const container = document.createElement('div');
    container.id = 'share-card-container';
    
    // 截取摘要，限制字数
    const cleanExcerpt = excerpt.replace(/[\r\n]/g, '').substring(0, 120) + '...';
    // 确保 URL 是绝对路径
    const fullUrl = url.startsWith('http') ? url : window.location.origin + url;
    // 二维码 API (使用 cors 代理或支持 cors 的 api)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullUrl)}`;

    container.innerHTML = `
      <div class="share-card-title">${title}</div>
      <div class="share-card-date">${date}</div>
      <div class="share-card-excerpt">${cleanExcerpt}</div>
      <div class="share-card-footer">
        <div class="share-info">
          <span class="share-site-name">缎金SatinAu</span>
          <span class="share-site-url">satinau.cn</span>
        </div>
        <div class="share-qr">
          <img src="${qrUrl}" crossOrigin="anonymous" alt="QR">
        </div>
      </div>
    `;
    document.body.appendChild(container);

    try {
      // 3. 等待二维码图片加载完成
      const qrImg = container.querySelector('.share-qr img');
      await new Promise((resolve) => {
        if (qrImg.complete) resolve();
        else {
          qrImg.onload = resolve;
          qrImg.onerror = () => resolve(); // 即使失败也继续生成
        }
      });

      // 4. 使用 html2canvas 生成图片
      if (!window.html2canvas) throw new Error("组件未加载");

      const canvas = await html2canvas(container, {
        useCORS: true, // 允许跨域图片
        scale: 2, // 高清
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.9);

      // 5. 更新弹窗内容
      layer.content.innerHTML = `
        <img src="${imgData}" class="generated-share-img" alt="Share Card">
        <p style="font-size:12px; color:#888; margin-bottom:12px;">长按图片保存或分享</p>
        <div class="share-actions">
          <button id="shareCopyLink" class="confirm" style="background:var(--primary-color); color:#fff; border:none; border-radius:10px; padding:10px; cursor:pointer;">复制链接</button>
          <button id="shareClose" class="cancel" style="background:rgba(128,128,128,0.2); color:var(--word-color); border:none; border-radius:10px; padding:10px; cursor:pointer;">关闭</button>
        </div>
      `;

      // 绑定按钮事件
      layer.modal.querySelector('#shareClose').onclick = layer.close;
      layer.modal.querySelector('#shareCopyLink').onclick = () => {
        this.copyToClipboard(fullUrl);
      };

    } catch (err) {
      console.error("生成分享图失败:", err);
      layer.content.innerHTML = `<p style="padding:20px;">生成失败，请刷新重试</p>`;
      setTimeout(layer.close, 2000);
    } finally {
      // 清理 DOM
      container.remove();
    }
  }

  // === 辅助逻辑 ===
  
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  tryOpenApp(webUrl, appUrl, closeCallback = null) {
    // 尝试打开APP
    this.showToast("尝试打开APP...");
    window.location.href = appUrl;
    
    // 2秒后如果没反应则跳转网页
    setTimeout(() => {
      window.open(webUrl, "_blank");
      if (typeof closeCallback === 'function') {
        closeCallback();
      } else {
        this.close();
      }
    }, 2000);
  }

  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast("📋 已复制: " + text);
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      this.showToast("📋 已复制: " + text);
    } catch (err) {
      alert("复制失败，请手动复制");
    }
    document.body.removeChild(input);
  }

  // 调用全局 Toast (假设页面上有 <div id="toast">)
  showToast(msg) {
    // 为了兼容旧代码，这里查找全局的 showToast 函数，或者自己实现
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      const tip = document.getElementById("toast");
      if (tip) {
        tip.textContent = msg;
        tip.classList.add("show");
        setTimeout(() => tip.classList.add("done"), 250);
        setTimeout(() => tip.classList.remove("show", "done"), 1800);
      }
    }
  }
}

customElements.define('global-modal', GlobalModal);