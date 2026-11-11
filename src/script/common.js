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

/* ========== CDN 线路切换与自动测速优选逻辑 ========== */
const CDN_KEY = 'setting_cdn_source';
const CDN_AUTO_PICKED_KEY = 'setting_cdn_auto_picked';

// 全局存储测速延迟结果 (ms)
window.cdnLatencies = {
  cf: null,
  eo: null
};

// 获取当前有效 CDN 域名
window.getCdnBaseUrl = function() {
  const source = localStorage.getItem(CDN_KEY) || 'auto';
  if (source === 'eo') {
    return 'https://cdn-eo.satinau.cn';
  }
  if (source === 'cf') {
    return 'https://cdn-cf.satinau.cn';
  }
  // 自动模式：使用上次测速出的更优线路（默认 cf）
  const picked = localStorage.getItem(CDN_AUTO_PICKED_KEY) || 'cf';
  return picked === 'eo' ? 'https://cdn-eo.satinau.cn' : 'https://cdn-cf.satinau.cn';
};

// 获取备用 CDN 域名
window.getCdnFallbackUrl = function() {
  const current = window.getCdnBaseUrl();
  return current === 'https://cdn-eo.satinau.cn'
    ? 'https://cdn-cf.satinau.cn'
    : 'https://cdn-eo.satinau.cn';
};

