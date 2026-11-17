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

/* ============= index.html 独有逻辑 ============= */
/* 邮箱复制（支持多地址，带回退方案） */
window.copyEmail = function(email) {
if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(() => {
    showToast("📋 已复制: " + email);
    }).catch(err => {
    emailfallbackCopyText(email);
    });
} else {
    emailfallbackCopyText(email);
}
};

function emailfallbackCopyText(text) {
const input = document.createElement("textarea");
input.value = text;
input.style.position = "fixed";
input.style.opacity = "0";
document.body.appendChild(input);
input.select();
try {
    document.execCommand("copy");
    showToast("📋 已复制: " + text);
} catch (err) {
    alert("复制失败，请手动复制: " + text);
}
document.body.removeChild(input);
}

/* 邮箱选择弹窗 */
window.showEmailPopup  = () => { toggleModal("emailOverlay", true); toggleModal("emailPopup", true); };
window.closeEmailPopup = () => { toggleModal("emailOverlay", false); toggleModal("emailPopup", false); };

/* 微信二维码弹窗 */
window.showWeChatQR  = () => { toggleModal("wechatOverlay", true); toggleModal("wechatQR", true); };
window.closeWeChatQR = () => { toggleModal("wechatOverlay", false); toggleModal("wechatQR", false); };

/* ========== 泽凌卡片背景轮播逻辑 ========== */
let indexBgInterval = null;

function initZelynnCardBg() {
  const zelynnBg = document.getElementById('zelynn-bg');
  if (!zelynnBg) return;
  
  // 强制使用 webp 格式
  const imgExtension = '.webp';
  
  // 图片基础路径
  const listUrl = typeof fetchCdn === 'function' ? '/zelynn/list.json' : `${getCdnBaseUrl()}/zelynn/list.json`;
  
  let images = [];
  let currentIndex = 0;

  // 预加载图片
  function preloadImage(url) {
    const img = new Image();
    img.src = url;
  }

  // 切换背景
  function changeBackground() {
    if (images.length === 0 || !zelynnBg.isConnected) return;
    
    const imgInfo = images[currentIndex];
    const rawPath = `/zelynn/${imgInfo.filename}${imgExtension}`;
    const imgUrl = typeof getCdnUrl === 'function' ? getCdnUrl(rawPath) : `${getCdnBaseUrl()}${rawPath}`;
    
    // 创建临时图片对象检测加载，确保平滑切换
    const tempImg = new Image();
    tempImg.src = imgUrl;
    tempImg.onload = () => {
      if (!zelynnBg.isConnected) return;
      zelynnBg.style.backgroundImage = `url('${imgUrl}')`;
      
      // 重置动画类以触发重新播放
      zelynnBg.classList.remove('zooming');
      void zelynnBg.offsetWidth; // 触发重绘
      zelynnBg.classList.add('zooming');
    };

    // 索引递增
    currentIndex = (currentIndex + 1) % images.length;
    
    // 预加载下一张
    const nextIndex = (currentIndex + 1) % images.length;
    const nextRawPath = `/zelynn/${images[nextIndex].filename}${imgExtension}`;
    const nextImgUrl = typeof getCdnUrl === 'function' ? getCdnUrl(nextRawPath) : `${getCdnBaseUrl()}${nextRawPath}`;
    preloadImage(nextImgUrl);
  }

  // 获取图片列表
  const indexFetch = typeof fetchCdn === 'function' ? fetchCdn : fetch;
  indexFetch(listUrl)
    .then(res => res.json())
    .then(data => {
      if (!zelynnBg.isConnected) return;
      images = data;
      // 随机打乱顺序
      images.sort(() => Math.random() - 0.5);

      if (images.length > 0) {
        changeBackground(); // 立即显示
        indexBgInterval = setInterval(changeBackground, 5000); // 5秒轮播
      }
    })
    .catch(err => {
      console.error('首页背景加载失败:', err);
      // 加载失败时的保底渐变色
      if (zelynnBg.isConnected) {
        zelynnBg.style.background = 'linear-gradient(135deg, #a18cd1, #fbc2eb)'; 
      }
    });
}

