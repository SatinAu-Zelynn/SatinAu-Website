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

/* ========== 公用逻辑 ========== */

// 页面加载完成后设置当前年份（优先使用网络时间）
document.addEventListener('DOMContentLoaded', function() {
  const yearElement = document.getElementById('current-year');
  if (!yearElement) return;

  // 1. 默认先显示本地时间作为占位（防止网络请求期间空白）
  const localYear = new Date().getFullYear();
  yearElement.textContent = localYear;

  // 2. 异步请求当前页面的头部信息以获取服务器时间
  fetch(window.location.href, { method: 'HEAD', cache: 'no-cache' })
    .then(response => {
      // 获取 HTTP Date 头 (格式如: Fri, 16 Jan 2026 10:00:00 GMT)
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const serverDate = new Date(dateHeader);
        const serverYear = serverDate.getFullYear();
        
        // 如果服务器年份与本地不同，或者为了确保精准，更新界面
        if (!isNaN(serverYear) && serverYear !== localYear) {
          yearElement.textContent = serverYear;
          console.log(`%c已校准为服务器时间: ${serverYear}`, "color: #00FFCC;");
        }
      }
    })
    .catch(err => {
      // 如果请求失败（如断网），保持本地时间显示，并在控制台静默失败
      console.warn('无法获取网络时间，保持本地系统时间显示。', err);
    });
});

/* 通用工具函数 */
function toggleModal(id, show = true) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("show", show);
}

function showToast(msg) {
  const tip = document.getElementById("copiedTip");
  if (!tip) return;
  tip.textContent = msg;
  tip.classList.add("show");
  setTimeout(() => tip.classList.add("done"), 250);
  setTimeout(() => { tip.classList.remove("show", "done"); }, 1800);
}

/* 页面加载动画 & 卡片入场 */
window.addEventListener('DOMContentLoaded', function() {
  // 优先显示页面UI
  document.body.style.opacity = 1;
  
  // 页面进入动画（目标是 .page 而不是 body）
  const PAGE = document.querySelector('.page') || document.body;
  const from = sessionStorage.getItem("from");
  if (from === "index") {
    PAGE.classList.add("slide-in-right");
  } else if (from === "zelynn") {
    PAGE.classList.add("slide-in-left");
  }
  sessionStorage.removeItem("from");

  // 处理卡片入场动画
  document.querySelectorAll('.contact-card, h2').forEach((element, index) => {
    if (document.body.id !== "blog-page") {
      new IntersectionObserver((entries, observer) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            // 区分元素类型设置延迟
            const delay = element.tagName === 'H2' 
              ? `${0.2 + Math.floor(index / 2) * 0.2}s`  // H2延迟稍缓
              : `${0.2 + index * 0.2}s`;  // 卡片保持原有延迟
              
            e.target.style.animationDelay = delay;
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      }, { threshold: 0.2, rootMargin: '0px 0px -100px 0px' }).observe(element);
    }
  });

  // 延迟加载需要后端数据的内容
  setTimeout(() => {
    document.body.style.width = '100%';
    window.dispatchEvent(new Event('resize'));
    if (document.body.id === "blog-page") {
      // 显示加载动画
      const loader = document.getElementById("loadingOverlay");
      if (loader) {
        loader.classList.add("show");
      }
      initBlog(); // 博客数据加载
    }
  }, 100); // 给UI渲染留一点时间
});