// 将任意 CDN 资源路径或硬编码 CDN 链接转换为基于当前有效线路的完整 URL
window.getCdnUrl = function(pathOrUrl) {
  if (!pathOrUrl) return '';
  const baseUrl = window.getCdnBaseUrl();
  const cdnRegex = /^https?:\/\/(cdn-cf|cdn-eo|cdn|blog)\.satinau\.cn/i;
  if (cdnRegex.test(pathOrUrl)) {
    return pathOrUrl.replace(cdnRegex, baseUrl);
  }
  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${cleanPath}`;
};

// 核心 CDN 接口请求方法：优先使用当前线路，若网络异常、超时或响应错误自动回退到备用线路
window.fetchCdn = async function(pathOrUrl, options = {}) {
  const currentBase = window.getCdnBaseUrl();
  const fallbackBase = window.getCdnFallbackUrl();

  let relativePath = pathOrUrl || '';
  const cdnRegex = /^https?:\/\/(cdn-cf|cdn-eo|cdn|blog)\.satinau\.cn/i;
  if (cdnRegex.test(relativePath)) {
    relativePath = relativePath.replace(cdnRegex, '');
  }

  // 若传入的是完全外部的其他 URL，直接调用标准 fetch
  if (/^https?:\/\//i.test(relativePath)) {
    return fetch(relativePath, options);
  }

  if (!relativePath.startsWith('/')) {
    relativePath = `/${relativePath}`;
  }

  const primaryUrl = `${currentBase}${relativePath}`;
  const fallbackUrl = `${fallbackBase}${relativePath}`;

  try {
    const res = await fetch(primaryUrl, options);
    if (!res.ok && res.status !== 304) {
      console.warn(`[CDN] 主线路响应异常 (${res.status}): ${primaryUrl}，正在尝试备用线路: ${fallbackUrl}`);
      const fallbackRes = await fetch(fallbackUrl, options);
      if (fallbackRes.ok || fallbackRes.status === 304) {
        if (localStorage.getItem(CDN_KEY) === 'auto' || !localStorage.getItem(CDN_KEY)) {
          const fallbackSource = fallbackBase.includes('cdn-eo') ? 'eo' : 'cf';
          localStorage.setItem(CDN_AUTO_PICKED_KEY, fallbackSource);
        }
        return fallbackRes;
      }
      return res;
    }
    return res;
  } catch (err) {
    console.warn(`[CDN] 主线路请求失败: ${primaryUrl} (${err.message})，正在尝试备用线路: ${fallbackUrl}`);
    try {
      const fallbackRes = await fetch(fallbackUrl, options);
      if (localStorage.getItem(CDN_KEY) === 'auto' || !localStorage.getItem(CDN_KEY)) {
        const fallbackSource = fallbackBase.includes('cdn-eo') ? 'eo' : 'cf';
        localStorage.setItem(CDN_AUTO_PICKED_KEY, fallbackSource);
      }
      return fallbackRes;
    } catch (fallbackErr) {
      console.error(`[CDN] 主备两条线路均请求失败: ${relativePath}`, fallbackErr);
      throw err;
    }
  }
};

// 全局捕获 CDN 图片加载错误并自动回退备用线路
window.addEventListener('error', function(e) {
  const target = e.target;
  if (target && target.tagName === 'IMG') {
    const src = target.src || '';
    const cdnRegex = /^https?:\/\/(cdn-cf|cdn-eo|cdn|blog)\.satinau\.cn/i;
    if (cdnRegex.test(src) && !target.__cdn_retried) {
      target.__cdn_retried = true;
      const fallbackBase = window.getCdnFallbackUrl();
      target.src = src.replace(cdnRegex, fallbackBase);
    }
  }
}, true);

// 单源延迟探测
async function testCdnPing(baseUrl) {
  const testUrl = `${baseUrl}/data/notice.json?_t=${Date.now()}`;
  const start = performance.now();
  try {
    const res = await fetch(testUrl, { method: 'HEAD', cache: 'no-cache', mode: 'cors' });
    if (!res.ok && res.status !== 304) throw new Error('status error');
    return Math.round(performance.now() - start);
  } catch (e) {
    try {
      const resFallback = await fetch(testUrl, { method: 'GET', cache: 'no-cache', mode: 'cors' });
      if (!resFallback.ok && resFallback.status !== 304) throw new Error('status error');
      return Math.round(performance.now() - start);
    } catch (err) {
      return -1; // 测速失败或超时
    }
  }
}

// 自动检测两个线路延迟并在自动模式下挑选最优解
window.detectCdnLatencies = async function() {
  const [cfPing, eoPing] = await Promise.all([
    testCdnPing('https://cdn-cf.satinau.cn'),
    testCdnPing('https://cdn-eo.satinau.cn')
  ]);

  window.cdnLatencies.cf = cfPing;
  window.cdnLatencies.eo = eoPing;

  // 派发测速完成事件，便于弹窗实时刷新数值
  window.dispatchEvent(new CustomEvent('cdn-ping-updated', { detail: window.cdnLatencies }));

  // 计算优选线路
  let best = 'cf';
  if (cfPing > 0 && eoPing > 0) {
    best = eoPing < cfPing ? 'eo' : 'cf';
  } else if (eoPing > 0) {
    best = 'eo';
  }

  // 记录优选线路，在下次刷新、切页或下次进入时生效
  localStorage.setItem(CDN_AUTO_PICKED_KEY, best);
};

// 进入站点后自动触发延迟探测
document.addEventListener('DOMContentLoaded', () => {
  window.detectCdnLatencies();
});

/* ========== 全局 Cookie 权限与 TermsFeed 管理 ========== */
window.initGlobalCookieConsent = function() {
  if (typeof window === 'undefined') return;
  if (window.cookieconsent && window.cookieconsent.cookieConsentObject) return;
  if (document.querySelector('script[src*="CookieConsent.js"]')) return;
  const script = document.createElement('script');
  script.src = '/src/script/components/CookieConsent.js';
  script.defer = true;
  (document.head || document.documentElement).appendChild(script);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initGlobalCookieConsent);
} else {
  window.initGlobalCookieConsent();
}

/* ========== Live2D 设置逻辑 ========== */
const LIVE2D_KEY = 'setting_live2d_enabled';
const LIVE2D_POS_KEY = 'setting_live2d_position';
const LIVE2D_SIZE_KEY = 'setting_live2d_size';

function isLive2DEnabled() {
  const setting = localStorage.getItem(LIVE2D_KEY);
  return setting === null ? true : setting === 'true'; // 默认开启
}

function getLive2DPosition() {
  const pos = localStorage.getItem(LIVE2D_POS_KEY);
  return pos === 'right' ? 'right' : 'left'; // 默认左下
}

function getLive2DSizeSetting() {
  const size = localStorage.getItem(LIVE2D_SIZE_KEY);
  return (size === 'small' || size === 'large') ? size : 'medium'; // 默认中
}

function getLive2DSizeInPixels(sizeSetting) {
  const sizeMap = {
    small: 240,
    medium: 300,
    large: 360
  };
  return sizeMap[sizeSetting] || 300;
}

window.isLive2DEnabled = isLive2DEnabled;
window.getLive2DPosition = getLive2DPosition;
window.getLive2DSizeSetting = getLive2DSizeSetting;
window.getLive2DSizeInPixels = getLive2DSizeInPixels;

window.applyLive2DPosition = function(pos) {
  const wrapper = document.getElementById('live2d-wrapper');
  if (!wrapper) return;
  if (pos === 'right') {
    wrapper.classList.remove('pos-left');
    wrapper.classList.add('pos-right');
  } else {
    wrapper.classList.remove('pos-right');
    wrapper.classList.add('pos-left');
  }
};

window.applyLive2DSize = function(sizeSetting) {
  const targetSize = getLive2DSizeInPixels(sizeSetting);
  const wrapper = document.getElementById('live2d-wrapper');
  if (wrapper) {
    wrapper.style.width = `${targetSize}px`;
    wrapper.style.height = `${targetSize}px`;
  }
  if (typeof window.__live2dResizeLayout === 'function') {
    window.__live2dResizeLayout(targetSize);
  }
};

window.setLive2DPosition = function(pos) {
  const validPos = pos === 'right' ? 'right' : 'left';
  localStorage.setItem(LIVE2D_POS_KEY, validPos);
  window.applyLive2DPosition(validPos);
};

window.setLive2DSize = function(size) {
  const validSize = (size === 'small' || size === 'large') ? size : 'medium';
  localStorage.setItem(LIVE2D_SIZE_KEY, validSize);
  window.applyLive2DSize(validSize);
};

window.toggleLive2D = function() {
  const checkbox = document.getElementById('live2dToggle');
  if (!checkbox) return;
  const enabled = checkbox.checked;
  localStorage.setItem(LIVE2D_KEY, enabled);

  // 联动更新设置面板中子项的显示状态
  const subSettings = document.getElementById('live2dSubSettings');
  if (subSettings) {
    subSettings.style.display = enabled ? '' : 'none';
    if (enabled && typeof initSegmentedControls === 'function') {
      requestAnimationFrame(() => initSegmentedControls());
    }
  }

  showToast(enabled ? "Live2D：已启用，正在刷新..." : "Live2D：已禁用，正在刷新...");
  setTimeout(() => location.reload(), 800); // 刷新页面以应用
};

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

/* Toast 队列与动画调度逻辑 */
let toastQueue = [];
let isToastShowing = false;
let isToastDismissing = false;
let toastTimers = [];

function clearToastTimers() {
  toastTimers.forEach(t => clearTimeout(t));
  toastTimers = [];
}

function processToastQueue() {
  if (toastQueue.length === 0) {
    isToastShowing = false;
    isToastDismissing = false;
    return;
  }

  const tip = document.getElementById("toast");
  if (!tip) {
    toastQueue = [];
    isToastShowing = false;
    isToastDismissing = false;
    return;
  }

  isToastShowing = true;
  isToastDismissing = false;
  const msg = toastQueue.shift();

  tip.textContent = msg;
  tip.classList.remove("done");
  void tip.offsetWidth; // 触发回流重绘，确保重新播放进场动画
  tip.classList.add("show");

  toastTimers.push(setTimeout(() => {
    tip.classList.add("done");
  }, 250));

  toastTimers.push(setTimeout(() => {
    dismissCurrentToast();
  }, 1800));
}

function dismissCurrentToast() {
  if (isToastDismissing) return;
  isToastDismissing = true;
  clearToastTimers();

  const tip = document.getElementById("toast");
  if (!tip) {
    processToastQueue();
    return;
  }

  tip.classList.remove("show", "done");

  // 等待出场过渡动画（对应 CSS 的 0.4s 过渡）结束后播放下一条
  toastTimers.push(setTimeout(() => {
    processToastQueue();
  }, 350));
}

function showToast(msg) {
  toastQueue.push(msg);
  if (!isToastShowing) {
    processToastQueue();
  } else {
    // 当前已有 Toast 在显示时，立即触发当前 Toast 退场并衔接下一条
    dismissCurrentToast();
  }
}

/* ========== 跟随页面滚动的标题、文字与卡片动画系统 ========== */
(function initScrollBoundAnimations() {
  const TARGET_SELECTOR = [
    'main.page h2',
    'main.page section > p',
    'main.page section .grid-column > p',
    'main.page section > pre',
    'main.page .contact-card',
    'main.page .moment-card',
    'main.page .video-wrapper',
    'main.page .am-container',
    'main.page .gallery-item',
    'main.page .filter-container',
    'main.page .search-container',
    'main.page .profile-container',
    'main.page .ai-summary-card',
    'main.page .post-actions-panel',
    'main.page .comments-title',
    'main.page .comment-input-wrapper',
    'main.page .comment-item'
  ].join(', ');

  const trackedStates = new Map();
  let rafId = null;
  let lastFrameTime = 0;

  function shouldExcludeElement(el) {
    if (!el || !(el instanceof HTMLElement)) return true;
    // 排除首页大标题与首屏简介、关于我粘性开场、博客正文/Markdown正文、协议正文及各类弹窗内部
    if (el.closest('.intro-screen, #scroll-sequence, #postView, .md-article, .md-body, .agreement-content, .modal')) {
      return true;
    }
    // 排除用于对齐占位的透明不可见元素（例如泽凌页面的透明占位文字）
    if (el.style.pointerEvents === 'none' && el.style.opacity === '0') {
      return true;
    }
    // 若祖先节点已作为动画单元（如卡片内部的子标题/子卡片），不再重复叠加动画
    if (el.parentElement && el.parentElement.closest('.scroll-anim-item')) {
      return true;
    }
    return false;
  }

  function applyElementStyle(state, p) {
    const el = state.el;
    if (el.closest('.disable-animation')) {
      state.ty = 0;
      state.scale = 1;
      el.classList.remove('is-scroll-animating');
      el.style.opacity = '';
      el.style.transform = '';
      el.style.filter = '';
      el.style.pointerEvents = '';
      return;
    }

    if (p >= 0.999) {
      state.ty = 0;
      state.scale = 1;
      el.classList.remove('is-scroll-animating');
      el.style.opacity = '';
      el.style.transform = '';
      el.style.filter = '';
      el.style.pointerEvents = '';
      return;
    }

    el.classList.add('is-scroll-animating');

    if (p <= 0.001) {
      const initTy = 42;
      const initScale = 0.84;
      const perfMode = typeof isPerformanceMode === 'function' && isPerformanceMode();
      state.ty = initTy;
      state.scale = initScale;
      el.style.opacity = '0';
      el.style.transform = `translate3d(0, ${initTy}px, 0) scale(${initScale})`;
      el.style.filter = perfMode ? 'none' : 'blur(10px)';
      el.style.pointerEvents = 'none';
      return;
    }

    // 缓动曲线：上移进入视口时从底部模糊放大至原尺寸，下移离开视口时沿同曲线反向缩小模糊消失
    const eased = 1 - Math.pow(1 - p, 2.5);
    const opacity = Math.min(1, Math.pow(p, 0.75));
    const ty = (1 - eased) * 42;
    const scale = 0.84 + 0.16 * eased;
    const perfMode = typeof isPerformanceMode === 'function' && isPerformanceMode();
    const blur = perfMode ? 0 : (1 - eased) * 10;

    state.ty = ty;
    state.scale = scale;

    el.style.opacity = opacity.toFixed(3);
    el.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    el.style.filter = blur > 0.12 ? `blur(${blur.toFixed(2)}px)` : 'none';
    el.style.pointerEvents = p < 0.15 ? 'none' : '';
  }

  function computeTargetProgress(state, vh, vw, scrollY, docScrollHeight) {
    const el = state.el;
    if (el.closest('.disable-animation')) {
      return 1;
    }

    const rect = el.getBoundingClientRect();
    // 跳过 display: none 的隐藏元素
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }

    const layoutHeight = el.offsetHeight || rect.height;
    // 还原未施加 transform 时的真实视口纵坐标，避免 scale/translateY 造成测量反馈抖动
    const layoutTop = rect.top - state.ty - layoutHeight * (1 - state.scale) * 0.5;

    const maxScroll = Math.max(0, docScrollHeight - vh);
    if (maxScroll <= 8) {
      return 1;
    }

    // 视口底部进出场区间：从视口底部 96% 处开始进入，上移至约 68% 处完全清晰放大；下移时反向退场
    const baseStartY = vh * 0.96;
    const animDistance = Math.max(180, Math.min(300, vh * 0.28));
    const baseEndY = baseStartY - animDistance;

    // 同一行多列卡片根据横向位置赋予微小的视差错落感
    const colRatio = Math.max(0, Math.min(1, rect.left / Math.max(1, vw)));
    const staggerOffset = colRatio * 32;

    const startY = baseStartY - staggerOffset;
    const normalEndY = baseEndY - staggerOffset;

    // 页面最底部元素补偿：确保滚到底部时位于页面末端的卡片也能到达 100% 清晰状态，且往回滚时平滑逆向
    const remainingScroll = Math.max(0, maxScroll - scrollY);
    const minTopAtMaxScroll = layoutTop - remainingScroll;
    const effectiveEndY = Math.max(normalEndY, Math.min(startY - 60, minTopAtMaxScroll + 16));

    const span = Math.max(40, startY - effectiveEndY);
    const rawP = (startY - layoutTop) / span;
    return Math.max(0, Math.min(1, rawP));
  }

  function collectTargets(snapImmediate = false) {
    const mainEl = document.querySelector('main.page');
    if (!mainEl) return;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const docScrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    const candidates = document.querySelectorAll(TARGET_SELECTOR);
    candidates.forEach(el => {
      if (trackedStates.has(el)) {
        if (snapImmediate) {
          const st = trackedStates.get(el);
          const tp = computeTargetProgress(st, vh, vw, scrollY, docScrollHeight);
          if (tp !== null) {
            st.targetP = tp;
            st.currentP = tp;
            applyElementStyle(st, tp);
          }
        }
        return;
      }

      if (shouldExcludeElement(el)) return;

      el.classList.add('scroll-anim-item');
      const state = {
        el,
        currentP: 0,
        targetP: 0,
        ty: 0,
        scale: 1
      };

      const tp = computeTargetProgress(state, vh, vw, scrollY, docScrollHeight);
      state.targetP = tp !== null ? tp : 0;
      // 若要求立即对齐（如从博客文章返回列表），直接同步进度；否则从 0 开始平滑过渡到目标进度
      state.currentP = snapImmediate ? state.targetP : 0;
      applyElementStyle(state, state.currentP);

      trackedStates.set(el, state);
    });
  }

  function tick(now) {
    rafId = null;
    const dt = lastFrameTime ? Math.min(64, Math.max(8, now - lastFrameTime)) : 16.67;
    lastFrameTime = now;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const docScrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    // 阻尼插值系数（基于帧间隔自适应），兼顾跟手响应与滚轮平滑过渡
    const lerpFactor = 1 - Math.pow(1 - 0.2, dt / 16.67);
    let needsMoreFrames = false;

    trackedStates.forEach((state, el) => {
      if (!el.isConnected) {
        trackedStates.delete(el);
        return;
      }

      const tp = computeTargetProgress(state, vh, vw, scrollY, docScrollHeight);
      if (tp === null) return;

      state.targetP = tp;
      const diff = state.targetP - state.currentP;

      if (Math.abs(diff) > 0.0015) {
        state.currentP += diff * lerpFactor;
        needsMoreFrames = true;
      } else {
        state.currentP = state.targetP;
      }

      applyElementStyle(state, state.currentP);
    });

    if (needsMoreFrames) {
      rafId = requestAnimationFrame(tick);
    } else {
      lastFrameTime = 0;
    }
  }

  function scheduleUpdate() {
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  window.refreshScrollAnimations = function(snapImmediate = false) {
    collectTargets(snapImmediate);
    scheduleUpdate();
  };

  window.addEventListener('DOMContentLoaded', function() {
    document.body.style.opacity = 1;

    collectTargets(false);
    scheduleUpdate();

    // 监听滚动与尺寸变化，实时驱动进出场动画
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', () => {
      collectTargets(false);
      scheduleUpdate();
    }, { passive: true });

    // 监听图片等资源加载完成导致页面高度变化
    document.addEventListener('load', (e) => {
      if (e.target && e.target.tagName === 'IMG') {
        scheduleUpdate();
      }
    }, true);

    // 监听异步渲染插入的卡片与标题（如博客列表、友链、动态、画廊、歌单、评论等）
    const domObserver = new MutationObserver((mutations) => {
      let hasAddedNodes = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          hasAddedNodes = true;
          break;
        }
      }
      if (hasAddedNodes) {
        collectTargets(false);
        scheduleUpdate();
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    // 延迟触发初始尺寸适配
    setTimeout(() => {
      document.body.style.width = '100%';
      window.dispatchEvent(new Event('resize'));
    }, 100);
  });
})();

/* ========== 全局无刷路由 (SPA / PJAX) 与页面生命周期管理 ========== */
function ensureLoadingOverlay() {
  let loader = document.getElementById("loadingOverlay");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loadingOverlay";
    loader.className = "loading-overlay";
    loader.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loader);
  }
  return loader;
}

(function initSpaRouter() {
  function ensureShellElements() {
    ensureLoadingOverlay();
    if (!document.getElementById("toast")) {
      const toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    let modal = document.querySelector("global-modal");
    if (!modal) {
      modal = document.createElement("global-modal");
      modal.id = "globalModal";
      document.body.appendChild(modal);
    } else if (!modal.id) {
      modal.id = "globalModal";
    }
  }

  function normalizePathname(pathname) {
    if (!pathname || pathname === '/') return '/index.html';
    if (pathname.endsWith('/')) return pathname + 'index.html';
    if (!pathname.endsWith('.html') && !pathname.includes('.')) {
      return pathname + '.html';
    }
    return pathname;
  }

  // 标记初始页面的内联 <style> 标签，以便路由切换时清理替换
  document.head.querySelectorAll('style').forEach(s => {
    s.setAttribute('data-pjax-page-style', 'true');
  });

  const loadedScriptSet = new Set([
    '/src/script/common.js'
  ]);

  function seedLoadedScripts() {
    document.querySelectorAll('script[src]').forEach(s => {
      try {
        const u = new URL(s.getAttribute('src'), window.location.href);
        loadedScriptSet.add(u.pathname);
      } catch (e) {}
    });
  }
  seedLoadedScripts();
  document.addEventListener('DOMContentLoaded', seedLoadedScripts);

  function isAlreadyLoadedCommonScript(pathname) {
    if (pathname.endsWith('/common.js')) return true;
    if (pathname.endsWith('/navigate.js') && customElements.get('navigate-bar')) return true;
    if (pathname.endsWith('/footer.js') && customElements.get('site-footer')) return true;
    if (pathname.endsWith('/GlobalModal.js') && customElements.get('global-modal')) return true;
    if (pathname.endsWith('/SettingsModal.js') && typeof window.mountSettingsToModal === 'function') return true;
    if (pathname.endsWith('/CRCMenu.js') && customElements.get('custom-right-click-menu')) return true;
    if (pathname.endsWith('/CookieConsent.js') && window.cookieconsent) return true;
    return false;
  }

  function isIgnoredThirdPartyScript(src) {
    if (!src) return true;
    return (
      src.includes('termsfeed.com') ||
      src.includes('cookie-consent') ||
      src.includes('CookieConsent') ||
      src.includes('clarity.ms') ||
      src.includes('betterstack.com')
    );
  }

  function loadExternalStylesheet(href, baseUrl) {
    return new Promise((resolve) => {
      try {
        const resolvedUrl = new URL(href, baseUrl);
        const existing = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).some(link => {
          try {
            const lu = new URL(link.getAttribute('href'), window.location.href);
            return lu.pathname === resolvedUrl.pathname;
          } catch (e) {
            return false;
          }
        });
        if (existing) {
          resolve();
          return;
        }
        const linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        linkEl.href = resolvedUrl.href;
        const timer = setTimeout(resolve, 1500);
        linkEl.onload = () => { clearTimeout(timer); resolve(); };
        linkEl.onerror = () => { clearTimeout(timer); resolve(); };
        document.head.appendChild(linkEl);
      } catch (e) {
        resolve();
      }
    });
  }

  function loadExternalScript(src, baseUrl) {
    return new Promise((resolve) => {
      if (isIgnoredThirdPartyScript(src)) {
        resolve();
        return;
      }
      try {
        const resolvedUrl = new URL(src, baseUrl);
        if (loadedScriptSet.has(resolvedUrl.pathname) || isAlreadyLoadedCommonScript(resolvedUrl.pathname)) {
          loadedScriptSet.add(resolvedUrl.pathname);
          resolve();
          return;
        }
        // 检查 DOM 中是否已存在同名脚本
        const existing = Array.from(document.querySelectorAll('script[src]')).some(s => {
          try {
            const su = new URL(s.getAttribute('src'), window.location.href);
            return su.pathname === resolvedUrl.pathname;
          } catch (e) {
            return false;
          }
        });
        if (existing) {
          loadedScriptSet.add(resolvedUrl.pathname);
          resolve();
          return;
        }

        const scriptEl = document.createElement('script');
        scriptEl.src = resolvedUrl.href;
        scriptEl.async = false;
        scriptEl.onload = () => {
          loadedScriptSet.add(resolvedUrl.pathname);
          resolve();
        };
        scriptEl.onerror = () => {
          console.warn('Script load failed:', resolvedUrl.href);
          resolve();
        };
        document.head.appendChild(scriptEl);
      } catch (e) {
        resolve();
      }
    });
  }

  function syncHeadMetadata(newDoc) {
    if (newDoc.title) {
      document.title = newDoc.title;
    }
    ['description', 'keywords'].forEach(metaName => {
      const newMeta = newDoc.head.querySelector(`meta[name="${metaName}"]`);
      let curMeta = document.head.querySelector(`meta[name="${metaName}"]`);
      if (newMeta) {
        if (!curMeta) {
          curMeta = document.createElement('meta');
          curMeta.setAttribute('name', metaName);
          document.head.appendChild(curMeta);
        }
        curMeta.setAttribute('content', newMeta.getAttribute('content') || '');
      } else if (curMeta) {
        curMeta.remove();
      }
    });

    const newCanonical = newDoc.head.querySelector('link[rel="canonical"]');
    let curCanonical = document.head.querySelector('link[rel="canonical"]');
    if (newCanonical) {
      if (!curCanonical) {
        curCanonical = document.createElement('link');
        curCanonical.setAttribute('rel', 'canonical');
        document.head.appendChild(curCanonical);
      }
      curCanonical.setAttribute('href', newCanonical.getAttribute('href') || '');
    } else if (curCanonical) {
      curCanonical.remove();
    }
  }

  function runCurrentPageCleanup() {
    if (typeof window.cleanupIndexPage === 'function') window.cleanupIndexPage();
    if (typeof window.cleanupBlogPage === 'function') window.cleanupBlogPage();
    if (typeof window.cleanupZelynnPage === 'function') window.cleanupZelynnPage();
    if (typeof window.cleanupAboutMePage === 'function') window.cleanupAboutMePage();
    if (typeof window.cleanupMomentsPage === 'function') window.cleanupMomentsPage();
    if (typeof window.cleanupPageComments === 'function') window.cleanupPageComments();

    document.body.classList.remove('hero-open');
    document.querySelectorAll('.hero-overlay').forEach(el => el.remove());
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.documentElement.classList.remove('viewer-open');
    if (!window.globalModal || !window.globalModal.isScrollLocked) {
      document.documentElement.style.removeProperty('--scrollbar-compensate');
    }
  }

  function runCurrentPageInit() {
    if (typeof window.updateGreeting === 'function') window.updateGreeting();
    if (typeof initSegmentedControls === 'function') initSegmentedControls();

    const bodyId = document.body.id;
    if (bodyId === 'index-page') {
      if (typeof window.initIndexPage === 'function') window.initIndexPage();
    } else if (bodyId === 'blog-page') {
      if (typeof initBlog === 'function') initBlog();
    } else if (bodyId === 'zelynn-page') {
      if (typeof window.initZelynnPage === 'function') window.initZelynnPage();
    } else if (document.getElementById('scroll-sequence')) {
      if (typeof window.initAboutMePage === 'function') window.initAboutMePage();
    } else if (bodyId === 'friendlink-page') {
      if (typeof window.initFriendLinks === 'function') window.initFriendLinks();
      if (typeof window.initPageComments === 'function') window.initPageComments('friendlink-comments', 'friendlink');
    } else if (bodyId === 'moments-page') {
      if (typeof window.initMomentsPage === 'function') window.initMomentsPage();
    } else if (bodyId === 'playlist-page') {
      if (typeof window.initPlaylistPage === 'function') window.initPlaylistPage();
    } else if (bodyId === 'login-page') {
      if (typeof window.initLoginPage === 'function') window.initLoginPage();
    } else if (bodyId === 'account-page') {
      if (typeof window.initProfilePage === 'function') window.initProfilePage();
    } else if (bodyId === 'error-page') {
      const pathEl = document.getElementById('error-path');
      if (pathEl) pathEl.textContent = window.location.pathname;
    }

    if (typeof window.refreshScrollAnimations === 'function') {
      window.refreshScrollAnimations(false);
    }
    window.dispatchEvent(new Event('resize'));
  }

  let currentNormalizedPath = normalizePathname(window.location.pathname);
  let navSequenceId = 0;

  window.navigateTo = async function(url, options = {}) {
    if (!url) return;
    const { replace = false, isPopState = false } = options;

    let targetUrl;
    try {
      targetUrl = new URL(url, window.location.href);
    } catch (e) {
      window.location.href = url;
      return;
    }

    if (targetUrl.origin !== window.location.origin) {
      window.location.href = url;
      return;
    }

    const nextNormalizedPath = normalizePathname(targetUrl.pathname);

    // 关闭所有打开的浮层菜单
    if (typeof closeMoreMenu === 'function') closeMoreMenu();
    if (typeof closeNotifyMenu === 'function') closeNotifyMenu();
    if (typeof window.closeMobileMoreMenu === 'function') window.closeMobileMoreMenu();

    // 关闭可能打开的全局弹窗 (例如从设置弹窗跳转协议/帮助页)
    const globalModal = document.querySelector('global-modal');
    if (globalModal && typeof globalModal.closeAll === 'function') {
      globalModal.closeAll();
    }

    // 同页面路由处理（例如重复点击当前导航项、同页锚点、或博客文章返回列表）
    if (!isPopState && nextNormalizedPath === currentNormalizedPath) {
      if (document.body.id === 'blog-page') {
        if (!targetUrl.search && window.location.search && typeof window.closeBlogPostToList === 'function') {
          window.closeBlogPostToList();
          return;
        }
        if (targetUrl.search !== window.location.search && typeof window.handleBlogPopState === 'function') {
          if (replace) {
            history.replaceState({ spa: true }, '', targetUrl.href);
          } else {
            history.pushState({ spa: true }, '', targetUrl.href);
          }
          window.handleBlogPopState({ state: history.state });
          return;
        }
      }

      if (targetUrl.search === window.location.search) {
        if (targetUrl.hash) {
          const hashEl = document.querySelector(targetUrl.hash);
          if (hashEl) hashEl.scrollIntoView({ behavior: 'smooth' });
          if (targetUrl.hash !== window.location.hash) {
            history.pushState({ spa: true }, '', targetUrl.href);
          }
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
    }

    const myNavId = ++navSequenceId;
    ensureShellElements();
    const loader = ensureLoadingOverlay();
    loader.classList.add("show");

    // 保存离开前的滚动位置到当前 history state
    if (!isPopState) {
      try {
        history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, '');
      } catch (e) {}
    }

    try {
      const minDelayPromise = new Promise(r => setTimeout(r, isPopState ? 0 : 140));
      const fetchPage = async () => {
        let res = await fetch(targetUrl.href, { headers: { 'X-Requested-With': 'SatinAu-SPA' } });
        // 若无扩展名路径在本地静态服务器返回 404，自动尝试补充 .html
        if (res.status === 404 && !targetUrl.pathname.endsWith('/') && !targetUrl.pathname.endsWith('.html') && !targetUrl.pathname.includes('.')) {
          const htmlFallbackUrl = new URL(targetUrl.href);
          htmlFallbackUrl.pathname = targetUrl.pathname + '.html';
          const fallbackRes = await fetch(htmlFallbackUrl.href);
          if (fallbackRes.ok) {
            res = fallbackRes;
          }
        }
        return res;
      };

      const [res] = await Promise.all([fetchPage(), minDelayPromise]);
      if (myNavId !== navSequenceId) return;

      const contentType = res.headers.get('content-type') || '';
      let htmlText = '';

      if (res.status === 404) {
        const text404 = await res.text();
        if (text404.includes('<main class="page">')) {
          htmlText = text404;
        } else {
          const custom404Res = await fetch('/404.html');
          if (custom404Res.ok) {
            htmlText = await custom404Res.text();
          } else {
            window.location.href = targetUrl.href;
            return;
          }
        }
      } else if (!res.ok || !contentType.includes('text/html')) {
        window.location.href = targetUrl.href;
        return;
      } else {
        htmlText = await res.text();
      }

      if (myNavId !== navSequenceId) return;

      // 1. 先更新地址栏 URL，确保 DOMParser 及后续相对路径都基于新页面路径解析
      if (!isPopState) {
        if (replace) {
          history.replaceState({ spa: true }, '', targetUrl.href);
        } else {
          history.pushState({ spa: true }, '', targetUrl.href);
        }
      }
      currentNormalizedPath = normalizePathname(window.location.pathname);

      // 2. 解析新页面 HTML
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(htmlText, 'text/html');
      const newMain = newDoc.querySelector('main.page');
      const currentMain = document.querySelector('main.page');

      if (!newMain || !currentMain) {
        window.location.href = targetUrl.href;
        return;
      }

      // 3. 清理旧页面状态与定时器
      runCurrentPageCleanup();

      // 4. 同步 <head> 元信息、外部样式表与页面专属内联 <style>
      syncHeadMetadata(newDoc);

      const styleSheetPromises = [];
      newDoc.head.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          styleSheetPromises.push(loadExternalStylesheet(href, targetUrl.href));
        }
      });
      if (styleSheetPromises.length > 0) {
        await Promise.all(styleSheetPromises);
      }
      if (myNavId !== navSequenceId) return;

      document.head.querySelectorAll('style[data-pjax-page-style="true"]').forEach(s => s.remove());
      newDoc.head.querySelectorAll('style').forEach(s => {
        const clone = s.cloneNode(true);
        clone.setAttribute('data-pjax-page-style', 'true');
        document.head.appendChild(clone);
      });

      // 5. 同步 <body> ID
      document.body.id = newDoc.body.id || '';

      // 6. 预先调整滚动位置，保证新 DOM 挂载时滚动进度计算准确
      const savedScrollY = isPopState && history.state && typeof history.state.scrollY === 'number'
        ? history.state.scrollY
        : 0;
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });

      // 7. 替换 #scroll-sequence（仅 aboutme 页面有）与 <main class="page">
      const oldScrollSeq = document.getElementById('scroll-sequence');
      if (oldScrollSeq) oldScrollSeq.remove();

      const newScrollSeq = newDoc.getElementById('scroll-sequence');
      const adoptedMain = document.adoptNode(newMain);
      // 移除 main 内部重复的组件脚本标签，避免重复注册 customElements 报错
      adoptedMain.querySelectorAll('script[src]').forEach(s => s.remove());

      currentMain.replaceWith(adoptedMain);
      if (newScrollSeq) {
        const adoptedSeq = document.adoptNode(newScrollSeq);
        adoptedMain.parentNode.insertBefore(adoptedSeq, adoptedMain);
      }

      // 8. 同步导航栏显示与激活状态
      const hasNavInNewDoc = !!newDoc.querySelector('navigate-bar');
      let navBar = document.querySelector('navigate-bar');
      if (hasNavInNewDoc) {
        if (!navBar) {
          await loadExternalScript('/src/script/components/navigate.js', targetUrl.href);
          navBar = document.createElement('navigate-bar');
          document.body.appendChild(navBar);
          if (typeof window.initMobileMoreMenu === 'function') window.initMobileMoreMenu();
          if (typeof window.renderNoticeCenter === 'function') window.renderNoticeCenter();
        } else {
          navBar.style.display = '';
          if (typeof navBar.updateActiveState === 'function') {
            navBar.updateActiveState();
          }
        }
      } else if (navBar) {
        navBar.style.display = 'none';
      }

      // 9. 按顺序加载新页面所需的外部脚本
      const scriptsToLoad = [];
      newDoc.querySelectorAll('script[src]').forEach(s => {
        const src = s.getAttribute('src');
        if (src && !isIgnoredThirdPartyScript(src)) {
          scriptsToLoad.push(src);
        }
      });
      for (const src of scriptsToLoad) {
        await loadExternalScript(src, targetUrl.href);
      }
      if (myNavId !== navSequenceId) return;

      if (typeof window.syncViewerOpenToHtml === 'function') {
        window.syncViewerOpenToHtml();
      }

      // 10. 执行新页面中的内联脚本（排除统计与 Cookie 横幅脚本）
      newDoc.querySelectorAll('script:not([src])').forEach(inlineScript => {
        const type = inlineScript.getAttribute('type') || '';
        if (type === 'text/plain') return;
        const code = inlineScript.textContent || '';
        if (!code.trim() || code.includes('cookieconsent.run') || code.includes('clarity')) return;
        try {
          const tempScript = document.createElement('script');
          tempScript.textContent = code;
          document.body.appendChild(tempScript);
          tempScript.remove();
        } catch (e) {
          console.warn('Inline script execution warning:', e);
        }
      });

      // 11. 移除路由层加载动画并执行页面级初始化（若页面自身有异步加载如 blog/moments，会在其 init 中再次开启 loadingOverlay）
      loader.classList.remove("show");
      runCurrentPageInit();

      // 若 URL 带有 hash，滚动到对应锚点
      if (!isPopState && targetUrl.hash) {
        const hashEl = document.querySelector(targetUrl.hash);
        if (hashEl) {
          requestAnimationFrame(() => hashEl.scrollIntoView({ behavior: 'smooth' }));
        }
      }
    } catch (err) {
      console.error('SPA Navigation failed, falling back to full load:', err);
      window.location.href = targetUrl.href;
    }
  };

  // 兼容 404.html 中的 spaNavigate 调用
  window.spaNavigate = window.navigateTo;

  // 监听浏览器前进/后退
  window.addEventListener("popstate", function(event) {
    const nextNormalizedPath = normalizePathname(window.location.pathname);
    if (nextNormalizedPath === currentNormalizedPath) {
      if (document.body.id === 'blog-page' && typeof window.handleBlogPopState === 'function') {
        window.handleBlogPopState(event);
      }
      return;
    }
    window.navigateTo(window.location.href, { isPopState: true });
  });

  // 拦截站内链接点击统一触发无刷路由
  document.addEventListener("click", function(e) {
    const link = e.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
      e.defaultPrevented
    ) {
      return;
    }

    try {
      const targetUrl = new URL(link.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;
      if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search && targetUrl.hash) return;
    } catch (err) {
      return;
    }

    e.preventDefault();
    window.navigateTo(link.href);
  });

  // 浏览器从前进/后退缓存 (bfcache) 恢复时隐藏加载动画
  window.addEventListener("pageshow", function(e) {
    const loader = document.getElementById("loadingOverlay");
    if (loader) {
      if (e.persisted || document.body.id !== "blog-page") {
        loader.classList.remove("show");
      }
    }
  });
})();

// 更多菜单与通知菜单控制 (桌面端)
let moreMenuVisible = false;
let notifyMenuVisible = false;

function closeMoreMenu() {
  const dropdown = document.querySelector('.more-dropdown');
  if (dropdown) dropdown.classList.remove('show');
  moreMenuVisible = false;
}

function closeNotifyMenu() {
  const dropdown = document.querySelector('.notify-dropdown');
  const btn = document.querySelector('.notify-btn');
  if (dropdown) dropdown.classList.remove('show');
  if (btn) btn.classList.remove('active');
  const hadUnread = document.querySelector('.notify-dropdown .nav-notice-item.unread');
  notifyMenuVisible = false;
  if (hadUnread && typeof window.renderNoticeCenter === 'function') {
    setTimeout(() => {
      if (!notifyMenuVisible) window.renderNoticeCenter();
    }, 300);
  }
}

function toggleMoreMenu() {
  const dropdown = document.querySelector('.more-dropdown');
  if (dropdown) {
    if (!moreMenuVisible && notifyMenuVisible) {
      closeNotifyMenu();
    }
    moreMenuVisible = !moreMenuVisible;
    dropdown.classList.toggle('show', moreMenuVisible);
  }
}

function toggleNotifyMenu() {
  const dropdown = document.querySelector('.notify-dropdown');
  const btn = document.querySelector('.notify-btn');
  if (dropdown) {
    if (!notifyMenuVisible && moreMenuVisible) {
      closeMoreMenu();
    }
    notifyMenuVisible = !notifyMenuVisible;
    dropdown.classList.toggle('show', notifyMenuVisible);
    if (btn) btn.classList.toggle('active', notifyMenuVisible);
    if (notifyMenuVisible && typeof window.markAllNoticesRead === 'function') {
      window.markAllNoticesRead();
    } else if (!notifyMenuVisible && typeof window.renderNoticeCenter === 'function') {
      setTimeout(() => {
        if (!notifyMenuVisible) window.renderNoticeCenter();
      }, 300);
    }
  }
}

// 点击其他区域关闭菜单
document.addEventListener('click', function(e) {
  const moreContainer = document.querySelector('.more-menu-container');
  if (moreMenuVisible && moreContainer && !moreContainer.contains(e.target)) {
    closeMoreMenu();
  }
  const notifyContainer = document.querySelector('.notify-menu-container');
  if (notifyMenuVisible && notifyContainer && !notifyContainer.contains(e.target)) {
    closeNotifyMenu();
  }
});

// 动态问候语
window.updateGreeting = function() {
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
};
window.updateGreeting();

// 控制台输出（仅首次加载输出一次）
let hasPrintedConsoleBanner = false;
function consoleBeautify() {
  if (hasPrintedConsoleBanner) return;
  hasPrintedConsoleBanner = true;
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
    "%c问题反馈请前往https://github.com/SatinAu-Zelynn/SatinAu-Website-Classic/issues/",
    "color: #FF9999; font-style: italic;"
  );
}

// 页面加载完成后执行
window.addEventListener('load', consoleBeautify);

window.initMobileMoreMenu = function() {
  // === 重构：移动端一体式下拉菜单（双页左右平移：更多菜单 + 通知中心）初始化 ===
  const desktopDropdown = document.querySelector('.more-dropdown');
  const bottomNav = document.querySelector('.bottom-nav');
  
  if (desktopDropdown && bottomNav && !bottomNav.querySelector('.mobile-more-menu')) {
    // 融入底栏的构建
    const mobileMenuWrapper = document.createElement('div');
    mobileMenuWrapper.className = 'mobile-more-menu';

    const viewport = document.createElement('div');
    viewport.className = 'mobile-menu-viewport';

    const menuTrack = document.createElement('div');
    menuTrack.className = 'mobile-menu-track';

    // 第一页（左页，默认打开）：更多菜单
    const pageMore = document.createElement('div');
    pageMore.className = 'mobile-menu-page mobile-page-more';
    const innerContent = document.createElement('div');
    innerContent.className = 'mobile-menu-inner';
    innerContent.innerHTML = desktopDropdown.innerHTML;
    pageMore.appendChild(innerContent);

    // 第二页（右页）：通知中心
    const pageNotify = document.createElement('div');
    pageNotify.className = 'mobile-menu-page mobile-page-notify';
    const notifyInner = document.createElement('div');
    notifyInner.className = 'mobile-notify-inner';
    notifyInner.innerHTML = `
      <div class="notify-dropdown-header mobile-notify-header">
        <span class="notify-dropdown-title">通知中心</span>
        <span class="notify-mark-read" onclick="if(window.markAllNoticesRead) window.markAllNoticesRead(event)">全部已读</span>
      </div>
      <div class="notify-dropdown-body mobile-notify-list" id="mobileNotifyList">
        <div class="notify-empty-tip">正在加载公告...</div>
      </div>
    `;
    pageNotify.appendChild(notifyInner);

    menuTrack.appendChild(pageMore);
    menuTrack.appendChild(pageNotify);
    viewport.appendChild(menuTrack);

    // 底部双页指示点
    const paginationEl = document.createElement('div');
    paginationEl.className = 'mobile-menu-pagination';
    paginationEl.innerHTML = `
      <span class="mobile-page-dot active" data-page="0" aria-label="更多菜单"></span>
      <span class="mobile-page-dot" data-page="1" aria-label="通知中心">
        <i class="notify-badge mobile-dot-badge" id="mobileNotifyBadge"></i>
      </span>
    `;

    mobileMenuWrapper.appendChild(viewport);
    mobileMenuWrapper.appendChild(paginationEl);
    bottomNav.prepend(mobileMenuWrapper); // 插至最前
    
    const navLinks = bottomNav.querySelectorAll('a:not(.dropdown-item)'); 
    let startX = 0, startY = 0, currentX = 0, currentY = 0;
    let isDragging = false, isMenuOpen = false, isNavLinkTouched = false;
    let gestureMode = null; // null | 'vertical' | 'horizontal' | 'scroll'
    let currentPage = 0; // 0: 更多菜单(左页), 1: 通知中心(右页)
    let maxMenuHeight = 0, currentHeight = 0, touchStartTime = 0;
    let didMoveSignificantly = false;
    
    // 同步通知页高度与更多菜单页一致，保持左右平移高度稳定
    function syncNotifyPageHeight() {
      const moreH = innerContent.offsetHeight;
      if (moreH > 0) {
        notifyInner.style.height = `${moreH}px`;
      }
    }

    // 获取实际内容的精准高度
    function getMenuMaxHeight() {
      syncNotifyPageHeight();
      const paginationH = paginationEl.offsetHeight || 18;
      return innerContent.offsetHeight + paginationH;
    }

    // 切换移动端双页 (0: 更多菜单, 1: 通知中心)
    function switchMobileMenuPage(pageIdx, animate = true) {
      const prevPage = currentPage;
      currentPage = pageIdx === 1 ? 1 : 0;
      if (animate) {
        menuTrack.style.transition = 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';
      } else {
        menuTrack.style.transition = 'none';
      }
      menuTrack.style.transform = currentPage === 1 ? 'translateX(-50%)' : 'translateX(0%)';
      paginationEl.querySelectorAll('.mobile-page-dot').forEach(dot => {
        dot.classList.toggle('active', parseInt(dot.dataset.page, 10) === currentPage);
      });
      if (currentPage === 1 && typeof window.markAllNoticesRead === 'function') {
        window.markAllNoticesRead();
      } else if (prevPage === 1 && currentPage === 0 && typeof window.renderNoticeCenter === 'function') {
        setTimeout(() => {
          if (currentPage === 0) window.renderNoticeCenter();
        }, 300);
      }
    }

    // 点击分页指示点切换页面
    paginationEl.querySelectorAll('.mobile-page-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetPage = parseInt(dot.dataset.page, 10);
        switchMobileMenuPage(targetPage, true);
      });
    });

    // 拦截拖拽释放后的误触点击
    mobileMenuWrapper.addEventListener('click', function(e) {
      if (didMoveSignificantly) {
        e.preventDefault();
        e.stopPropagation();
        didMoveSignificantly = false;
      }
    }, true);

    // 区分日常点击与误判
    navLinks.forEach(link => {
      link.addEventListener('touchstart', () => { isNavLinkTouched = true; }, { passive: true });
      link.addEventListener('touchend', () => { setTimeout(() => isNavLinkTouched = false, 100); });
    });
    
    // 手势开始
    bottomNav.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      // 菜单未展开时，释放按钮原生交互
      if (!isMenuOpen && (e.target.closest('.dropdown-item') || e.target.closest('button'))) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = startX;
      currentY = startY;
      isDragging = true;
      gestureMode = null;
      didMoveSignificantly = false;
      isNavLinkTouched = false;
      touchStartTime = Date.now();
      
      maxMenuHeight = getMenuMaxHeight();
      currentHeight = isMenuOpen ? maxMenuHeight : 0;
    }, { passive: false });
    
    // 手指滑动 (实时反馈：纵向抽拉展开/收起 + 展开后横向双页平移)
    bottomNav.addEventListener('touchmove', function(e) {
      if (!isDragging || e.touches.length !== 1) return;
      
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
      const diffX = currentX - startX; // 向右划为正，向左划为负
      const diffY = startY - currentY; // 向上划为正，向下划为负

      if (!gestureMode) {
        if (Math.abs(diffX) < 6 && Math.abs(diffY) < 6) return;
        didMoveSignificantly = true;

        // 菜单已展开且横向位移主导时，触发内部双页左右平移
        if (isMenuOpen && Math.abs(diffX) > Math.abs(diffY)) {
          gestureMode = 'horizontal';
          menuTrack.style.transition = 'none';
          bottomNav.classList.add('is-dragging');
        } else {
          // 若当前在通知页且手指在通知列表内纵向滑动，优先允许列表内部滚动
          const scrollList = e.target.closest('.mobile-notify-list');
          if (isMenuOpen && currentPage === 1 && scrollList && scrollList.scrollHeight > scrollList.clientHeight) {
            const atTop = scrollList.scrollTop <= 0;
            const atBottom = scrollList.scrollTop + scrollList.clientHeight >= scrollList.scrollHeight - 1;
            if ((diffY > 0 && !atBottom) || (diffY < 0 && !atTop)) {
              gestureMode = 'scroll';
              return;
            }
          }
          gestureMode = 'vertical';
          mobileMenuWrapper.style.transition = 'none';
          bottomNav.classList.add('is-dragging');
        }
      }

      if (gestureMode === 'scroll') {
        return;
      }

      if (gestureMode === 'horizontal') {
        e.preventDefault();
        const pageWidth = viewport.offsetWidth || bottomNav.offsetWidth || 300;
        let targetOffset;
        if (currentPage === 0) {
          // 在左页（更多菜单）时，支持右滑或左滑平滑过渡至右页（通知中心）
          const moveDist = Math.abs(diffX);
          if (moveDist <= pageWidth) {
            targetOffset = -moveDist;
          } else {
            targetOffset = -pageWidth - (moveDist - pageWidth) * 0.2;
          }
        } else {
          // 在右页（通知中心）时，滑动平滑返回左页（更多菜单）
          const moveDist = Math.abs(diffX);
          if (moveDist <= pageWidth) {
            targetOffset = -pageWidth + moveDist;
          } else {
            targetOffset = (moveDist - pageWidth) * 0.2;
          }
        }
        menuTrack.style.transform = `translateX(${targetOffset}px)`;
        return;
      }
      
      if (gestureMode === 'vertical') {
        let newHeight = currentHeight + diffY;
        
        if (newHeight < 0) {
          newHeight = 0; // 收底硬锁死
        } else if (newHeight > maxMenuHeight) {
          const over = newHeight - maxMenuHeight;
          newHeight = maxMenuHeight + over * 0.2; // 抽拉过头时的顶部物理阻尼
        }
        
        if (Math.abs(diffY) > 5) e.preventDefault(); // 阻断页面本体滑动乱跳
        
        if (newHeight >= 0) {
          mobileMenuWrapper.style.height = `${newHeight}px`;
          mobileMenuWrapper.style.opacity = Math.min(newHeight / (maxMenuHeight * 0.8), 1);
        }
      }
    }, { passive: false });
    
    function openMenu() {
      isMenuOpen = true;
      maxMenuHeight = getMenuMaxHeight();
      mobileMenuWrapper.style.height = `${maxMenuHeight}px`;
      mobileMenuWrapper.style.opacity = '1';
      bottomNav.classList.add('menu-open');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      isMenuOpen = false;
      mobileMenuWrapper.style.height = '0px';
      mobileMenuWrapper.style.opacity = '0';
      bottomNav.classList.remove('menu-open');
      document.body.style.overflow = '';
      setTimeout(() => {
        if (!isMenuOpen) {
          switchMobileMenuPage(0, false);
        }
      }, 400);
    }

    window.closeMobileMoreMenu = closeMenu;

    // 释放判断 (回弹动画)
    bottomNav.addEventListener('touchend', function() {
      if (!isDragging) return;
      isDragging = false;
      bottomNav.classList.remove('is-dragging');

      const touchDuration = Math.max(Date.now() - touchStartTime, 1);

      if (gestureMode === 'scroll') {
        gestureMode = null;
        return;
      }

      if (gestureMode === 'horizontal') {
        const diffX = currentX - startX;
        const pageWidth = viewport.offsetWidth || bottomNav.offsetWidth || 300;
        const velocityX = Math.abs(diffX) / touchDuration;
        const shouldSwitch = Math.abs(diffX) > pageWidth / 4 || velocityX > 0.35;

        if (shouldSwitch) {
          switchMobileMenuPage(currentPage === 0 ? 1 : 0, true);
        } else {
          switchMobileMenuPage(currentPage, true);
        }
        gestureMode = null;
        return;
      }
      
      const diff = startY - currentY;
      const velocity = diff / touchDuration; // 滑动速率判断
      
      let shouldOpen = isMenuOpen;
      
      if (!isMenuOpen) {
        if (velocity > 0.4 || diff > maxMenuHeight / 3) shouldOpen = true; 
      } else {
        if (velocity < -0.4 || diff < -maxMenuHeight / 3) shouldOpen = false;
      }
      
      // 容错：当成极其快速的小点击时放弃手势接管
      if (Math.abs(diff) < 10 && touchDuration < 200) {
        shouldOpen = isMenuOpen;
      }
      
      mobileMenuWrapper.style.transition = '';
      void mobileMenuWrapper.offsetHeight;
      
      if (shouldOpen && !isNavLinkTouched) {
        openMenu();
      } else {
        closeMenu();
      }
      gestureMode = null;
    });
    
    // 点击非底栏区域时自动关合
    document.addEventListener('click', function(e) {
      if (isMenuOpen && !bottomNav.contains(e.target)) closeMenu();
    });
    
    // 菜单内子链接控制
    mobileMenuWrapper.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (didMoveSignificantly) return;
        const targetUrl = this.getAttribute('href');
        // 排除脚本执行类链接或空锚点（如网站设置弹窗）
        if (targetUrl && !targetUrl.startsWith('javascript:') && !targetUrl.startsWith('#')) {
          const isExternal = this.target === '_blank' || targetUrl.startsWith('http');
          if (!isExternal) {
            e.preventDefault();
            closeMenu();
            window.navigateTo(targetUrl);
            return;
          }
        }
        closeMenu();
      });
    });

    // 若公告数据已就绪，立即渲染到移动端通知列表
    if (typeof window.renderNoticeCenter === 'function') {
      window.renderNoticeCenter();
    }
  }

  // 初始化原生通知开关状态
  const notifyToggle = document.getElementById('nativeNotificationToggle');
  if (notifyToggle) {
    // 只有当 localStorage 为 true 且 浏览器权限确实为 granted 时，UI才显示开启
    // 这样如果用户在浏览器层面清理了权限，网页开关也会自动变回关闭
    notifyToggle.checked = isNativeNotificationEnabled();
  }
};

document.addEventListener('DOMContentLoaded', window.initMobileMoreMenu);

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
    const l2dToggle = document.getElementById('live2dToggle');
    if (l2dToggle) {
      l2dToggle.checked = isLive2DEnabled();
    }

    const settingsToggle = document.getElementById('performanceModeToggle');

    if (settingsToggle) {
        settingsToggle.checked = isPerformanceMode();
    }

    if (isPerformanceMode()) {
        enablePerformanceCss();
    }
});

/* ========== 下拉菜单通用逻辑 ========== */
const FONT_KEY = 'setting_font_mode';

// 1. 初始化逻辑 (页面加载时执行)
document.addEventListener('DOMContentLoaded', () => {
  // --- 字体选择器初始化 ---
  const fontWrapper = document.getElementById('fontSelectComponent');
  if (fontWrapper) {
    initCustomSelect(fontWrapper, FONT_KEY, (mode) => {
      applyFontMode(mode);
      showToast(`字体已切换`);
    });
  } else {
    // 如果不在设置页，仅应用字体
    const savedMode = localStorage.getItem(FONT_KEY) || 'sans';
    applyFontMode(savedMode);
  }
});

// 2. 通用自定义 Select 组件初始化
function initCustomSelect(wrapper, storageKey, callback) {
  const trigger = wrapper.querySelector('.custom-select-trigger');
  const triggerText = wrapper.querySelector('.selected-value');
  const options = wrapper.querySelectorAll('.custom-option');
  
  // 读取当前设置
  const savedValue = localStorage.getItem(storageKey); 

  // 更新 UI 显示状态
  let found = false;
  options.forEach(opt => {
    // 如果有保存的值，按保存的值选中
    if (savedValue && opt.dataset.value === savedValue) {
      opt.classList.add('selected');
      triggerText.textContent = opt.textContent;
      found = true;
    } else if (!savedValue) {
      // 如果没有保存的值，保持 HTML 中默认的 selected 类不做变动
      // 但需要移除其他项的 selected (防止 HTML 结构错误)
      if (!opt.classList.contains('selected')) {
        opt.classList.remove('selected');
      }
    } else {
      // 有保存值但当前项不匹配
      opt.classList.remove('selected');
    }
  });

  // 如果没有找到匹配项且没有保存值，确保 triggerText 显示默认选中的文本
  if (!found && !savedValue) {
    const defaultSel = wrapper.querySelector('.custom-option.selected');
    if(defaultSel) triggerText.textContent = defaultSel.textContent;
  }

  // 点击触发器：切换开关
  trigger.addEventListener('click', (e) => {
    e.stopPropagation(); 
    wrapper.classList.toggle('open');
  });

  // 点击选项
  options.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      
      options.forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      triggerText.textContent = option.textContent;
      wrapper.classList.remove('open');
      
      const val = option.dataset.value;
      localStorage.setItem(storageKey, val);
      
      if (typeof callback === 'function') {
        callback(val);
      }
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
    root.style.setProperty('--font-variation', 'normal');
  } else if (mode === 'system') {
    // 应用系统字体变量
    root.style.setProperty('--global-font', 'var(--font-system)');
    root.style.setProperty('--font-variation', 'normal');
  } else {
    // 默认为 sans
    root.style.setProperty('--global-font', 'var(--font-sans)');
    root.style.setProperty('--font-variation', "'ROND' 100");
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

/* ========== 统一通知系统逻辑 (Native + In-App) ========== */
const NATIVE_NOTIFY_KEY = 'setting_native_notifications_enabled';

// 判断是否可以使用原生通知 (设置开启且浏览器已授权)
function isNativeNotificationEnabled() {
  const setting = localStorage.getItem(NATIVE_NOTIFY_KEY);
  return setting === 'true' && ("Notification" in window) && Notification.permission === 'granted';
}

// 发送原生通知的底层函数
function _sendNativeImplementation(title, options = {}, url = null) {
  const defaultOptions = {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    ...options
  };

  try {
    const notification = new Notification(title, defaultOptions);
    notification.onclick = function(event) {
      event.preventDefault();
      notification.close();
      if (url) {
        window.open(url, '_blank');
      } else {
        window.focus();
      }
    };
  } catch (e) {
    console.warn("发送原生通知失败:", e);
  }
}

// 发送应用内通知 (In-App) 的底层函数
function _sendInAppImplementation(title, options = {}, url = null) {
  // 查找或创建容器
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  // 创建卡片
  const card = document.createElement('div');
  card.className = 'satin-notify-card'; // 初始状态在 CSS 中定义为 max-height: 0
  
  // 默认图标
  const iconSrc = options.icon || '/favicon.ico';
  
  card.innerHTML = `
    <img src="${iconSrc}" class="notify-icon" alt="icon">
    <div class="notify-content">
      <div class="notify-title">${title}</div>
      <div class="notify-body">${options.body || ''}</div>
    </div>
    <button class="notify-close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  // 点击主体跳转
  if (url) {
    card.style.cursor = 'pointer';
    const content = card.querySelector('.notify-content');
    content.addEventListener('click', () => {
       window.open(url, '_blank');
       closeCard();
    });
  }

  // 关闭逻辑
  const closeBtn = card.querySelector('.notify-close');
  const closeCard = () => {
    // 移除 show 类，添加 hiding 类，触发 CSS 中的折叠动画
    card.classList.remove('show');
    card.classList.add('hiding');
    
    // 等待动画结束后从 DOM 移除
    card.addEventListener('transitionend', (e) => {
      // 确保只在 max-height 动画结束时移除，或者任意一个结束均可
      if (e.propertyName === 'max-height' && card.parentElement) {
        card.remove();
      }
    });
    // 设置一个超时移除，防止 transitionend 不触发
    setTimeout(() => {
      if(card.parentElement) card.remove();
    }, 500);
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCard();
  });

  // 插入到容器最前面
  container.prepend(card);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      card.classList.add('show');
    });
  });

  // 自动消失 (5秒)
  if (!options.requireInteraction) {
    setTimeout(closeCard, 5000);
  }
}

