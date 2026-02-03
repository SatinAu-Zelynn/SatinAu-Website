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

/* ========== 整点报时逻辑 ========== */
const CHIME_KEY = 'setting_hourly_chime_enabled';
let serverTimeOffset = 0; // 服务器时间与本地时间的差值 (ms)
let lastChimeHour = -1;   // 记录上一次报时的小时，防止一分钟内重复报时

// 获取报时设置（默认开启，即 null 时返回 true，或者根据需求默认 false）
function isChimeEnabled() {
  const setting = localStorage.getItem(CHIME_KEY);
  // 这里设为默认为 true (开启)，如果用户没设置过
  return setting === null ? true : setting === 'true';
}

// 切换开关（供 settings.html 调用）
window.toggleHourlyChime = function() {
  const checkbox = document.getElementById('chimeToggle');
  const enabled = checkbox.checked;
  localStorage.setItem(CHIME_KEY, enabled);
  showToast(enabled ? "整点报时：已启用" : "整点报时：已禁用");
};

// 时间校准与定时检查
function initTimeSync() {
  const localStart = Date.now();
  
  // 请求头部信息获取时间
  fetch(window.location.href, { method: 'HEAD', cache: 'no-cache' })
    .then(response => {
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime();
        const localEnd = Date.now();
        // 粗略计算网络延迟的一半
        const latency = (localEnd - localStart) / 2;
        // 计算偏移量：服务器时间 = 本地时间 + offset
        serverTimeOffset = serverTime - localEnd + latency;
        console.log(`%c时间已同步，偏差: ${Math.round(serverTimeOffset)}ms`, "color: #00FFCC;");
        
        // 更新页脚年份（复用原有逻辑，但利用计算出的 offset 确保更准）
        const yearElement = document.getElementById('current-year');
        if (yearElement) {
            yearElement.textContent = new Date(Date.now() + serverTimeOffset).getFullYear();
        }
      }
    })
    .catch(err => console.warn('时间同步失败，使用本地时间', err));

  // 启动定时器，每秒检查一次
  setInterval(checkTimeAndChime, 1000);
}

// 核心检查逻辑
function checkTimeAndChime() {
  if (!isChimeEnabled()) return;

  // 当前准确时间
  const now = new Date(Date.now() + serverTimeOffset);
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const currentHour = now.getHours();

  // 触发条件：分钟为0，秒数在 0-2 之间（留出一点缓冲），且当前小时还没报过
  if (minutes === 0 && seconds < 3 && currentHour !== lastChimeHour) {
    lastChimeHour = currentHour;
    triggerChime(currentHour);
  }
}

// 触发弹窗和声音
function triggerChime(hour) {
  // 查找或创建 GlobalModal 实例
  let modal = document.querySelector('global-modal');
  if (!modal) {
    modal = document.createElement('global-modal');
    document.body.appendChild(modal);
  }
  
  if (modal.showChime) {
    modal.showChime(hour);
  }
}

/* 通用工具函数 */
function toggleModal(id, show = true) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("show", show);
}

