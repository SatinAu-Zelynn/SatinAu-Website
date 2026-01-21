/*
  src/script/components/GlobalModal.js
  统一弹窗组件 - 缎金SatinAu
*/

class GlobalModal extends HTMLElement {
  constructor() {
    super();
    this.pendingAction = null; // 用于存储弹窗确认后的操作
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
    
    // 动画结束后清空内容，防止下次打开闪烁
    setTimeout(() => {
      this.content.innerHTML = '';
      this.modal.className = 'modal'; // 重置附加类名
    }, 300);
  }

  // ==========================================
  // 模式 1: iOS 风格跳转提示 (替代原 showIosAlert)
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
  // 模式 2: 微信二维码 (替代原 showWeChatQR)
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
  // 模式 3: 邮箱列表 (替代原 showEmailPopup)
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
        <button class="copy-btn" data-email="${email}">复制</button>
      </div>
    `;
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

  // 调用全局 Toast (假设页面上有 <div id="copiedTip">)
  showToast(msg) {
    // 为了兼容旧代码，这里查找全局的 showToast 函数，或者自己实现
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      const tip = document.getElementById("copiedTip");
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