// 统一对外接口：根据设置决定发送方式
window.pushNotification = function(title, options = {}, url = null) {
  if (isNativeNotificationEnabled()) {
    _sendNativeImplementation(title, options, url);
  } else {
    _sendInAppImplementation(title, options, url);
  }
};

// 兼容旧代码调用 (如果有其他地方用了 sendNativeNotification)
window.sendNativeNotification = window.pushNotification;


// 切换开关（供 settings.html 调用）
window.toggleNativeNotifications = function() {
  const checkbox = document.getElementById('nativeNotificationToggle');
  const wantEnabled = checkbox.checked;

  if (wantEnabled) {
    // 尝试开启原生
    if (!("Notification" in window)) {
      showToast("您的浏览器不支持原生通知");
      checkbox.checked = false;
      return;
    }

    if (Notification.permission === "granted") {
      localStorage.setItem(NATIVE_NOTIFY_KEY, 'true');
      showToast("系统原生通知：已启用");
      pushNotification("通知模式已切换", { body: "现在您将收到系统级推送通知。" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          localStorage.setItem(NATIVE_NOTIFY_KEY, 'true');
          showToast("系统原生通知：授权成功");
          pushNotification("通知模式已切换", { body: "现在您将收到系统级推送通知。" });
        } else {
          checkbox.checked = false;
          showToast("授权被拒绝");
        }
      });
    } else {
      checkbox.checked = false;
      showToast("权限曾被拒绝，请在浏览器设置中允许");
    }
  } else {
    // 关闭原生 -> 转为 In-App 模式
    localStorage.setItem(NATIVE_NOTIFY_KEY, 'false');
    showToast("系统原生通知：已禁用 (已切换为应用内通知)");
    // 立即测试一条 In-App
    setTimeout(() => {
        pushNotification("通知模式已切换", { body: "现在您将收到网站内悬浮通知。" });
    }, 500);
  }
};

