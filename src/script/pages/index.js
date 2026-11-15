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

/* ========== 最近动态板块 (Bilibili 投币 & Steam 在玩) ========== */
let activitiesAbortController = null;

function formatActivityNumber(num) {
  if (typeof num !== 'number') return '0';
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return num.toString();
}

function formatActivityDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const sStr = s < 10 ? '0' + s : s;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mRem = m % 60;
    const mStr = mRem < 10 ? '0' + mRem : mRem;
    return `${h}:${mStr}:${sStr}`;
  }
  const mStr = m < 10 ? '0' + m : m;
  return `${mStr}:${sStr}`;
}

function formatActivityRelativeTime(timestamp) {
  if (!timestamp) return '';
  const timeMs = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  const diffSec = Math.floor((Date.now() - timeMs) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}天前`;
  const date = new Date(timeMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatActivityHours(minutes) {
  if (!minutes || minutes <= 0) return '0 小时';
  if (minutes < 60) return `${minutes} 分钟`;
  return `${(minutes / 60).toFixed(1)} 小时`;
}

function renderBilibiliSkeleton() {
  return `
    <div class="activity-card contact-card activity-skeleton-card">
      <div class="activity-media-thumb skeleton-box"></div>
      <div class="activity-content">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-sub"></div>
        <div class="skeleton-line skeleton-meta"></div>
      </div>
    </div>
  `;
}

function renderSteamSkeleton() {
  return `
    <div class="activity-card contact-card activity-skeleton-card">
      <div class="activity-media-thumb skeleton-box"></div>
      <div class="activity-content">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-sub"></div>
        <div class="skeleton-line skeleton-meta"></div>
      </div>
    </div>
  `;
}

async function loadBilibiliCoins(signal) {
  const container = document.getElementById('bilibili-coins-list');
  if (!container) return;

  const vmid = window.SITE_CONFIG?.BILIBILI_UID || '1502522588';
  try {
    const res = await fetch(`/api/bilibili/coins?vmid=${encodeURIComponent(vmid)}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!container.isConnected) return;

    if (data.code === 412 || data.need_cookie) {
      container.innerHTML = `
        <div class="activity-prompt-card contact-card">
          <div class="activity-empty-icon">🪙</div>
          <div class="activity-empty-text">
            <div class="label">哔哩哔哩 · 接口需配置凭证</div>
            <div class="value">B 站投币接口存在风控保护（412），需在 Cloudflare 环境变量中添加 BILIBILI_COOKIE（填入 SESSDATA 与 buvid3）即可同步数据。</div>
          </div>
        </div>
      `;
      return;
    }

    if (data.code === 0 && Array.isArray(data.data) && data.data.length > 0) {
      // 提取前 2 部最近投币的视频
      const videos = data.data.slice(0, 2);
      container.innerHTML = videos.map(video => {
        const jumpUrl = `https://www.bilibili.com/video/${video.bvid}`;
        const appUrl = video.aid ? `bilibili://video/${video.aid}` : '';
        const titleEscaped = (video.title || '').replace(/"/g, '&quot;');
        const safeJump = `document.getElementById('globalModal') ? document.getElementById('globalModal').with(this).alert('是否前往哔哩哔哩观看视频？', '${jumpUrl}', '${appUrl}') : window.open('${jumpUrl}', '_blank')`;

        return `
          <a class="activity-card bili-card contact-card" href="javascript:void(0);" onclick="${safeJump}" title="${titleEscaped}">
            <div class="activity-media-thumb">
              <img src="${video.pic}" alt="${titleEscaped}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.opacity='0'" />
              <span class="activity-duration-badge">${formatActivityDuration(video.duration)}</span>
              <span class="activity-coin-badge" title="已投币">🪙 投币</span>
            </div>
            <div class="activity-content">
              <h4 class="activity-item-title">${titleEscaped}</h4>
              <div class="activity-author-row">
                ${video.owner?.face ? `<img class="activity-author-avatar" src="${video.owner.face}" alt="${video.owner.name || ''}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" />` : ''}
                <span class="activity-author-name">${video.owner?.name || 'UP主'}</span>
                <span class="activity-time-tag">${formatActivityRelativeTime(video.time || video.pubdate)}</span>
              </div>
              <div class="activity-meta-stats">
                <span class="activity-stat" title="播放量">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  ${formatActivityNumber(video.stat?.view || 0)}
                </span>
                <span class="activity-stat" title="点赞数">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
                  ${formatActivityNumber(video.stat?.like || 0)}
                </span>
                <span class="activity-stat" title="投币数">
                  🪙 ${formatActivityNumber(video.stat?.coin || 0)}
                </span>
              </div>
            </div>
          </a>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div class="activity-empty-card contact-card">
          <div class="activity-empty-icon">🪙</div>
          <div class="activity-empty-text">
            <div class="label">哔哩哔哩</div>
            <div class="value">${data.message && data.message !== '0' ? data.message : '近期未获取到公开投币记录'}</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    if (signal?.aborted) return;
    console.warn('获取B站投币数据失败:', err);
    if (!container.isConnected) return;
    container.innerHTML = `
      <div class="activity-empty-card contact-card">
        <div class="activity-empty-icon">📺</div>
        <div class="activity-empty-text">
          <div class="label">哔哩哔哩</div>
          <div class="value">网络连接异常或暂未同步公开记录</div>
        </div>
      </div>
    `;
  }
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

    // 若配置了 Steam ID，更新个人主页跳转链接
    const profileLink = document.getElementById('steam-profile-link');
    if (profileLink && steamId) {
      profileLink.setAttribute('onclick', `document.getElementById('globalModal') ? document.getElementById('globalModal').with(this).alert('是否跳转到 Steam 个人主页？', 'https://steamcommunity.com/profiles/${steamId}', 'steam://url/SteamIDPage/${steamId}') : window.open('https://steamcommunity.com/profiles/${steamId}', '_blank')`);
    }

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
      // 提取前 2 款游戏展示
      const games = data.games.slice(0, 2);
      container.innerHTML = games.map(game => {
        const storeUrl = game.store_url || `https://store.steampowered.com/app/${game.appid}/`;
        const appScheme = `steam://store/${game.appid}`;
        const nameEscaped = (game.name || '').replace(/"/g, '&quot;');
        const safeJump = `document.getElementById('globalModal') ? document.getElementById('globalModal').with(this).alert('是否前往 Steam 商店查看《${nameEscaped}》？', '${storeUrl}', '${appScheme}') : window.open('${storeUrl}', '_blank')`;

        return `
          <a class="activity-card steam-card contact-card" href="javascript:void(0);" onclick="${safeJump}" title="${nameEscaped}">
            <div class="activity-media-thumb steam-thumb">
              <img src="${game.header_image}" alt="${nameEscaped}" loading="lazy" onerror="this.src='${game.capsule_image || ''}'; this.onerror=null;" />
              <span class="activity-playtime-badge">近两周 ${formatActivityHours(game.playtime_2weeks)}</span>
            </div>
            <div class="activity-content">
              <h4 class="activity-item-title">${nameEscaped}</h4>
              <div class="activity-stats-row">
                <span class="activity-time-pill" title="总游戏时间">总时长: ${formatActivityHours(game.playtime_forever)}</span>
              </div>
              <div class="activity-link-hint">
                <span>Steam 商店页面</span>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </div>
          </a>
        `;
      }).join('');
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

function initRecentActivities() {
  const biliContainer = document.getElementById('bilibili-coins-list');
  const steamContainer = document.getElementById('steam-games-list');
  if (!biliContainer && !steamContainer) return;

  if (activitiesAbortController) {
    activitiesAbortController.abort();
  }
  activitiesAbortController = new AbortController();
  const signal = activitiesAbortController.signal;

  if (biliContainer) biliContainer.innerHTML = renderBilibiliSkeleton();
  if (steamContainer) steamContainer.innerHTML = renderSteamSkeleton();

  loadBilibiliCoins(signal);
  loadSteamGames(signal);
}

window.cleanupIndexPage = function() {
  if (indexBgInterval) {
    clearInterval(indexBgInterval);
    indexBgInterval = null;
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
