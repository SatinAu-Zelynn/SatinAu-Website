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
    this.pendingAction = null;
    this.audioInstance = null;
    
    // 存储触发动画的源元素
    this.triggerElement = null;
    this.triggerRect = null;
  }

  connectedCallback() {
    this.renderStructure();
    this.bindEvents();
  }

  renderStructure() {
    this.innerHTML = `
      <div class="overlay" id="modalOverlay"></div>
      <div class="modal" id="modalContainer">
        <div id="modalContent" class="modal-content-wrapper"></div>
      </div>
    `;
    this.overlay = this.querySelector('#modalOverlay');
    this.modal = this.querySelector('#modalContainer');
    this.content = this.querySelector('#modalContent');
  }

  bindEvents() {
    this.overlay.addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('show')) {
        this.close();
      }
    });
  }

  // === 核心接口：设置触发源 ===
  // 使用方法：document.getElementById('globalModal').with(this).email()
  with(element) {
    this.triggerElement = element;
    return this; // 返回 this 实现链式调用
  }

  // === 动画核心：显示 ===
  show() {
    // 如果没有触发源，降级为默认淡入动画
    if (!this.triggerElement) {
      requestAnimationFrame(() => {
        this.overlay.classList.add('show');
        this.modal.classList.add('show');
      });
      return;
    }

    // 准备 Hero 动画
    // 记录源元素位置 (First)
    this.triggerRect = this.triggerElement.getBoundingClientRect();
    
    // 临时隐藏源元素 (占位)
    this.triggerElement.style.opacity = '0';
    this.triggerElement.classList.add('hero-hidden'); // 标记类，防止冲突

    // 准备模态框状态
    this.overlay.classList.add('show');
    this.modal.classList.add('hero-animating'); // 添加动画控制类
    
    // 为了计算 Final 状态，先让模态框渲染但不可见
    this.modal.style.visibility = 'hidden';
    this.modal.style.display = 'block';
    this.modal.classList.add('show');

    // 获取模态框最终位置 (Last)
    const modalRect = this.modal.getBoundingClientRect();

    // 计算 Invert (差值)
    // 模态框默认是 translate(-50%, -50%) 居中的
    // 我们需要计算从 center 到 trigger 的偏移量
    
    // 目标中心点
    const modalCenterX = modalRect.left + modalRect.width / 2;
    const modalCenterY = modalRect.top + modalRect.height / 2;
    
    // 源中心点
    const triggerCenterX = this.triggerRect.left + this.triggerRect.width / 2;
    const triggerCenterY = this.triggerRect.top + this.triggerRect.height / 2;

    const deltaX = triggerCenterX - modalCenterX;
    const deltaY = triggerCenterY - modalCenterY;
    const scaleX = this.triggerRect.width / modalRect.width;
    const scaleY = this.triggerRect.height / modalRect.height;

    // 应用初始状态 (Start at Trigger position)
    // 注意：保留原本的 translate(-50%, -50%) 并叠加偏移
    this.modal.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scaleX}, ${scaleY})`;
    this.modal.style.transformOrigin = 'center center'; // 确保缩放中心正确
    this.modal.style.opacity = '1'; // 确保可见（背景色过渡）
    
    // 内容先透明，防止拉伸变形太难看，或者让它随容器淡入
    this.content.style.opacity = '0';
    this.content.style.transition = 'none';

    // Play (执行动画)
    this.modal.style.visibility = 'visible';
    
    // 强制重绘
    void this.modal.offsetHeight;

    // 切换到动画状态
    requestAnimationFrame(() => {
      // 恢复 CSS 定义的 transition
      this.modal.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease, border-radius 0.4s ease';
      this.content.style.transition = 'opacity 0.3s ease 0.15s'; // 内容稍微延迟显示

      // 移动到最终位置
      this.modal.style.transform = 'translate(-50%, -50%) scale(1)';
      this.modal.style.opacity = '1';
      this.content.style.opacity = '1';
    });
  }

  // === 动画核心：关闭 ===
  close() {
    this.pendingAction = null;
    if (this.audioInstance) {
      this.audioInstance.pause();
      this.audioInstance = null;
    }

    // 如果没有触发源，降级为默认关闭 (普通淡出)
    if (!this.triggerElement) {
      this.overlay.classList.remove('show');
      this.modal.classList.remove('show');
      
      // 增加延迟，等待 CSS transition (0.4s) 完成后再清理内容
      // 否则内容会瞬间消失，导致动画看起来像闪退
      setTimeout(() => {
        this.cleanup();
      }, 350); 
      return;
    }

    // 执行反向 Hero 动画
    const modalRect = this.modal.getBoundingClientRect();
    const currentTriggerRect = this.triggerElement.getBoundingClientRect();

    const modalCenterX = modalRect.left + modalRect.width / 2;
    const modalCenterY = modalRect.top + modalRect.height / 2;
    const triggerCenterX = currentTriggerRect.left + currentTriggerRect.width / 2;
    const triggerCenterY = currentTriggerRect.top + currentTriggerRect.height / 2;

    const deltaX = triggerCenterX - modalCenterX;
    const deltaY = triggerCenterY - modalCenterY;
    const scaleX = currentTriggerRect.width / modalRect.width;
    const scaleY = currentTriggerRect.height / modalRect.height;

    this.content.style.opacity = '0'; 
    this.content.style.transition = 'opacity 0.2s ease';
    
    this.modal.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease';
    this.modal.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scaleX}, ${scaleY})`;
    this.modal.style.opacity = '0'; 
    
    this.overlay.classList.remove('show');
    
    setTimeout(() => {
      this.modal.classList.remove('show');
      this.modal.classList.remove('hero-animating');
      
      if (this.triggerElement) {
        this.triggerElement.style.opacity = '';
        this.triggerElement.classList.remove('hero-hidden');
      }
      
      this.cleanup();
    }, 400); 
  }

  // 清理状态
  cleanup() {
    this.triggerElement = null;
    this.triggerRect = null;
    
    this.modal.style.transform = '';
    this.modal.style.transition = '';
    this.modal.style.transformOrigin = '';
    this.modal.style.display = '';
    this.modal.style.visibility = '';
    this.modal.style.opacity = ''; 
    
    this.content.style.opacity = '';
    this.content.style.transition = '';
    
    this.content.innerHTML = '';
    this.modal.className = 'modal'; 
  }

  // ==========================================
  // iOS 风格跳转提示
  // ==========================================
  alert(message, url, appUrl = null) {
    // 存储跳转逻辑
    this.pendingAction = () => {
      if (this.isMobileDevice() && appUrl) {
        this.tryOpenApp(url, appUrl);
      } else {
        window.open(url, "_blank");
        this.close();
      }
    };

    // 设置特定样式类
    this.modal.className = 'modal ios-alert';
    
    // 渲染内容
    this.content.innerHTML = `
      <p>${message}</p>
      <div class="actions">
        <button class="cancel" id="modalCancel">取消</button>
        <button class="confirm" id="modalConfirm">确定</button>
      </div>
    `;

    // 绑定按钮事件
    this.querySelector('#modalCancel').onclick = () => this.close();
    this.querySelector('#modalConfirm').onclick = () => {
      if (this.pendingAction) this.pendingAction();
    };

    this.show();
  }

  // ==========================================
  // 通用确认操作
  // ==========================================
  confirmAction(message, onConfirm, confirmBtnText = '确认') {
    this.modal.className = 'modal ios-alert';
    
    // 使用 pre-line 保留换行符，并设置危险操作的红色按钮
    this.content.innerHTML = `
      <p style="white-space: pre-line;">${message}</p>
      <div class="actions">
        <button class="cancel" id="modalCancel">取消</button>
        <button class="confirm" id="modalConfirm" style="color: #ff3b30; font-weight: 600;">${confirmBtnText}</button>
      </div>
    `;

    this.querySelector('#modalCancel').onclick = () => this.close();
    this.querySelector('#modalConfirm').onclick = () => {
      if (onConfirm) onConfirm();
      this.close();
    };

    this.show();
  }

  // ==========================================
  // 微信二维码
  // ==========================================
  wechat() {
    this.modal.className = 'modal wechat-qr';
    this.content.innerHTML = `
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https://u.wechat.com/MASBAq1qageU9c51LoYg2-Q?s=2" alt="WeChat QR">
      <p>微信扫码加我</p>
    `;
    this.show();
  }

  // ==========================================
  // 邮箱列表
  // ==========================================
  email() {
    this.modal.className = 'modal'; // 使用默认样式
    // 注意：这里复用了 style.css 中的 .email-list 样式
    this.content.innerHTML = `
      <p style="margin-bottom:12px; font-weight:600;">邮箱地址</p>
      <div class="email-list">
        ${this.renderEmailItem('zelynn@satinau.cn')}
        ${this.renderEmailItem('contact@satinau.cn')}
      </div>
      <div class="actions" style="margin-top:16px;">
        <button class="cancel" id="modalClose" style="width:100%">关闭</button>
      </div>
    `;

    // 绑定关闭按钮
    this.querySelector('#modalClose').onclick = () => this.close();
    
    // 绑定复制按钮事件 (使用事件委托或直接绑定)
    this.querySelectorAll('.copy-btn').forEach(btn => {
      btn.onclick = (e) => {
        const email = e.target.dataset.email;
        this.copyToClipboard(email);
      };
    });

    this.show();
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
  // 角色设定文档弹窗
  // ==========================================
  characterDocs(lang = 'zh-cn') {
    // 设置样式类
    this.modal.className = 'modal character-doc-modal';
    
    // 链接映射
    const docUrls = {
      "zh-cn": "https://www.kdocs.cn/l/cbnmJFr498XG",
      "zh-tw": "https://www.kdocs.cn/l/caB01lLIj8q2",
      "en": "https://www.kdocs.cn/l/cjSN22oChlaT"
    };
    const targetUrl = docUrls[lang] || docUrls["zh-cn"];

    // 渲染内容
    this.content.innerHTML = `
      <div class="doc-container">
        <iframe id="docFrame" src="${targetUrl}" title="设定总览" allowfullscreen></iframe>
        
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
    `;

    // 绑定事件
    const modalContainer = this.modal;
    const zoomBtn = this.querySelector('#docZoomBtn');
    const closeBtn = this.querySelector('#docCloseBtn');
    const iconExpand = this.querySelector('#icon-expand');
    const iconCompress = this.querySelector('#icon-compress');

    // 关闭逻辑
    closeBtn.onclick = () => {
      // 如果处于全屏模式，先退出全屏再关闭，动画更自然
      if (modalContainer.classList.contains('fullscreen-mode')) {
        modalContainer.classList.remove('fullscreen-mode');
        // 延迟一点点再执行真正的关闭动画
        setTimeout(() => this.close(), 100);
      } else {
        this.close();
      }
    };

    // 全屏切换逻辑
    zoomBtn.onclick = () => {
      // 切换 class
      const isFullscreen = modalContainer.classList.toggle('fullscreen-mode');
      
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

    // 显示弹窗
    this.show();
  }

  // ==========================================
  // 整点报时
  // ==========================================
  showChime(hour) {
    this.modal.className = 'modal ios-alert chime-modal';
    
    // 格式化时间显示
    const displayHour = hour < 10 ? `0${hour}` : hour;
    
    this.content.innerHTML = `
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
    `;

    // 绑定关闭按钮
    this.querySelector('#modalClose').onclick = () => this.close();

    // 初始化音频
    try {
      this.audioInstance = new Audio('/public/Westminster.ogg');

      this.audioInstance.addEventListener('ended', () => {
        this.close();
      });
      
      this.audioInstance.play().catch(e => {
        console.warn("自动播放被浏览器拦截，用户需先与页面交互:", e);
        this.showToast("未能播放报时音效（需先点击页面）");
      });
    } catch (err) {
      console.error("音频加载失败", err);
    }

    this.show();
  }

  // ==========================================
  // 分享文章卡片
  // ==========================================
  async share(title, excerpt, url, date) {
    this.modal.className = 'modal share-modal'; // 设置特定样式
    
    // 1. 显示加载中
    this.content.innerHTML = `
      <div style="padding: 20px;">
        <div class="ai-loading-spinner" style="margin: 0 auto 10px;"></div>
        <p style="font-size:14px; color:var(--word-color)">正在生成分享卡片...</p>
      </div>
    `;
    this.show();

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
      await new Promise((resolve, reject) => {
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
      this.content.innerHTML = `
        <img src="${imgData}" class="generated-share-img" alt="Share Card">
        <p style="font-size:12px; color:#888; margin-bottom:12px;">长按图片保存或分享</p>
        <div class="share-actions">
          <button id="shareCopyLink" class="confirm" style="background:var(--primary-color); color:#fff; border:none; border-radius:10px; padding:10px; cursor:pointer;">复制链接</button>
          <button id="shareClose" class="cancel" style="background:rgba(128,128,128,0.2); color:var(--word-color); border:none; border-radius:10px; padding:10px; cursor:pointer;">关闭</button>
        </div>
      `;

      // 绑定按钮事件
      this.querySelector('#shareClose').onclick = () => this.close();
      this.querySelector('#shareCopyLink').onclick = () => {
        this.copyToClipboard(fullUrl);
      };

    } catch (err) {
      console.error("生成分享图失败:", err);
      this.content.innerHTML = `<p style="padding:20px;">生成失败，请刷新重试</p>`;
      setTimeout(() => this.close(), 2000);
    } finally {
      // 清理 DOM
      container.remove();
    }
  }

  // === 辅助逻辑 ===
  
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  tryOpenApp(webUrl, appUrl) {
    // 尝试打开APP
    this.showToast("尝试打开APP...");
    window.location.href = appUrl;
    
    // 2秒后如果没反应则跳转网页
    setTimeout(() => {
      window.open(webUrl, "_blank");
      this.close();
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