/* ========== 站点公告与通知中心集成逻辑 ========== */
const LAST_PUSHED_NOTICE_ID_KEY = 'last_processed_notice_id';
const LAST_READ_NOTICE_ID_KEY = 'last_read_notice_id';
window.siteNoticesData = [];
window.siteNoticesLoadError = false;

window.markAllNoticesRead = function(event = null) {
  if (event) event.stopPropagation();

  let maxId = parseInt(localStorage.getItem(LAST_READ_NOTICE_ID_KEY) || '0', 10);
  (window.siteNoticesData || []).forEach((n, idx) => {
    const cid = parseInt(n.id, 10) || (idx + 1);
    if (cid > maxId) maxId = cid;
  });
  localStorage.setItem(LAST_READ_NOTICE_ID_KEY, String(maxId));

  // 移除导航栏与分页点的未读红点
  document.querySelectorAll('.notify-badge').forEach(badge => badge.classList.remove('show'));
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.classList.remove('has-unread-notice');

  // 若是手动点击“全部已读”，立即移除列表内各条目的未读标记并提示
  if (event) {
    document.querySelectorAll('.nav-notice-item.unread').forEach(el => el.classList.remove('unread'));
    document.querySelectorAll('.nav-notice-unread-dot').forEach(el => el.remove());
    if (typeof showToast === 'function') showToast('已全部标为已读');
  }
};