/* ===================== Unified 3-page left/right transitions ===================== */
(function(){
  var ORDER = ["index","blog","zelynn"];

  function pageIdFromHref(href){
    if(!href) return null;
    var name = href.split("?")[0].split("#")[0].split("/").pop();
    if (name.indexOf("zelynn")>-1) return "zelynn";
    if (name.indexOf("blog")>-1) return "blog";
    if (name.indexOf("index")>-1) return "index";
    return null;
  }
  function currentId(){
    var id = (document.body && document.body.id) || "";
    return id.replace("-page","") || "index";
  }
  function clearAnims(el){
    ["slide-in-right","slide-in-left","slide-out-right","slide-out-left"].forEach(function(c){ el.classList.remove(c); });
  }
  function animateEnter(){
    try{
      var from = sessionStorage.getItem("from");
      if(!from) return;
      var to = currentId();
      var fromIdx = ORDER.indexOf(from);
      var toIdx = ORDER.indexOf(to);
      var page = document.querySelector(".page") || document.body;
      clearAnims(page);
      if (fromIdx>-1 && toIdx>-1){
        page.classList.add(toIdx>fromIdx ? "slide-in-right" : "slide-in-left");
        page.addEventListener("animationend", function handler(){ page.classList.remove("slide-in-right","slide-in-left"); page.removeEventListener("animationend", handler); }, { once:true });
      }
      sessionStorage.removeItem("from");
    }catch(e){}
  }
  function animateExit(toId, href){
    var cur = currentId();
    var page = document.querySelector(".page") || document.body;
    clearAnims(page);
    var curIdx = ORDER.indexOf(cur);
    var toIdx = ORDER.indexOf(toId);
    var dirClass = (toIdx>curIdx) ? "slide-out-left" : "slide-out-right";
    page.classList.add(dirClass);
    var navigated = false;
    var go = function(){ if(navigated) return; navigated = true; window.location.href = href; };
    page.addEventListener("animationend", go, { once:true });
    setTimeout(go, 480);
    try{ sessionStorage.setItem("from", cur); }catch(e){}
  }

  function interceptNav(){
    var links = document.querySelectorAll('.bottom-nav a[href$=".html"]');
    links.forEach(function(a){
      a.addEventListener("click", function(e){
        var href = a.getAttribute("href");
        var toId = pageIdFromHref(href);
        if(!toId) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        animateExit(toId, href);
      }, true);
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){
      interceptNav();
      animateEnter();
    });
  } else {
    interceptNav();
    animateEnter();
  }
})();

// 更多菜单控制
let moreMenuVisible = false;

function toggleMoreMenu() {
  const dropdown = document.querySelector('.more-dropdown');
  if (dropdown) {
    moreMenuVisible = !moreMenuVisible;
    dropdown.classList.toggle('show', moreMenuVisible);
  }
}

// 点击其他区域关闭菜单
document.addEventListener('click', function(e) {
  const container = document.querySelector('.more-menu-container');
  if (moreMenuVisible && !container.contains(e.target)) {
    document.querySelector('.more-dropdown').classList.remove('show');
    moreMenuVisible = false;
  }
});

// 动态问候语
const greetingEl = document.getElementById('greeting');
if (greetingEl) {
  const hour = new Date().getHours();
  let greeting = '';
  if (hour < 6) greeting = '凌晨好 🌙';
  else if (hour < 9) greeting = '早上好 🌞';
  else if (hour < 12) greeting = '上午好 ☀️';
  else if (hour < 14) greeting = '中午好 🍚';
  else if (hour < 18) greeting = '下午好 🌆';
  else if (hour < 22) greeting = '晚上好 🌃';
  else greeting = '夜深了，休息一下吧~';
  
  greetingEl.textContent = greeting;
  greetingEl.style.animation = 'fadeIn 1s ease forwards';
}

// 控制台输出
function consoleBeautify() {
  // 输出带样式的文字信息
  console.log(
    "%c这里是缎金SatinAu https://satinau.cn",
    "color: #00FFCC; font-size: 16px; font-weight: bold;"
  );

  console.log(
    "%cCopyright 2025 缎金SatinAu",
    "color: #FFE92C; font-size: 14px;",
  );
  
  console.log(
    "%c当前页面: %s",
    "color: #5E447B; font-size: 14px;",
    window.location.pathname
  );
  
  console.log(
    "%c问题反馈请前往https://github.com/SatinAu-Zelynn/SatinAu-Website-Classic/issues/",
    "color: #FF9999; font-style: italic;"
  );
}

// 页面加载完成后执行
window.addEventListener('load', consoleBeautify);