/* ========== 最近动态板块 (Steam 与 QQ 空间) ========== */
let activitiesAbortController = null;
let activityCarouselInterval = null;
const ACTIVITY_CAROUSEL_DURATION = 8000;
const ACTIVITY_CAROUSEL_TICK = 100;

function formatActivityHours(minutes) {
  if (!minutes || minutes <= 0) return '0 小时';
  if (minutes < 60) return `${minutes} 分钟`;
  return `${(minutes / 60).toFixed(1)} 小时`;
}

function escapeActivityHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

function renderSteamSkeleton() {
  return `
    <div class="activity-card steam-card contact-card activity-skeleton-card">
      <div class="activity-media-thumb skeleton-box"></div>
      <div class="activity-content">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-sub"></div>
      </div>
    </div>
  `.repeat(3);
}

async function loadSteamGames(signal) {
  const container = document.getElementById('steam-games-list');
  if (!container) return;

  const steamId = window.SITE_CONFIG?.STEAM_ID || '';
  const queryParam = steamId ? `?steamid=${encodeURIComponent(steamId)}` : '';

  try {
    const res = await fetch(`/api/steam/recent${queryParam}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!container.isConnected) return;

    if (data.configured === false) {
      container.innerHTML = `
        <div class="activity-prompt-card contact-card">
          <div class="activity-empty-icon">🎮</div>
          <div class="activity-empty-text">
            <div class="label">Steam 官方接口已就绪</div>
            <div class="value">在环境变量中配置 STEAM_API_KEY 与 STEAM_ID 即可实时展示近两周在玩游戏与时长</div>
          </div>
        </div>
      `;
      return;
    }

    if (data.success && Array.isArray(data.games) && data.games.length > 0) {
      // 提取前 3 款游戏展示
      const games = data.games.slice(0, 3);
      container.innerHTML = games.map((game, index) => {
        const nameEscaped = escapeActivityHtml(game.name || '');

        return `
          <a class="activity-card steam-card contact-card" href="javascript:void(0);" data-game-index="${index}" title="${nameEscaped}">
            <div class="activity-media-thumb steam-thumb">
              <img src="${escapeActivityHtml(game.header_image || '')}" alt="${nameEscaped}" loading="lazy" />
              <span class="activity-playtime-badge">近两周 ${formatActivityHours(game.playtime_2weeks)}</span>
            </div>
            <div class="activity-content">
              <h4 class="activity-item-title">${nameEscaped}</h4>
              <div class="activity-stats-row">
                <span class="activity-time-pill" title="总游戏时间">总时长: ${formatActivityHours(game.playtime_forever)}</span>
              </div>
            </div>
          </a>
        `;
      }).join('');

      container.querySelectorAll('.steam-card').forEach(card => {
        const game = games[Number(card.dataset.gameIndex)];
        if (!game) return;

        const img = card.querySelector('.activity-media-thumb img');
        if (img) {
          img.addEventListener('error', () => {
            if (!img.dataset.retried && game.capsule_image) {
              img.dataset.retried = '1';
              img.src = game.capsule_image;
            } else {
              img.style.opacity = '0';
            }
          });
        }

        card.addEventListener('click', (e) => {
          e.preventDefault();
          const storeUrl = game.store_url || `https://store.steampowered.com/app/${game.appid}/`;
          const appScheme = `steam://store/${game.appid}`;
          const modal = document.getElementById('globalModal');
          if (modal) {
            modal.with(card).alert(`是否前往 Steam 商店查看《${game.name || ''}》？`, storeUrl, appScheme);
          } else {
            window.open(storeUrl, '_blank');
          }
        });
      });
    } else {
      container.innerHTML = `
        <div class="activity-empty-card contact-card">
          <div class="activity-empty-icon">☕</div>
          <div class="activity-empty-text">
            <div class="label">Steam</div>
            <div class="value">近两周没有进行游戏，正在享受生活~</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    if (signal?.aborted) return;
    console.warn('获取Steam数据失败:', err);
    if (!container.isConnected) return;
    container.innerHTML = `
      <div class="activity-empty-card contact-card">
        <div class="activity-empty-icon">🎮</div>
        <div class="activity-empty-text">
          <div class="label">Steam</div>
          <div class="value">网络连接异常或接口服务暂不可用</div>
        </div>
      </div>
    `;
  }
}

function formatQzoneDate(timestamp) {
  if (!timestamp) return '时间未知';
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function renderQzoneText(value) {
  const tokens = String(value).split(/(\[em\]e\d{1,7}\[\/em\])/gi);
  return tokens.map(token => {
    const emoji = token.match(/^\[em\](e\d{1,7})\[\/em\]$/i);
    if (emoji) {
      const code = emoji[1].toLowerCase();
      return `<img class="qzone-emoji" src="https://qzonestyle.gtimg.cn/qzone/em/${code}.gif" alt="[QQ 表情]" data-code="${code}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    }
    return escapeActivityHtml(token)
      .replace(/\r\n?/g, '\n')
      .replace(/\n/g, '<br>');
  }).join('');
}