window.renderNoticeCenter = function() {
  const desktopList = document.getElementById('desktopNotifyList');
  const mobileList = document.getElementById('mobileNotifyList');
  const notices = Array.isArray(window.siteNoticesData) ? window.siteNoticesData : [];
  const lastReadId = parseInt(localStorage.getItem(LAST_READ_NOTICE_ID_KEY) || '0', 10);

  if (window.siteNoticesLoadError && notices.length === 0) {
    const errHtmlDesktop = `<div class="notify-empty-tip notify-retry notify-stagger-item" onclick="if(window.refreshSiteNotices) window.refreshSiteNotices()">公告加载失败，点击重试</div>`;
    const errHtmlMobile = `<div class="notify-empty-tip notify-retry" onclick="if(window.refreshSiteNotices) window.refreshSiteNotices()">公告加载失败，点击重试</div>`;
    if (desktopList) desktopList.innerHTML = errHtmlDesktop;
    if (mobileList) mobileList.innerHTML = errHtmlMobile;
    return;
  }

  const activeNotices = notices.filter(item => item && item.active);
  const historyNotices = notices.filter(item => item && !item.active);

  let hasUnread = false;
  notices.forEach((item, idx) => {
    const cid = parseInt(item.id, 10) || (idx + 1);
    if (cid > lastReadId) {
      hasUnread = true;
    }
  });

  // 同步未读红点状态
  document.querySelectorAll('.notify-badge').forEach(badge => {
    badge.classList.toggle('show', hasUnread);
  });
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.classList.toggle('has-unread-notice', hasUnread);

  const buildListHtml = (isDesktop) => {
    const stagger = isDesktop ? 'notify-stagger-item' : '';
    if (activeNotices.length === 0 && historyNotices.length === 0) {
      return `<div class="notify-empty-tip ${stagger}">暂无站点公告</div>`;
    }

    let html = '';

    if (activeNotices.length > 0) {
      html += `<div class="notify-section-label ${stagger}">当前公告</div>`;
      activeNotices.forEach((item, idx) => {
        const cid = parseInt(item.id, 10) || (idx + 1);
        const isUnread = cid > lastReadId;
        html += `
          <div class="nav-notice-item active-notice ${isUnread ? 'unread' : ''} ${stagger}" data-notice-id="${cid}">
            <div class="nav-notice-item-header">
              <span class="nav-notice-tag">公告</span>
              <span class="nav-notice-title">${item.title || '站点公告'}</span>
              ${isUnread ? '<span class="nav-notice-unread-dot" title="未读"></span>' : ''}
            </div>
            <div class="nav-notice-content">${item.content || ''}</div>
            ${item.url ? `<div class="nav-notice-action" data-url="${item.url}">查看详情 →</div>` : ''}
          </div>
        `;
      });
    } else {
      html += `<div class="notify-empty-active ${stagger}">暂无最新公告</div>`;
    }

    if (historyNotices.length > 0) {
      html += `<div class="notify-section-label history-label ${stagger}">历史通知</div>`;
      historyNotices.forEach((item, idx) => {
        const cid = parseInt(item.id, 10) || (idx + 1);
        const isUnread = cid > lastReadId;
        html += `
          <div class="nav-notice-item history-notice ${isUnread ? 'unread' : ''} ${stagger}" data-notice-id="${cid}">
            <div class="nav-notice-item-header">
              <span class="nav-notice-title">${item.title || '历史通知'}</span>
              ${isUnread ? '<span class="nav-notice-unread-dot" title="未读"></span>' : ''}
            </div>
            <div class="nav-notice-content">${item.content || ''}</div>
            ${item.url ? `<div class="nav-notice-action" data-url="${item.url}">查看详情 →</div>` : ''}
          </div>
        `;
      });
    }

    return html;
  };

  const bindListActions = (container) => {
    if (!container) return;
    container.querySelectorAll('.nav-notice-action[data-url]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.getAttribute('data-url');
        if (url) {
          window.markAllNoticesRead();
          if (typeof closeNotifyMenu === 'function') closeNotifyMenu();
          if (typeof window.closeMobileMoreMenu === 'function') window.closeMobileMoreMenu();
          window.open(url, '_blank');
        }
      });
    });
  };

  if (desktopList) {
    desktopList.innerHTML = buildListHtml(true);
    bindListActions(desktopList);
  }
  if (mobileList) {
    mobileList.innerHTML = buildListHtml(false);
    bindListActions(mobileList);
  }
};