document.addEventListener('DOMContentLoaded', function() {
  // 获取桌面端原有的菜单选项
  const desktopDropdown = document.querySelector('.more-dropdown');
  if (!desktopDropdown) return;
  
  // 复制桌面端原菜单到移动端
  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'mobile-more-menu';
  mobileMenu.innerHTML = desktopDropdown.innerHTML;
  document.body.appendChild(mobileMenu);
  
  const bottomNav = document.querySelector('.bottom-nav');
  const navLinks = bottomNav.querySelectorAll('a'); // 获取导航按钮
  let startY = 0;
  let moveY = 0;
  let isDragging = false;
  let isMenuOpen = false;
  let isNavLinkTouched = false; // 标记是否点击了导航按钮
  
  // 导航按钮触摸事件
  navLinks.forEach(link => {
    link.addEventListener('touchstart', () => {
      isNavLinkTouched = true;
    });
    
    link.addEventListener('touchend', () => {
      // 延迟重置，确保在手势判断后执行
      setTimeout(() => {
        isNavLinkTouched = false;
      }, 100);
    });
  });
  
  // 触摸开始
  bottomNav.addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
    isDragging = true;
    isNavLinkTouched = false; // 重置状态
  }, { passive: false });
  
  // 触摸移动
  bottomNav.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    
    moveY = e.touches[0].clientY;
    const diff = moveY - startY;
    
    // 上滑手势且菜单未打开时阻止页面滚动
    if (diff < 0 && !isMenuOpen) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // 触摸结束
  bottomNav.addEventListener('touchend', function() {
    if (!isDragging) return;
    
    const diff = moveY - startY;
    const touchDuration = Date.now() - touchStartTime; // 计算触摸时长
    
    // 触发条件：上滑距离>80px，且不是点击导航按钮，且触摸时长>150ms
    if (diff < -80 && !isMenuOpen && !isNavLinkTouched && touchDuration > 150) {
      mobileMenu.classList.add('show');
      bottomNav.classList.add('menu-open');
      isMenuOpen = true;
      document.body.style.overflow = 'hidden';
    }
    
    isDragging = false;
  });
  
  // 记录触摸开始时间
  let touchStartTime = 0;
  bottomNav.addEventListener('touchstart', function() {
    touchStartTime = Date.now();
  }, { passive: true });
  
  // 点击菜单外部关闭
  document.addEventListener('click', function(e) {
    if (isMenuOpen && !mobileMenu.contains(e.target) && !bottomNav.contains(e.target)) {
      mobileMenu.classList.remove('show');
      bottomNav.classList.remove('menu-open');
      isMenuOpen = false;
      document.body.style.overflow = '';
    }
  });
  
  // 菜单内部点击处理
  mobileMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', function(e) {
      const isExternal = this.target === '_blank' || this.href.startsWith('http');
      if (!isExternal) {
        e.preventDefault();
        if (typeof spaNavigate === 'function') {
          spaNavigate(this.getAttribute('href'));
        } else {
          window.location.href = this.getAttribute('href');
        }
      }
      
      mobileMenu.classList.remove('show');
      bottomNav.classList.remove('menu-open');
      isMenuOpen = false;
      document.body.style.overflow = '';
    });
  });
});

/* ========== 自定义右键菜单逻辑 ========== */

let customMenuInstance = null;
const CUSTOM_MENU_KEY = 'setting_custom_context_menu_enabled';

// 获取菜单设置，默认启用 (true)
function getCustomMenuSetting() {
    // localStorage 存储的是字符串 'true' 或 'false'
    const setting = localStorage.getItem(CUSTOM_MENU_KEY);
    // 如果没有设置，默认为 true
    return setting === null ? true : setting === 'true';
}

// 初始化菜单实例并根据设置挂载/卸载
function initCustomRightClickMenu() {
    // 检查 CustomRightClickMenu 类是否可用 (来自 CRCMenu.v2.js)
    if (typeof CustomRightClickMenu === 'undefined') {
        console.warn('CRCMenu.v2.js 未加载或类名不正确。');
        return;
    }

    // 实例化菜单（CustomRightClickMenu是单例模式）
    if (!customMenuInstance) {
        // 确保 Web Component 已定义（CRCMenu.v2.js 应该自行注册）
        if (!customElements.get('custom-right-click-menu')) {
             customElements.define('custom-right-click-menu', CustomRightClickMenu);
        }
        customMenuInstance = new CustomRightClickMenu({});
        // 将 Web Component 添加到 body 中
        document.body.appendChild(customMenuInstance);
    }
    
    // 检查设置，决定是 mount 还是 unmount
    const isEnabled = getCustomMenuSetting();
    if (isEnabled) {
        customMenuInstance.mount();
    } else {
        customMenuInstance.unmount();
    }
}