function showToast(msg) {
  const tip = document.getElementById("toast");
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
        window.location.href = this.getAttribute('href');
      }
      
      mobileMenu.classList.remove('show');
      bottomNav.classList.remove('menu-open');
      isMenuOpen = false;
      document.body.style.overflow = '';
    });
  });

  // 初始化原生通知开关状态
  const notifyToggle = document.getElementById('nativeNotificationToggle');
  if (notifyToggle) {
    // 只有当 localStorage 为 true 且 浏览器权限确实为 granted 时，UI才显示开启
    // 这样如果用户在浏览器层面清理了权限，网页开关也会自动变回关闭
    notifyToggle.checked = isNativeNotificationEnabled();
  }
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
    // 检查 CustomRightClickMenu 类是否可用 (来自 CRCMenu.js)
    if (typeof CustomRightClickMenu === 'undefined') {
        console.warn('CRCMenu.js 未加载或类名不正确。');
        return;
    }

    // 实例化菜单（CustomRightClickMenu是单例模式）
    if (!customMenuInstance) {
        // 确保 Web Component 已定义（CRCMenu.js 应该自行注册）
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
    // 初始化时间同步和报时检查
    initTimeSync();
    
    // 如果在设置页面，加载设置状态
    if (document.title.includes('设置')) {
        loadCustomRightClickMenuSetting();
    }

    // 如果在设置页，初始化开关状态
    const chimeToggle = document.getElementById('chimeToggle');
    if (chimeToggle) {
      chimeToggle.checked = isChimeEnabled();
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
      
      // 移除其他选项的 selected 类
      options.forEach(o => o.classList.remove('selected'));
      // 给当前选项添加 selected 类
      option.classList.add('selected');
      // 更新触发器文字
      triggerText.textContent = option.textContent;
      // 关闭菜单
      wrapper.classList.remove('open');
      
      // 执行实际功能
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

// 应用字体变量
function applyFontMode(mode) {
  const root = document.documentElement;
  if (mode === 'serif') {
    root.style.setProperty('--global-font', 'var(--font-serif)');
  } else if (mode === 'system') {
    // 应用系统字体变量
    root.style.setProperty('--global-font', 'var(--font-system)');
  } else {
    // 默认为 sans
    root.style.setProperty('--global-font', 'var(--font-sans)');
  }
}

/* ========== 主题色切换逻辑 ========== */
const THEME_COLOR_KEY = 'setting_theme_color';

// 预设颜色值 (格式: [浅色模式Hex, 深色模式Hex])
// 默认蓝: #007aff, #0a84ff
const THEME_PRESETS = {
  'default': ['#007aff', '#0a84ff'], // 默认蓝
  'purple':  ['#AF52DE', '#BF5AF2'], // 霓虹紫
  'pink':    ['#FF2D55', '#FF375F'], // 活力粉
  'orange':  ['#FF9500', '#FF9F0A'], // 暖阳橙
  'green':   ['#34C759', '#30D158'], // 薄荷绿
  'cyan':    ['#00C7BE', '#59DAC6']  // 青色
};

// 初始化逻辑 (页面加载时执行)
document.addEventListener('DOMContentLoaded', () => {
  // 无论在哪个页面，都要应用当前保存的主题色
  const savedColorKey = localStorage.getItem(THEME_COLOR_KEY) || 'default';
  applyThemeColor(savedColorKey);

  // 如果在设置页面，初始化选择器 UI
  const selectorWrapper = document.getElementById('themeColorSelector');
  if (selectorWrapper) {
    initThemeColorSelector(selectorWrapper, savedColorKey);
  }
});

// 核心功能：应用主题色变量
function applyThemeColor(key) {
  const colors = THEME_PRESETS[key] || THEME_PRESETS['default'];
  const root = document.documentElement;
  
  // 使用 CSS 的 light-dark() 函数
  // 注意：需要浏览器支持 CSS Color Module Level 5，现代浏览器均已支持
  const colorValue = `light-dark(${colors[0]}, ${colors[1]})`;
  
  root.style.setProperty('--primary-color', colorValue);
}

// 初始化 UI
function initThemeColorSelector(wrapper, currentKey) {
  // 清空现有内容（防止重复初始化）
  wrapper.innerHTML = '';

  // 遍历预设生成色块
  for (const [key, colors] of Object.entries(THEME_PRESETS)) {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.dataset.key = key;
    
    // 为了让色块在UI上好看，我们取深色模式的颜色作为背景展示，或者做一个简单的渐变
    swatch.style.background = colors[0]; 
    swatch.title = key; // 简单的提示

    // 标记当前选中项
    if (key === currentKey) {
      swatch.classList.add('selected');
    }

    // 点击事件
    swatch.addEventListener('click', () => {
      // 移除其他选中状态
      wrapper.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      // 选中当前
      swatch.classList.add('selected');
      // 保存设置
      localStorage.setItem(THEME_COLOR_KEY, key);
      // 立即应用
      applyThemeColor(key);
      // 提示
      // 简单的中文映射
      const nameMap = {
        'default': '默认蓝', 'purple': '霓虹紫', 'pink': '活力粉',
        'orange': '暖阳橙', 'green': '薄荷绿', 'cyan': '青色'
      };
      showToast(`主题色已切换为：${nameMap[key] || key}`);
    });

    wrapper.appendChild(swatch);
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

document.addEventListener('DOMContentLoaded', () => {
  const hdrToggle = document.getElementById('hdrModeToggle');
  if (hdrToggle) {
    // 检查 localStorage，默认为 'false' (关闭)
    const isHDREnabled = localStorage.getItem('enableHDR') === 'true';
    hdrToggle.checked = isHDREnabled;
  }
});

// 切换 HDR 模式函数
function toggleHDRMode() {
  const hdrToggle = document.getElementById('hdrModeToggle');
  const isChecked = hdrToggle.checked;
  localStorage.setItem('enableHDR', isChecked);
  
  // 如果有 toast 函数，提示用户
  if (typeof showToast === 'function') {
    showToast(isChecked ? '已开启 HDR 模式 (AVIF)' : '已关闭 HDR 模式 (WEBP)');
  }
}

/* ========== 颜色模式切换逻辑 (Light/System/Dark) ========== */
const THEME_MODE_KEY = 'setting_theme_mode';

// 核心应用函数
function applyThemeMode(mode) {
  const root = document.documentElement;
  // 移除之前的属性
  root.removeAttribute('data-theme');

  if (mode === 'light') {
    root.setAttribute('data-theme', 'light');
    // 如果有 light-dark() CSS 支持，这会强制触发 light 颜色
  } else if (mode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    // System 模式：移除 data-theme 属性，CSS 中的 color-scheme: light dark 会自动生效
    // 并自动清理 localStorage 以保持“跟随系统”的逻辑
    localStorage.removeItem(THEME_MODE_KEY); 
  }
}

// 初始化逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 读取当前设置（默认为 null，即 System）
  const savedMode = localStorage.getItem(THEME_MODE_KEY) || 'system';
  
  // 立即应用（其实为了防止闪烁，applyThemeMode 最好在 head script 中也同步执行一次，但这里放在 DOMLoaded 统一管理）
  if (savedMode !== 'system') {
      applyThemeMode(savedMode);
  }

  // 如果存在 UI 控件（设置页面），则初始化交互
  const control = document.getElementById('themeModeControl');
  if (control) {
    const buttons = control.querySelectorAll('button');
    
    // 更新 UI 选中状态
    buttons.forEach(btn => {
      if (btn.dataset.value === savedMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }

      // 绑定点击事件
      btn.addEventListener('click', () => {
        // 视觉切换
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 逻辑应用
        const selectedMode = btn.dataset.value;
        
        if (selectedMode === 'system') {
          localStorage.removeItem(THEME_MODE_KEY);
          showToast('已切换为：跟随系统');
        } else {
          localStorage.setItem(THEME_MODE_KEY, selectedMode);
          const text = selectedMode === 'light' ? '明亮模式' : '深色模式';
          showToast(`已切换为：${text}`);
        }
        
        applyThemeMode(selectedMode);
      });
    });
  }
});

(function preApplyTheme() {
    const saved = localStorage.getItem('setting_theme_mode');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
})();

/* ========== 导航栏自动隐藏 ========== */
const AUTOHIDE_NAV_KEY = 'setting_autohide_nav_enabled';

function isAutoHideNavEnabled() {
  return localStorage.getItem(AUTOHIDE_NAV_KEY) === 'true'; // 默认 false
}

// 切换开关（供 settings.html 调用）
window.toggleAutoHideNav = function() {
  const checkbox = document.getElementById('autoHideNavToggle');
  const enabled = checkbox.checked;
  localStorage.setItem(AUTOHIDE_NAV_KEY, enabled);

  // 如果关闭了该功能，立即移除隐藏类，确保导航栏显示出来
  if (!enabled) {
    const nav = document.querySelector('.bottom-nav');
    if (nav) nav.classList.remove('nav-hidden');
  }

  showToast(enabled ? "自动隐藏导航栏：已启用" : "自动隐藏导航栏：已禁用");
};

// 页面加载时自动应用 checkbox 状态
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('autoHideNavToggle');
  if (toggle) {
    toggle.checked = isAutoHideNavEnabled();
  }
});