function fetchRemoteNotice(shouldPushPopup = true) {
  fetchCdn('/data/notice.json', { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      const notices = Array.isArray(data) ? data : [data];
      window.siteNoticesData = notices;
      window.siteNoticesLoadError = false;
      window.renderNoticeCenter();

      if (!shouldPushPopup) return;

      // 延迟弹出新公告悬浮/系统通知，避开首屏加载峰值
      setTimeout(() => {
        let lastPushedId = parseInt(localStorage.getItem(LAST_PUSHED_NOTICE_ID_KEY) || '0', 10);
        let maxIdFound = lastPushedId;

        notices.forEach(notice => {
          const currentId = parseInt(notice.id, 10);
          if (notice && notice.active && !isNaN(currentId) && currentId > lastPushedId) {
            window.pushNotification(notice.title, {
              body: notice.content,
              tag: `remote-notice-${currentId}`,
              requireInteraction: false
            }, notice.url);

            if (currentId > maxIdFound) {
              maxIdFound = currentId;
            }
          }
        });

        if (maxIdFound > lastPushedId) {
          localStorage.setItem(LAST_PUSHED_NOTICE_ID_KEY, String(maxIdFound));
        }
      }, 2500);
    })
    .catch(err => {
      console.error('获取远程通知失败:', err);
      window.siteNoticesLoadError = true;
      window.renderNoticeCenter();
    });
}