function getQzoneImageUrl(value) {
  if (typeof value !== 'string') return '';

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = hostname === 'qpic.cn'
      || hostname.endsWith('.qpic.cn')
      || hostname === 'gtimg.cn'
      || hostname.endsWith('.gtimg.cn');
    return trustedHost && url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

async function loadQzonePosts(signal) {
  const container = document.getElementById('qzone-status-list');
  if (!container) return;

  try {
    const response = await fetch('/api/qzone/recent', { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!container.isConnected) return;

    if (data.configured === false) {
      container.innerHTML = `
        <div class="activity-prompt-card contact-card">
          <div class="activity-empty-icon">💬</div>
          <div class="activity-empty-text">
            <div class="label">QQ 空间接口尚未配置</div>
            <div class="value">请联系站点维护者配置服务端接口</div>
          </div>
        </div>
      `;
      return;
    }

    const posts = Array.isArray(data.posts) ? data.posts.slice(0, 3) : [];
    if (!data.success || posts.length === 0) {
      container.innerHTML = `
        <div class="activity-empty-card contact-card">
          <div class="activity-empty-icon">💬</div>
          <div class="activity-empty-text">
            <div class="label">QQ 空间</div>
            <div class="value">${data.success ? '暂时没有可展示的说说' : '暂时无法获取最近说说'}</div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => {
      const text = renderQzoneText(post.text || '');
      const images = Array.isArray(post.images)
        ? post.images.map(getQzoneImageUrl).filter(Boolean).slice(0, 3)
        : [];
      const imageMarkup = images.length
        ? `<div class="qzone-photo-grid qzone-photo-grid-${images.length}" role="group" aria-label="说说图片">${images.map((image, index) => `
            <img src="${escapeActivityHtml(image)}" alt="说说图片 ${index + 1}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          `).join('')}</div>`
        : '';
      const date = formatQzoneDate(Number(post.timestamp));
      const isoDate = Number(post.timestamp) > 0
        ? new Date(Number(post.timestamp) * 1000).toISOString()
        : '';
      return `
        <article class="activity-card qzone-card contact-card${images.length ? ' has-images' : ''}">
          <div class="activity-content">
            <p class="qzone-post-text">${text}</p>
            ${imageMarkup}
            <time class="activity-time-pill" ${isoDate ? `datetime="${isoDate}"` : ''}>${date}</time>
          </div>
        </article>
      `;
    }).join('');

    container.querySelectorAll('.qzone-emoji').forEach(image => {
      image.addEventListener('error', () => {
        const code = image.dataset.code;
        if (image.dataset.fallback === 'png') {
          image.replaceWith(document.createTextNode('[QQ 表情]'));
          return;
        }
        image.dataset.fallback = 'png';
        image.src = `https://qzonestyle.gtimg.cn/qzone/em/${code}.png`;
      });
    });
  } catch (error) {
    if (signal?.aborted) return;
    console.warn('获取 QQ 空间说说失败:', error);
    if (!container.isConnected) return;
    container.innerHTML = `
      <div class="activity-empty-card contact-card">
        <div class="activity-empty-icon">💬</div>
        <div class="activity-empty-text">
          <div class="label">QQ 空间</div>
          <div class="value">网络连接异常或接口服务暂不可用</div>
        </div>
      </div>
    `;
  }
}