// 设置页面加载时，将设置状态反映到 UI 上
function loadCustomRightClickMenuSetting() {
    const toggleEl = document.getElementById('customRightClickMenuToggle');
    if (toggleEl) {
        toggleEl.checked = getCustomMenuSetting();
    }
}

// 设置开关的 onChange 事件处理函数 (在 settings.html 中调用)
window.toggleCustomRightClickMenu = function() {
    const toggleEl = document.getElementById('customRightClickMenuToggle');
    if (!toggleEl) return;

    const isChecked = toggleEl.checked;
    
    // 1. 保存设置到 localStorage
    localStorage.setItem(CUSTOM_MENU_KEY, isChecked);
    
    // 2. 实时应用设置
    if (customMenuInstance) {
        if (isChecked) {
            customMenuInstance.mount();
            showToast("自定义右键菜单：已启用");
        } else {
            customMenuInstance.unmount();
            showToast("自定义右键菜单：已禁用");
        }
    } else {
         // 如果实例还未创建，则初始化它
         initCustomRightClickMenu();
    }
};

// 在 DOM 加载完成后，初始化自定义菜单并在设置页面加载 UI 状态
document.addEventListener('DOMContentLoaded', function() {
    // 初始化自定义右键菜单（所有页面）
    initCustomRightClickMenu();
    
    // 如果在设置页面，加载设置状态
    if (document.title.includes('设置')) {
        loadCustomRightClickMenuSetting();
    }
});

/* ========== 性能模式 ========== */
const PERFORMANCE_KEY = 'setting_performance_mode_enabled';
const LIMIT_CSS_ID = 'limitCSS';

function isPerformanceMode() {
    const setting = localStorage.getItem(PERFORMANCE_KEY);
    return setting === 'true'; // 默认 false
}

// 挂载 limit.css
function enablePerformanceCss() {
    if (document.getElementById(LIMIT_CSS_ID)) return;

    const link = document.createElement('link');
    link.id = LIMIT_CSS_ID;
    link.rel = 'stylesheet';
    link.href = '/src/limit.css';
    document.head.appendChild(link);
}

// 移除 limit.css
function disablePerformanceCss() {
    const el = document.getElementById(LIMIT_CSS_ID);
    if (el) el.remove();
}

// 切换开关（供 settings.html 调用）
window.togglePerformanceMode = function () {
    const checkbox = document.getElementById('performanceModeToggle');
    const enabled = checkbox.checked;

    localStorage.setItem(PERFORMANCE_KEY, enabled);

    if (enabled) {
        enablePerformanceCss();
        showToast("性能模式：已启用");
    } else {
        disablePerformanceCss();
        showToast("性能模式：已禁用");
    }
};

// 页面加载时自动应用
document.addEventListener('DOMContentLoaded', () => {
    const settingsToggle = document.getElementById('performanceModeToggle');

    if (settingsToggle) {
        settingsToggle.checked = isPerformanceMode();
    }

    if (isPerformanceMode()) {
        enablePerformanceCss();
    }
});

/* ========== 字体切换逻辑 ========== */
const FONT_KEY = 'setting_font_mode';

// 1. 初始化逻辑 (页面加载时执行)
document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('fontSelectComponent');
  if (!wrapper) {
    // 如果不在设置页，仅应用字体
    const savedMode = localStorage.getItem(FONT_KEY) || 'sans';
    applyFontMode(savedMode);
    return;
  }

  // 初始化设置页 UI
  initCustomSelect(wrapper);
});

