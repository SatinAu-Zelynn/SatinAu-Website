/*
  src/script/components/GlobalModal.js
  统一弹窗组件 - 缎金SatinAu
*/

class GlobalModal extends HTMLElement {
  constructor() {
    super();
    this.pendingAction = null; // 用于存储弹窗确认后的操作
    this.audioInstance = null; // 用于存储音频实例
  }

  connectedCallback() {
    this.renderStructure();
    this.bindEvents();
  }

  // 1. 渲染基础骨架 (遮罩 + 容器)
  renderStructure() {
    this.innerHTML = `
      <div class="overlay" id="modalOverlay"></div>
      <div class="modal" id="modalContainer">
        <div id="modalContent"></div>
      </div>
    `;
    this.overlay = this.querySelector('#modalOverlay');
    this.modal = this.querySelector('#modalContainer');
    this.content = this.querySelector('#modalContent');
  }

  // 2. 绑定基础关闭事件
  bindEvents() {
    // 点击遮罩关闭
    this.overlay.addEventListener('click', () => this.close());
    
    // 监听 ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('show')) {
        this.close();
      }
    });
  }

  // === 通用方法：显示/隐藏 ===
  show() {
    // 强制重绘以触发动画
    requestAnimationFrame(() => {
      this.overlay.classList.add('show');
      this.modal.classList.add('show');
    });
  }

  close() {
    this.overlay.classList.remove('show');
    this.modal.classList.remove('show');
    this.pendingAction = null;

    // 如果有正在播放的音频，停止并销毁
    if (this.audioInstance) {
      this.audioInstance.pause();
      this.audioInstance.currentTime = 0;
      this.audioInstance = null;
    }
    
    // 动画结束后清空内容，防止下次打开闪烁
    setTimeout(() => {
      this.content.innerHTML = '';
      this.modal.className = 'modal'; // 重置附加类名
    }, 300);
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