function initActivityCarousel(signal) {
  const carousel = document.getElementById('activity-carousel');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('[data-activity-slide]'));
  const switcherButtons = Array.from(carousel.querySelectorAll('[data-activity-target]'));
  const progress = document.getElementById('activity-carousel-progress');
  const title = document.getElementById('activity-current-title');
  const subtitle = document.getElementById('activity-current-subtitle');
  if (slides.length < 2 || switcherButtons.length !== slides.length || !progress || !title || !subtitle) return;

  let activeIndex = 0;
  let elapsed = 0;

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.hidden = slideIndex !== activeIndex;
    });
    switcherButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === activeIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    title.textContent = slides[activeIndex].dataset.activityTitle;
    subtitle.textContent = slides[activeIndex].dataset.activitySubtitle;

    elapsed = 0;
    progress.classList.remove('is-running');
    progress.style.animationDuration = `${ACTIVITY_CAROUSEL_DURATION}ms`;
    progress.style.transform = 'scaleX(0)';
    void progress.offsetWidth;
    progress.style.removeProperty('transform');
    progress.classList.add('is-running');
  }

  switcherButtons.forEach(button => {
    button.addEventListener('click', () => {
      showSlide(Number(button.dataset.activityTarget));
    }, { signal });
  });

  showSlide(activeIndex);
  activityCarouselInterval = setInterval(() => {
    elapsed += ACTIVITY_CAROUSEL_TICK;
    if (elapsed >= ACTIVITY_CAROUSEL_DURATION) showSlide(activeIndex + 1);
  }, ACTIVITY_CAROUSEL_TICK);
}

function initRecentActivities() {
  const steamContainer = document.getElementById('steam-games-list');
  const qzoneContainer = document.getElementById('qzone-status-list');
  if (!steamContainer && !qzoneContainer) return;

  if (activitiesAbortController) {
    activitiesAbortController.abort();
  }
  activitiesAbortController = new AbortController();
  const signal = activitiesAbortController.signal;

  if (steamContainer) steamContainer.innerHTML = renderSteamSkeleton();
  if (qzoneContainer) {
    qzoneContainer.innerHTML = `
      <div class="activity-card qzone-card contact-card activity-skeleton-card">
        <div class="activity-content">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line skeleton-sub"></div>
        </div>
      </div>
    `.repeat(3);
  }

  initActivityCarousel(signal);
  if (steamContainer) loadSteamGames(signal);
  if (qzoneContainer) loadQzonePosts(signal);
}

window.cleanupIndexPage = function() {
  if (indexBgInterval) {
    clearInterval(indexBgInterval);
    indexBgInterval = null;
  }
  if (activityCarouselInterval) {
    clearInterval(activityCarouselInterval);
    activityCarouselInterval = null;
  }
  if (activitiesAbortController) {
    activitiesAbortController.abort();
    activitiesAbortController = null;
  }
};

window.initIndexPage = function() {
  window.cleanupIndexPage();
  initZelynnCardBg();
  initRecentActivities();
};

document.addEventListener('DOMContentLoaded', window.initIndexPage);