// 2. 初始化自定义组件
function initCustomSelect(wrapper) {
  const trigger = wrapper.querySelector('.custom-select-trigger');
  const triggerText = wrapper.querySelector('.selected-value');
  const options = wrapper.querySelectorAll('.custom-option');
  
  // 读取当前设置
  const savedMode = localStorage.getItem(FONT_KEY) || 'sans';
  applyFontMode(savedMode); // 确保 CSS 变量生效

  // 更新 UI 显示状态
  options.forEach(opt => {
    if (opt.dataset.value === savedMode) {
      opt.classList.add('selected');
      triggerText.textContent = opt.textContent;
    } else {
      opt.classList.remove('selected');
    }
  });

  // 点击触发器：切换开关
  trigger.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止冒泡触发 document 的关闭事件
    wrapper.classList.toggle('open');
  });

  // 点击选项
  options.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // 1. 移除其他选项的 selected 类
      options.forEach(o => o.classList.remove('selected'));
      // 2. 给当前选项添加 selected 类
      option.classList.add('selected');
      // 3. 更新触发器文字
      triggerText.textContent = option.textContent;
      // 4. 关闭菜单
      wrapper.classList.remove('open');
      
      // 5. 执行实际功能
      const mode = option.dataset.value;
      localStorage.setItem(FONT_KEY, mode);
      applyFontMode(mode);
      
      showToast(`字体已切换为：${option.textContent.trim()}`);
    });
  });

  // 点击页面空白处关闭菜单
  document.addEventListener('click', () => {
    wrapper.classList.remove('open');
  });
}

// 3. 核心功能：应用字体变量
function applyFontMode(mode) {
  const root = document.documentElement;
  if (mode === 'serif') {
    root.style.setProperty('--global-font', 'var(--font-serif)');
  } else {
    root.style.setProperty('--global-font', 'var(--font-sans)');
  }
}

// 游戏控制器适配逻辑
class GamepadHandler {
  constructor() {
    this.isConnected = false;
    this.lastUsedGamepad = null;
    this.deadzone = 0.2;        // 左右摇杆死区
    this.sensitivity = 1.5;     // 灵敏度（值越大响应越快）
    this.scrollSpeed = 40;      // 右摇杆滚动速度
    this.lastSelectedElement = document.body;
    this.selectionCooldown = 0; // 控制摇杆导航频率
    this.init();
  }

  init() {
    window.addEventListener('gamepadconnected', (e) => this.handleConnect(e));
    window.addEventListener('gamepaddisconnected', (e) => this.handleDisconnect(e));
    requestAnimationFrame(() => this.pollGamepads());
  }

  handleConnect(e) {
    this.isConnected = true;
    this.lastUsedGamepad = e.gamepad;
    showToast(`🎮 游戏控制器已连接：${e.gamepad.id}`);
  }

  handleDisconnect(e) {
    this.isConnected = false;
    showToast(`🔌 游戏控制器已断开：${e.gamepad.id}`);
  }

  pollGamepads() {
    const gamepads = navigator.getGamepads();
    const activeGamepad = Array.from(gamepads).find(g => g && g.connected);

    if (activeGamepad) {
      this.lastUsedGamepad = activeGamepad;
      this.handleInput(activeGamepad);
    }

    requestAnimationFrame(() => this.pollGamepads());
  }

  applyDeadzone(value) {
    // 将摇杆输入值调整为灵敏度映射值
    if (Math.abs(value) < this.deadzone) return 0;
    const sign = Math.sign(value);
    const normalized = (Math.abs(value) - this.deadzone) / (1 - this.deadzone);
    return normalized * this.sensitivity * sign;
  }

  handleInput(gamepad) {
    // === 左摇杆处理 ===
    const leftX = this.applyDeadzone(gamepad.axes[0]);
    const leftY = this.applyDeadzone(gamepad.axes[1]);

    if (Date.now() - this.selectionCooldown > 200) { // 限制移动频率
      if (Math.abs(leftX) > 0.5 || Math.abs(leftY) > 0.5) {
        this.navigateElements(leftX, leftY);
        this.selectionCooldown = Date.now();
      }
    }

    // === 右摇杆处理 ===
    const rightY = this.applyDeadzone(gamepad.axes[3]);
    if (Math.abs(rightY) > 0) {
      window.scrollBy({
        top: rightY * this.scrollSpeed,
        behavior: 'smooth'
      });
    }

    // === A 键选中 ===（通常 index 0）
    if (gamepad.buttons[0].pressed) {
      this.selectElement();
    }

    // === 右扳机打开右键菜单 ===（通常 index 7）
    if (gamepad.buttons[7].pressed) {
      this.openContextMenu();
    }
  }