window.refreshSiteNotices = function() {
  const desktopList = document.getElementById('desktopNotifyList');
  const mobileList = document.getElementById('mobileNotifyList');
  if (desktopList) desktopList.innerHTML = '<div class="notify-empty-tip notify-stagger-item">正在加载公告...</div>';
  if (mobileList) mobileList.innerHTML = '<div class="notify-empty-tip">正在加载公告...</div>';
  fetchRemoteNotice(false);
};

// 页面加载后立即获取公告填充通知中心，并自动检查新通知推送
document.addEventListener('DOMContentLoaded', () => {
  fetchRemoteNotice(true);
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
      'enableHDR',                           // HDR 模式
      'setting_cdn_source',                  // 重置 CDN 设置
      'setting_cdn_auto_picked',             // 重置 CDN 优选结果
      'setting_live2d_enabled',              // Live2D 开关
      'setting_live2d_position',             // Live2D 位置
      'setting_live2d_size'                  // Live2D 大小
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

/* --- Segmented Control (分段控制器) 统一逻辑 --- */
function initSegmentedControls() {
  const controls = document.querySelectorAll('.segmented-control');

  controls.forEach(control => {
    // 检查是否已经初始化过滑块，防止重复添加
    let glider = control.querySelector('.segment-glider');
    if (!glider) {
      glider = document.createElement('div');
      glider.classList.add('segment-glider');
      control.prepend(glider);
    }

    const buttons = control.querySelectorAll('button');

    // 移动滑块到指定按钮
    const moveGliderTo = (btn) => {
      if (!btn) return;
      
      // 获取相对定位数据
      const left = btn.offsetLeft;
      const width = btn.offsetWidth;

      glider.style.width = `${width}px`;
      glider.style.transform = `translateX(${left}px)`;
    };

    // 初始化位置
    // 优先找有 active 类的，否则默认第一个
    const currentActive = control.querySelector('button.active') || buttons[0];
    if (currentActive) {
      currentActive.classList.add('active');
      // 这里的 setTimeout 确保在 DOM 渲染完成后再计算位置，避免宽度为 0
      requestAnimationFrame(() => moveGliderTo(currentActive));
    }

    // 防止重复绑定事件
    if (control.dataset.segmentedInit === 'true') {
      return;
    }
    control.dataset.segmentedInit = 'true';

    // 绑定点击事件
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // 视觉切换
        buttons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // 移动滑块
        moveGliderTo(e.currentTarget);
      });
    });

    // 监听窗口调整，修正滑块位置
    // 使用防抖或简单的 requestAnimationFrame 优化性能
    window.addEventListener('resize', () => {
      const activeBtn = control.querySelector('button.active');
      if (activeBtn) moveGliderTo(activeBtn);
    });
  });
}

// 页面加载完成后立即初始化
document.addEventListener('DOMContentLoaded', initSegmentedControls);