/* ========== 原生系统通知逻辑 ========== */
const NATIVE_NOTIFY_KEY = 'setting_native_notifications_enabled';

// 判断是否可以使用原生通知 (设置开启且浏览器已授权)
function isNativeNotificationEnabled() {
  const setting = localStorage.getItem(NATIVE_NOTIFY_KEY);
  // 默认为 false (关闭)
  return setting === 'true' && ("Notification" in window) && Notification.permission === 'granted';
}

// 发送原生通知的通用函数
// 参数: title (标题), options (body, icon, tag, data 等)
// url (可选): 点击通知后跳转的链接
window.sendNativeNotification = function(title, options = {}, url = null) {
  if (!isNativeNotificationEnabled()) return;

  // 默认配置
  const defaultOptions = {
    icon: '/public/favicon.ico', // logo 图片
    badge: '/public/favicon.ico', // 安卓状态栏小图标
    vibrate: [200, 100, 200],     // 移动端震动模式
    ...options
  };

  try {
    const notification = new Notification(title, defaultOptions);

    // 点击通知的交互
    notification.onclick = function(event) {
      event.preventDefault();
      notification.close();
      
      // 如果提供了URL，点击跳转
      if (url) {
        window.open(url, '_blank');
      } else {
        window.focus();
      }
    };
  } catch (e) {
    console.warn("发送原生通知失败:", e);
  }
};