  navigateElements(x, y) {
    const focusable = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    let currentIndex = Array.from(focusable).indexOf(this.lastSelectedElement);
    if (currentIndex === -1) currentIndex = 0;

    if (Math.abs(x) > Math.abs(y)) {
      currentIndex = x > 0
        ? (currentIndex + 1) % focusable.length
        : (currentIndex - 1 + focusable.length) % focusable.length;
    } else {
      const step = Math.ceil(focusable.length / 10);
      currentIndex = y > 0
        ? (currentIndex + step) % focusable.length
        : (currentIndex - step + focusable.length) % focusable.length;
    }

    this.lastSelectedElement = focusable[currentIndex];
    this.lastSelectedElement.focus();
    this.lastSelectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  selectElement() {
    if (!this.lastSelectedElement) return;
    // 模拟点击事件
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    this.lastSelectedElement.dispatchEvent(event);
  }

  openContextMenu() {
    if (!this.lastSelectedElement) return;
    const rect = this.lastSelectedElement.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window
    });

    this.lastSelectedElement.dispatchEvent(event);
  }
}

// 初始化游戏控制器支持
document.addEventListener('DOMContentLoaded', () => {
  new GamepadHandler();
});

/* ========== 浏览器兼容性检测逻辑 ========== */

(function initCompatibilityCheck() {
  const CHECK_KEY = 'has_compatibility_checked';
  
  // 简易的核心特性检测函数 (与 compatibility.html 保持一致的标准)
  function checkCoreFeatures() {
    // 检查核心特性：CSS变量, CSS Grid, 基础ES6
    const supportVar = window.CSS && CSS.supports && CSS.supports('color', 'var(--c)');
    const supportGrid = window.CSS && CSS.supports && CSS.supports('display', 'grid');
    // 检查 module 支持 (通过 noModule 属性推断)
    const supportModule = 'noModule' in document.createElement('script');
    
    // 如果任意核心特性不支持，视为不兼容
    if (!supportVar || !supportGrid || !supportModule) return false;
    
    // 检查高级特性 (Baseline 2025: Nesting, :has)
    // 如果支持 CSS Nesting，则认为是现代浏览器 (2023+)
    // CSS.supports('selector(&)')
    const supportNesting = window.CSS && CSS.supports && CSS.supports('selector(&)');
    
    // 如果核心支持但高级不支持，视为"部分兼容"，但也需要弹窗提示吗？
    // 根据需求："只要不是可正常显示全部内容的内核都自动...打开"
    // 所以，如果不支持 Nesting，也应该弹。
    return supportNesting; 
  }

  const isFullySupported = checkCoreFeatures();
  const hasChecked = localStorage.getItem(CHECK_KEY);

  // 如果是从 compatibility.html 关闭回来的，不要再弹
  if (document.referrer.includes('compatibility.html')) {
     localStorage.setItem(CHECK_KEY, 'true');
     return;
  }

  // 触发条件：未检测过 && 不是完美支持
  if (!hasChecked && !isFullySupported) {
    // 标记已检测，避免死循环
    localStorage.setItem(CHECK_KEY, 'true');
    
    console.warn('Browser compatibility check failed. Redirecting to report...');
    
    // 尝试在新标签页打开
    const targetUrl = '/pages/help/compatibility.html';
    
    // 注意：非用户触发的 window.open 可能会被拦截
    const newWin = window.open(targetUrl, '_blank');
    
    if (!newWin || newWin.closed || typeof newWin.closed == 'undefined') {
        // 如果被拦截，降级为 Toast 提示，引导用户手动点击
        // 由于此时页面可能因为不兼容已经乱了，尽量用原生 alert 或 confirm
        const userGo = confirm("检测到您的浏览器可能无法完美显示本网站内容（如样式错乱）。\n是否查看兼容性报告？");
        if (userGo) {
            window.location.href = targetUrl;
        }
    }
  }
})();