/* ========== Live2D 模型集成逻辑 ========== */
(function initLive2D() {
  // 检查开关，若关闭则中止加载
  if (!isLive2DEnabled()) return; 

  const MODEL_PATH = `${getCdnBaseUrl()}/%E7%BC%8E%E9%87%91SatinAu_vts/%E7%BC%8E%E9%87%91SatinAu.model3.json`;
  const CORE_PATH = '/src/script/components/live2dcubismcore.min.js';

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = (e) => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  const KEY_MAPPING = {
    'Digit1': { name: 'love' },
    'Digit2': { name: 'star' },
    'Digit3': { name: 'mad mouth' },
    'Digit4': { name: 'mad' }
  };

  async function startLive2D() {
    try {
      if (typeof Live2DCubismCore === 'undefined') await loadScript(CORE_PATH);
      if (typeof PIXI === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/browser/pixi.min.js');
      if (typeof PIXI.live2d === 'undefined') await loadScript('https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js');

      // 清理可能存在的旧元素
      const oldWrapper = document.getElementById('live2d-wrapper');
      if (oldWrapper) oldWrapper.remove();
      const oldCanvas = document.getElementById('live2d-canvas');
      if (oldCanvas && !oldCanvas.closest('#live2d-wrapper')) oldCanvas.remove();

      // 构建容器和菜单
      const wrapper = document.createElement('div');
      wrapper.id = 'live2d-wrapper';
      const pos = getLive2DPosition();
      wrapper.classList.add(pos === 'right' ? 'pos-right' : 'pos-left');

      const sizeKey = getLive2DSizeSetting();
      const currentSize = getLive2DSizeInPixels(sizeKey);
      wrapper.style.width = `${currentSize}px`;
      wrapper.style.height = `${currentSize}px`;
      
      const menu = document.createElement('div');
      menu.className = 'live2d-menu';
      menu.innerHTML = `
        <div class="live2d-menu-btn" data-exp="love">🥰 爱心</div>
        <div class="live2d-menu-btn" data-exp="star">✨ 星星</div>
        <div class="live2d-menu-btn" data-exp="mad mouth">😕撇嘴</div>
        <div class="live2d-menu-btn" data-exp="mad">💢 生气</div>
        <div class="live2d-menu-divider"></div>
        <div class="live2d-menu-btn" onclick="window.openSettingsModal('live2d-setting-anchor')">⚙️ 设置</div>
      `;

      const canvas = document.createElement('canvas');
      canvas.id = 'live2d-canvas';

      wrapper.appendChild(canvas);
      wrapper.appendChild(menu);
      document.body.appendChild(wrapper);

      // 防抖定时器控制菜单，解决鼠标跨越空隙时菜单闪烁消失的问题
      let hoverTimer;
      const showMenu = () => {
        clearTimeout(hoverTimer);
        menu.classList.add('show');
      };
      const hideMenu = () => {
        hoverTimer = setTimeout(() => menu.classList.remove('show'), 400); // 400ms后消失
      };
      
      canvas.addEventListener('mouseenter', showMenu);
      canvas.addEventListener('mouseleave', hideMenu);
      menu.addEventListener('mouseenter', showMenu);
      menu.addEventListener('mouseleave', hideMenu);

      const app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        backgroundAlpha: 0,
        width: currentSize,
        height: currentSize,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      let model;
      try {
        model = await PIXI.live2d.Live2DModel.from(MODEL_PATH, {
          autoInteract: true
        });
      } catch (err) {
        console.warn('[Live2D] 主线路加载模型失败，尝试备用线路...', err);
        const fallbackModelPath = `${getCdnFallbackUrl()}/%E7%BC%8E%E9%87%91SatinAu_vts/%E7%BC%8E%E9%87%91SatinAu.model3.json`;
        model = await PIXI.live2d.Live2DModel.from(fallbackModelPath, {
          autoInteract: true
        });
      }

      app.stage.addChild(model);

      // 缩放并居中
      const origWidth = model.width;
      const origHeight = model.height;

      const updateLayout = (size) => {
        const scaleX = size / origWidth;
        const scaleY = size / origHeight;
        const scale = Math.min(scaleX, scaleY) * 0.95; 
        model.scale.set(scale);
        model.x = (size - origWidth * scale) / 2;
        model.y = size - origHeight * scale;
      };

      updateLayout(currentSize);

      window.__live2dResizeLayout = (targetSize) => {
        try {
          app.renderer.resize(targetSize, targetSize);
          updateLayout(targetSize);
        } catch (e) {
          console.error('Error resizing Live2D:', e);
        }
      };

      // 监听快捷键
      window.addEventListener('keydown', (e) => {
        const config = KEY_MAPPING[e.code];
        if (config) {
          try { model.expression(config.name); } catch (err) {}
        }
      });

      // 监听菜单按钮点击事件 (委托)
      menu.addEventListener('click', (e) => {
        const expName = e.target.getAttribute('data-exp');
        if (expName) {
          try { model.expression(expName); } catch (err) {}
        }
      });

      // 点击身体动作
      model.on('hit', (hitAreas) => {
        if (hitAreas.includes('Body')) {
          model.motion('TapBody');
        }
      });

      // 动画淡入
      wrapper.classList.add('loaded');

    } catch (error) {
      console.error('Live2D Load Error:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLive2D);
  } else {
    startLive2D();
  }
})();

/* ========== 全局调起设置浮窗方法 ========== */
window.openSettingsModal = function(anchorId = null, triggerEl = null) {
  let modal = document.querySelector('global-modal');
  if (!modal) {
    modal = document.createElement('global-modal');
    document.body.appendChild(modal);
  }
  if (triggerEl) {
    modal.with(triggerEl).showSettings(anchorId);
  } else {
    modal.showSettings(anchorId);
  }
};

/* ========== 全局登录状态与用户同步 ========== */
window.checkGlobalAuthStatus = checkGlobalAuthStatus;
function checkGlobalAuthStatus() {
  if (document.getElementById('account-page')) return;

  const token = localStorage.getItem('auth_token');
  if (!token) {
    window.dispatchEvent(new CustomEvent('auth-status-changed', { detail: null }));
    return;
  }

  const clearAuth = (reason) => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.dispatchEvent(new CustomEvent('auth-status-changed', { detail: null }));
    if (document.getElementById('account-page')) {
      if (typeof showToast === 'function') {
        showToast(reason || '登录已过期，请重新登录');
      }
      setTimeout(() => {
        if (typeof window.navigateTo === 'function') {
          window.navigateTo('/pages/account/login.html', { replace: true });
        } else {
          window.location.href = '/pages/account/login.html';
        }
      }, 1000);
    }
  };

  // 本地预检 Token 是否已过期
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp && payload.exp < Date.now()) {
      clearAuth('登录已过期，请重新登录');
      return;
    }
  } catch (e) {
    clearAuth();
    return;
  }

  // 向后端静默校验 Token 并同步最新用户信息
  fetch('https://db.satinau.cn/api/user/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (res.status === 401) {
      throw new Error('EXPIRED');
    }
    return res.json();
  })
  .then(data => {
    if (data && data.id) {
      localStorage.setItem('user_info', JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('auth-status-changed', { detail: data }));
    }
  })
  .catch(err => {
    if (err.message === 'EXPIRED') {
      clearAuth('登录已过期，请重新登录');
    }
  });
}

document.addEventListener('DOMContentLoaded', checkGlobalAuthStatus);

// 同步 Viewer.js 打开状态至 html 根节点以完全隐藏视口滚动条，同时保留并同步滚动条宽度补偿防止页面与固定导航栏抖动
function syncViewerOpenToHtml() {
  const V = window.Viewer;
  if (!V || !V.prototype || V._htmlSyncPatched) return;
  V._htmlSyncPatched = true;

  const origShow = V.prototype.show;
  if (typeof origShow === 'function') {
    V.prototype.show = function(...args) {
      if (!this.isShown && !this.showing) {
        // 在 Viewer.js 锁定页面及隐藏滚动条前，精准获取当前滚动条实际宽度
        const measured = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        const scrollbarWidth = measured > 0
          ? measured
          : (typeof this.scrollbarWidth === 'number' && this.scrollbarWidth > 0 ? this.scrollbarWidth : 0);

        if (scrollbarWidth > 0) {
          document.documentElement.style.setProperty('--scrollbar-compensate', `${scrollbarWidth}px`);
        }
        document.documentElement.classList.add('viewer-open');
      }

      let result;
      try {
        result = origShow.apply(this, args);
      } catch (err) {
        if (!this.showing && !this.isShown && (!document.body || !document.body.classList.contains('viewer-open'))) {
          document.documentElement.classList.remove('viewer-open');
          if (!window.globalModal || !window.globalModal.isScrollLocked) {
            document.documentElement.style.removeProperty('--scrollbar-compensate');
          }
        }
        throw err;
      }

      // 若触发 show 但被事件阻止（如 preventDefault）且未成功打开，回退清理
      if (!this.showing && !this.isShown && (!document.body || !document.body.classList.contains('viewer-open'))) {
        document.documentElement.classList.remove('viewer-open');
        if (!window.globalModal || !window.globalModal.isScrollLocked) {
          document.documentElement.style.removeProperty('--scrollbar-compensate');
        }
      }

      return result;
    };
  }

  const origHide = V.prototype.hide;
  if (typeof origHide === 'function') {
    V.prototype.hide = function(...args) {
      const result = origHide.apply(this, args);
      // 若处于非动画直接关闭（例如 hide(true)）且 body 已无 viewer-open，立即恢复
      if (!this.hiding && !this.isShown && (!document.body || !document.body.classList.contains('viewer-open'))) {
        document.documentElement.classList.remove('viewer-open');
        if (!window.globalModal || !window.globalModal.isScrollLocked) {
          document.documentElement.style.removeProperty('--scrollbar-compensate');
        }
      }
      return result;
    };
  }

  const origDestroy = V.prototype.destroy;
  if (typeof origDestroy === 'function') {
    V.prototype.destroy = function(...args) {
      const result = origDestroy.apply(this, args);
      if (!document.body || !document.body.classList.contains('viewer-open')) {
        document.documentElement.classList.remove('viewer-open');
        if (!window.globalModal || !window.globalModal.isScrollLocked) {
          document.documentElement.style.removeProperty('--scrollbar-compensate');
        }
      }
      return result;
    };
  }

  // 兼容性补充：若有代码调用了 open / close
  if (!V.prototype.open && typeof V.prototype.show === 'function') {
    V.prototype.open = V.prototype.show;
  }
  if (!V.prototype.close && typeof V.prototype.hide === 'function') {
    V.prototype.close = V.prototype.hide;
  }
}

window.syncViewerOpenToHtml = syncViewerOpenToHtml;

// 全局监听与初始化 Viewer.js 滚动补偿联动
(function initViewerCompensationLifecycle() {
  function cleanupCompensation() {
    const isViewerOpen = document.body && document.body.classList.contains('viewer-open');
    if (!isViewerOpen) {
      document.documentElement.classList.remove('viewer-open');
      if (!window.globalModal || !window.globalModal.isScrollLocked) {
        document.documentElement.style.removeProperty('--scrollbar-compensate');
      }
    }
  }

  // 1. 立即执行一次检查与挂载
  syncViewerOpenToHtml();
  document.addEventListener('DOMContentLoaded', syncViewerOpenToHtml);

  // 2. 劫持 window.Viewer 属性：应对异步或延迟加载 viewer.min.js 的情况
  let _Viewer = window.Viewer;
  try {
    Object.defineProperty(window, 'Viewer', {
      configurable: true,
      enumerable: true,
      get() {
        return _Viewer;
      },
      set(val) {
        _Viewer = val;
        syncViewerOpenToHtml();
      }
    });
  } catch (e) {
    // 忽略在严格或不可配置环境下的拦截失败
  }

  // 3. 监听 body 的 class 变化：Viewer.js 在关闭动画完成后会移除 body 上的 viewer-open 类
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      cleanupCompensation();
    });

    const startObserver = () => {
      if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    };

    if (document.body) {
      startObserver();
    } else {
      document.addEventListener('DOMContentLoaded', startObserver);
    }
  }

  // 4. 全局监听 hidden 事件（Viewer.js 关闭完成后会触发冒泡的 hidden 事件）
  document.addEventListener('hidden', () => {
    cleanupCompensation();
  }, true);
})();