// 切换开关（供 settings.html 调用）
window.toggleNativeNotifications = function() {
  const checkbox = document.getElementById('nativeNotificationToggle');
  const wantEnabled = checkbox.checked;

  if (!("Notification" in window)) {
    showToast("您的浏览器不支持原生通知功能");
    checkbox.checked = false;
    return;
  }

  if (wantEnabled) {
    // 用户想要开启
    if (Notification.permission === "granted") {
      // 已经有权限，直接开启
      localStorage.setItem(NATIVE_NOTIFY_KEY, 'true');
      showToast("系统通知：已启用");
      // 发送一条测试通知确认
      sendNativeNotification("通知已开启", { body: "以后您将收到重要的公告和更新提醒。" });
    } else if (Notification.permission !== "denied") {
      // 从未询问过，请求权限
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          localStorage.setItem(NATIVE_NOTIFY_KEY, 'true');
          showToast("系统通知：授权成功并已启用");
          sendNativeNotification("通知已开启", { body: "以后您将收到重要的公告和更新提醒。" });
        } else {
          // 用户拒绝
          checkbox.checked = false;
          showToast("您拒绝了通知权限，无法开启");
        }
      });
    } else {
      // 之前已经被拒绝过，需要手动去浏览器设置开启
      checkbox.checked = false;
      showToast("权限曾被拒绝，请在浏览器设置中手动允许通知");
    }
  } else {
    // 用户想要关闭
    localStorage.setItem(NATIVE_NOTIFY_KEY, 'false');
    showToast("系统通知：已禁用");
  }
};

/* ========== 自动获取远程通知逻辑 ========== */
function fetchRemoteNotice() {
  // 仅在开启了通知权限时才去请求后端，节省流量
  if (!isNativeNotificationEnabled()) return;

  const NOTICE_URL = 'https://blog.satinau.cn/data/notice.json';
  const LAST_ID_KEY = 'last_processed_notice_id';

  fetch(NOTICE_URL, { cache: 'no-cache' })
    .then(response => response.json())
    .then(data => {
      // 数据标准化：无论后端返回单个对象还是数组，统一转为数组处理
      const notices = Array.isArray(data) ? data : [data];

      // 获取本地存储的最后一个已读 ID，默认为 0
      let lastId = parseInt(localStorage.getItem(LAST_ID_KEY) || '0');
      let maxIdFound = lastId; // 用于记录本次请求中发现的最大 ID

      // 遍历所有通知
      notices.forEach(notice => {
        const currentId = parseInt(notice.id);

        // 核心逻辑：active 为 true 且 ID 比本地记录的新
        if (notice.active && currentId > lastId) {
          
          window.sendNativeNotification(notice.title, {
            body: notice.content,
            // 使用带 ID 的 tag，确保多条通知不会互相覆盖
            tag: `remote-notice-${currentId}`, 
            requireInteraction: true 
          }, notice.url);

          // 记录当前批次中最大的 ID
          if (currentId > maxIdFound) {
            maxIdFound = currentId;
          }
        }
      });

      // 更新本地记录（只记录见过的最大 ID，避免下次重复弹窗）
      if (maxIdFound > lastId) {
        localStorage.setItem(LAST_ID_KEY, maxIdFound);
      }
    })
    .catch(err => console.error('获取远程通知失败:', err));
}

// 页面加载 3 秒后检查一次通知（避开启动峰值）
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(fetchRemoteNotice, 3000);
});

/* ========== 恢复默认设置 ========== */
window.restoreDefaultSettings = function(triggerElement) {
  // 查找或创建 GlobalModal 实例
  let modal = document.querySelector('global-modal');
  if (!modal) {
    modal = document.createElement('global-modal');
    document.body.appendChild(modal);
  }

  // 定义具体的重置逻辑
  const doReset = () => {
    // 定义所有在 common.js 中使用的设置 Key
    const settingsKeys = [
      'setting_font_mode',                  // 字体
      'setting_theme_color',                // 主题色
      'setting_theme_mode',                 // 颜色模式
      'setting_performance_mode_enabled',   // 性能模式
      'setting_autohide_nav_enabled',       // 导航栏隐藏
      'setting_native_notifications_enabled', // 系统通知
      'setting_hourly_chime_enabled',       // 整点报时
      'setting_custom_context_menu_enabled', // 右键菜单
      'enableHDR'                           // HDR 模式
    ];

    // 移除这些 Key
    settingsKeys.forEach(key => localStorage.removeItem(key));

    showToast("正在重置...");
    
    // 延迟一小会儿刷新，让用户看到提示
    setTimeout(() => {
      location.reload();
    }, 500);
  };

  // 优先使用 GlobalModal，如果组件未加载则降级使用原生 confirm
  if (modal.confirmAction) {
    modal.with(triggerElement).confirmAction(
      '确定要恢复所有设置到默认状态吗？\n页面将会刷新，您的自定义选项将丢失。', 
      doReset, 
      '确认恢复'
    );
  } else {
    if (confirm('确定要恢复所有设置到默认状态吗？\n页面将会刷新，您的自定义选项将丢失。')) {
      doReset();
    }
  }
};