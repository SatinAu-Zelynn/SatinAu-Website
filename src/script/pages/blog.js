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

/* ========== blog.html 独有逻辑 ========== */
// DOM元素引用
let listEl = document.getElementById("blogList");
let postView = document.getElementById("postView");
let postTitle = document.getElementById("postTitle");
let postDate = document.getElementById("postDate");
let postContent = document.getElementById("postContent");
let backToList = document.getElementById("backToList");
let loader = document.getElementById("loadingOverlay");
let emptyState = document.getElementById("emptyState");
let errorState = document.getElementById("errorState");
let retryBtn = document.getElementById("retryBtn");
let postError = document.getElementById("postError");

function refreshBlogDomRefs() {
    listEl = document.getElementById("blogList");
    postView = document.getElementById("postView");
    postTitle = document.getElementById("postTitle");
    postDate = document.getElementById("postDate");
    postContent = document.getElementById("postContent");
    backToList = document.getElementById("backToList");
    loader = document.getElementById("loadingOverlay");
    emptyState = document.getElementById("emptyState");
    errorState = document.getElementById("errorState");
    retryBtn = document.getElementById("retryBtn");
    postError = document.getElementById("postError");
}

// 缓存机制
const postCache = new Map();
let postsData = [];
let currentPost = null;

// 存储动画状态
let activeCardElement = null; // 当前点击的卡片 DOM 元素
let activeCardRect = null;    // 卡片点击时的位置尺寸信息
let listScrollY = 0;
let isHeroAnimating = false;
let heroCleanupTimers = [];

function clearHeroTimers() {
    heroCleanupTimers.forEach(t => clearTimeout(t));
    heroCleanupTimers = [];
}

window.cleanupBlogPage = function() {
    clearHeroTimers();
    isHeroAnimating = false;
    if (window.imageViewer) {
        window.imageViewer.destroy();
        window.imageViewer = null;
    }
    activeCardElement = null;
    activeCardRect = null;
    document.body.classList.remove('hero-open', 'hero-list-leaving', 'hero-list-entering', 'list-restored-view');
    document.querySelectorAll('.hero-overlay').forEach(el => el.remove());
};

function findCardForPost(post) {
    if (activeCardElement && activeCardElement.isConnected) {
        return activeCardElement;
    }
    if (!listEl || !post || !post.title) return null;
    const cards = listEl.querySelectorAll('.contact-card');
    for (const card of cards) {
        if (card.dataset.title === post.title) {
            return card;
        }
    }
    return null;
}

function closePostWithHero(pushHistory = true) {
    if (isHeroAnimating) return;
    const targetCard = findCardForPost(currentPost);
    if (targetCard && postView && postView.style.display !== 'none') {
        activeCardElement = targetCard;
        animateHeroClose(() => {
            resetBlogView(pushHistory);
        });
    } else {
        resetBlogView(pushHistory);
    }
}

window.closeBlogPostToList = function() {
    if (!postView || postView.style.display === 'none') return;
    closePostWithHero(true);
};

window.handleBlogPopState = function(event) {
    if (document.body.id !== 'blog-page') return;
    refreshBlogDomRefs();
    if (!listEl || !postView) return;

    const urlParams = new URLSearchParams(window.location.search);
    const stateTitle = (event && event.state && event.state.title) || (urlParams.get('title') ? decodeURIComponent(urlParams.get('title')) : null);

    if (stateTitle) {
        // 后退或前进到某篇文章
        const post = postCache.get(stateTitle) || 
                    postsData.find(p => p.title === stateTitle);
        if (post) {
            const card = findCardForPost(post);
            if (card && postView.style.display === 'none' && !isHeroAnimating) {
                openPostWithHero(card, post, false);
            } else {
                loadPost(post);
            }
        }
    } else {
        // 恢复默认页面 title
        document.title = "博客Blog - 缎金SatinAu";
        closePostWithHero(false);
    }
};

// 初始化
function initBlog() {
    refreshBlogDomRefs();
    if (!listEl || !postView) return;

    activeCardElement = null;
    activeCardRect = null;

    // 先隐藏错误状态，显示加载状态
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (loader) loader.classList.add("show");

    const listPromise = loadPostsList().finally(() => {
        // 无论成功失败都隐藏加载动画
        if (loader) loader.classList.remove("show");
    });

    initBlogButtons();

    // 检查URL中是否有文章标题参数
    const urlParams = new URLSearchParams(window.location.search);
    const targetTitle = urlParams.get('title');
    
    if (targetTitle) {
        // 尝试从缓存加载
        const decodedTitle = decodeURIComponent(targetTitle);
        const cachedPost = postCache.get(decodedTitle);
        
        if (cachedPost && typeof cachedPost === 'object') {
            loadPost(cachedPost);
        } else {
            // 缓存中没有则等待列表加载完再查找
            listPromise.then(() => {
                if (!listEl || !listEl.isConnected) return;
                const post = postsData.find(p => p.title === decodedTitle);
                if (post) {
                    loadPost(post);
                } else {
                    // 处理文章不存在的情况
                    console.error('文章不存在');
                    postView.style.display = "block";
                    postError.style.display = "block";
                    listEl.style.display = "none";
                }
            }).catch(() => {});
        }
    }

    // 返回列表按钮事件
    if (backToList && !backToList.dataset.bound) {
        backToList.addEventListener("click", () => {
            closePostWithHero(true);
        });
        backToList.dataset.bound = "true";
    }

    // 重试按钮事件
    if (retryBtn && !retryBtn.dataset.bound) {
        retryBtn.addEventListener("click", loadPostsList);
        retryBtn.dataset.bound = "true";
    }

    // 文章内重试按钮事件委托
    if (postView && !postView.dataset.bound) {
        postView.addEventListener("click", (e) => {
            if (e.target.closest(".retryPost") && currentPost) {
                loadPost(currentPost, true);
            }
        });
        postView.dataset.bound = "true";
    }
}

function resetBlogView(pushHistory = true) {
    clearHeroTimers();
    isHeroAnimating = false;
    document.title = "博客Blog - 缎金SatinAu";
    const header = document.querySelector('header');
    const searchContainer = document.querySelector('.search-container');
    const blogList = document.getElementById('blogList');
    const momentsCard = document.getElementById('momentsCard');
    
    document.body.classList.add('list-restored-view');
    if (header) header.style.display = '';
    if (searchContainer) searchContainer.style.display = '';
    if (blogList) blogList.style.display = 'grid';
    if (momentsCard) momentsCard.style.display = '';
    
    postView.style.display = "none";
    postView.classList.remove('hero-enter', 'hero-opening', 'hero-closing', 'show');
    
    // === 直接返回时也标记为已恢复，防止闪烁 ===
    listEl.classList.add('list-restored');
    listEl.classList.remove('disable-animation');
    listEl.style.display = "grid";

    // 清理 body 锁定与替身
    document.body.classList.remove('hero-open', 'hero-list-leaving', 'hero-list-entering');
    document.querySelectorAll('.hero-overlay').forEach(el => el.remove());
    
    // === 确保所有卡片的隐藏状态被移除 ===
    document.querySelectorAll('.contact-card').forEach(card => {
        card.classList.remove('is-animating');
    });

    // 如果不是通过动画关闭的（比如异常重置），尝试恢复滚动
    if (!activeCardElement && listScrollY > 0) {
        window.scrollTo(0, listScrollY);
    }

    if (typeof window.refreshScrollAnimations === 'function') {
        window.refreshScrollAnimations(true);
    }
    
    if (pushHistory && window.location.search) {
        history.pushState({}, "博客列表", "blog.html");
    }

    activeCardElement = null;
    activeCardRect = null;
}

// 加载文章列表
function loadPostsList() {
// 显示加载状态
showLoading(true);
listEl.style.display = "none";
// === 重新加载列表时，允许播放进场动画 ===
listEl.classList.remove('list-restored');

emptyState.style.display = "none";
errorState.style.display = "none";

// 使用 Promise.all 并行请求文章列表和封面索引
return Promise.all([
    fetch(`${getCdnBaseUrl()}/blog/index.json`).then(res => {
        if (!res.ok) throw new Error("文章列表加载失败");
        return res.json();
    }),
    // 封面加载失败不应该阻断文章列表显示，所以 catch 住错误返回空对象
    fetch(`${getCdnBaseUrl()}/blog/covers.json`)
        .then(res => res.ok ? res.json() : {})
        .catch(() => ({})) 
])
.then(([posts, covers]) => {
    if (!listEl || !listEl.isConnected) return;
    // 将封面数据合并到 post 对象中
    postsData = posts.map(post => ({
        ...post,
        cover: covers[post.file] || null // 如果有封面则添加，否则为 null
    }));

    renderPostsList(postsData);
    
    // 隐藏加载状态，显示列表
    if (!postView || postView.style.display === 'none') {
        listEl.style.display = "grid";
    }
    
    // 如果没有文章，显示空状态
    if (posts.length === 0) {
        listEl.style.display = "none";
        emptyState.style.display = "block";
    } else if (typeof window.refreshScrollAnimations === 'function') {
        window.refreshScrollAnimations(false);
    }
    })
    .catch(err => {
    console.error("加载文章列表失败:", err);
    if (errorState && errorState.isConnected) errorState.style.display = "block";
    throw err; // 继续抛出错误，让调用者可以捕获
    })
    .finally(() => {
    // 无论成功失败，最终都隐藏加载动画
    showLoading(false);
    });
}

// 渲染文章列表
function renderPostsList(posts) {
listEl.innerHTML = "";

posts.forEach((post) => {
    const card = document.createElement("a");
    card.className = "contact-card";
    if (post.cover) card.classList.add("has-cover");
    card.dataset.title = post.title; // 方便查找
    card.href = "javascript:void(0);";
    // 构建 HTML
    let coverHtml = '';
    if (post.cover) {
        // 插入封面 div
        coverHtml = `<div class="card-cover" style="background-image: url('${post.cover}')"></div>`;
    }

    card.innerHTML = `
    ${coverHtml}
    <div class="text">
        <div class="value">${post.title}</div>
        <div class="label">${post.date}</div>
    </div>
    `;
    
    // 点击事件 - 立即触发连贯的 Hero 展开动画
    card.addEventListener("click", (e) => {
        e.preventDefault();
        if (isHeroAnimating) return;
        openPostWithHero(card, post, true);
    });
    
    listEl.appendChild(card);
});
}

function setPostHeaderMeta(title, dateStr, statsStr = '') {
    if (postTitle) postTitle.textContent = title || '';
    if (!postDate) return;
    postDate.innerHTML = '';
    const mainSpan = document.createElement('span');
    mainSpan.className = 'post-date-main';
    mainSpan.textContent = dateStr || '';
    postDate.appendChild(mainSpan);
    if (statsStr) {
        const statsSpan = document.createElement('span');
        statsSpan.className = 'post-date-stats';
        statsSpan.textContent = ` · ${statsStr}`;
        postDate.appendChild(statsSpan);
    }
}

function captureTextMetrics(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const fontSizeNum = parseFloat(cs.fontSize) || 15;
    const lineHeightNum = parseFloat(cs.lineHeight) || fontSizeNum * 1.3;
    const lines = Math.max(1, Math.round(rect.height / Math.max(1, lineHeightNum)));
    return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        fontSize: cs.fontSize,
        fontSizeNum,
        lineHeight: Number.isFinite(parseFloat(cs.lineHeight)) ? cs.lineHeight : `${(fontSizeNum * 1.3).toFixed(2)}px`,
        lineHeightNum,
        fontWeight: cs.fontWeight,
        lines
    };
}

function createFloatingTextElement(className, text, cardMetrics, headerMetrics, initialAtHeader) {
    const el = document.createElement('div');
    el.className = className;
    if (!cardMetrics || !headerMetrics) {
        el.textContent = text;
        const m = headerMetrics || cardMetrics;
        if (m) {
            el.style.top = `${m.top}px`;
            el.style.left = `${m.left}px`;
            el.style.width = `${m.width + 2}px`;
            el.style.fontSize = m.fontSize;
            el.style.lineHeight = m.lineHeight;
            el.style.fontWeight = m.fontWeight;
        }
        return el;
    }

    const scale = headerMetrics.fontSizeNum > 0 ? (cardMetrics.fontSizeNum / headerMetrics.fontSizeNum) : 1;
    const singleLineBoth = cardMetrics.lines === 1 && headerMetrics.lines === 1;

    el.style.top = `${headerMetrics.top}px`;
    el.style.left = `${headerMetrics.left}px`;

    if (singleLineBoth) {
        const minWidthNeeded = scale > 0 ? (cardMetrics.width / scale) : headerMetrics.width;
        el.textContent = text;
        el.style.width = `${Math.max(headerMetrics.width, minWidthNeeded) + 4}px`;
        el.style.fontSize = headerMetrics.fontSize;
        el.style.lineHeight = headerMetrics.lineHeight;
        el.style.fontWeight = headerMetrics.fontWeight;
        el.style.whiteSpace = 'nowrap';
    } else {
        // 多行或跨行宽折行：使用双层等比 GPU 缩放与透明度融合，彻底避免飞行途中文字重排跳行
        el.style.width = `${headerMetrics.width + 2}px`;
        el.style.height = `${headerMetrics.height}px`;

        const cardLayer = document.createElement('div');
        cardLayer.className = 'hero-text-layer hero-layer-card';
        cardLayer.textContent = text;
        cardLayer.style.width = `${cardMetrics.width + 1}px`;
        cardLayer.style.fontSize = cardMetrics.fontSize;
        cardLayer.style.lineHeight = cardMetrics.lineHeight;
        cardLayer.style.fontWeight = cardMetrics.fontWeight;
        cardLayer.style.transform = `scale(${(scale > 0 ? (1 / scale) : 1).toFixed(4)})`;

        const headerLayer = document.createElement('div');
        headerLayer.className = 'hero-text-layer hero-layer-header';
        headerLayer.textContent = text;
        headerLayer.style.width = `${headerMetrics.width + 1}px`;
        headerLayer.style.fontSize = headerMetrics.fontSize;
        headerLayer.style.lineHeight = headerMetrics.lineHeight;
        headerLayer.style.fontWeight = headerMetrics.fontWeight;
        headerLayer.style.transform = 'scale(1)';

        el.appendChild(cardLayer);
        el.appendChild(headerLayer);
    }

    setFloatingTextState(el, cardMetrics, headerMetrics, initialAtHeader);
    return el;
}

function setFloatingTextState(el, cardMetrics, headerMetrics, toHeader) {
    if (!el || !cardMetrics || !headerMetrics) return;
    const scale = headerMetrics.fontSizeNum > 0 ? (cardMetrics.fontSizeNum / headerMetrics.fontSizeNum) : 1;
    const dx = cardMetrics.left - headerMetrics.left;
    const dy = cardMetrics.top - headerMetrics.top;

    el.style.transform = toHeader
        ? 'translate3d(0px, 0px, 0) scale(1)'
        : `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;

    const cardLayer = el.querySelector('.hero-layer-card');
    const headerLayer = el.querySelector('.hero-layer-header');
    if (cardLayer && headerLayer) {
        cardLayer.style.opacity = toHeader ? '0' : '1';
        headerLayer.style.opacity = toHeader ? '1' : '0';
    }
}

function fetchPostMarkdown(post, forceRefresh = false) {
    if (!forceRefresh && postCache.has(post.file)) {
        return Promise.resolve(postCache.get(post.file));
    }
    return fetch(`${getCdnBaseUrl()}/blog/${post.file}`).then(res => {
        if (!res.ok) throw new Error("文章加载失败");
        return res.text();
    }).then(md => {
        postCache.set(post.file, md);
        return md;
    });
}

function openPostWithHero(card, post, pushHistory = true) {
    clearHeroTimers();
    isHeroAnimating = true;
    listScrollY = window.scrollY;
    activeCardElement = card;
    activeCardRect = card.getBoundingClientRect();
    currentPost = post;
    postCache.set(post.title, post);

    if (pushHistory) {
        const encodedTitle = encodeURIComponent(post.title);
        history.pushState({ title: post.title }, post.title, `?title=${encodedTitle}`);
    }

    postError.style.display = "none";
    postContent.innerHTML = "";

    const mdPromise = fetchPostMarkdown(post, false);
    let mdResult = null;
    let mdError = null;
    let heroRevealed = false;
    let heroFinished = false;

    mdPromise.then(md => {
        mdResult = md;
        if (heroRevealed && currentPost === post) {
            renderPostBodyContent(post, md);
            showLoading(false);
        }
    }).catch(err => {
        mdError = err;
        console.error("加载文章失败:", err);
        if (heroRevealed && currentPost === post) {
            showLoading(false);
            postContent.innerHTML = "";
            postError.style.display = "block";
        }
    });

    animateHeroOpen(
        card,
        post,
        // onRevealPostView: 在列表淡出后提前挂载文章容器，使返回按钮与正文在标题飞行后半程同步淡入
        () => {
            heroRevealed = true;
            if (mdResult !== null) {
                renderPostBodyContent(post, mdResult);
            } else if (mdError) {
                postContent.innerHTML = "";
                postError.style.display = "block";
            }
        },
        // onComplete: 标题替身精准落位至吸顶标题栏后无缝交接
        () => {
            heroFinished = true;
            if (mdResult === null && !mdError) {
                showLoading(true);
            }
        }
    );
}

// Hero 展开动画逻辑：使卡片铺满全屏、标题与日期沿单一连续曲线移动至顶部吸顶标题栏
function animateHeroOpen(card, post, onRevealPostView, onComplete) {
    const header = document.querySelector('header');
    const searchContainer = document.querySelector('.search-container');
    const momentsCard = document.getElementById('momentsCard');

    // 1. 先标记卡片动画态以解除 :active 缩放，再测量卡片起点几何与排版属性
    card.classList.add('is-animating');
    const cardRect = card.getBoundingClientRect();
    const cardTitleEl = card.querySelector('.value');
    const cardDateEl = card.querySelector('.label');
    const cardTitleMetrics = captureTextMetrics(cardTitleEl);
    const cardDateMetrics = captureTextMetrics(cardDateEl);

    // 2. 在动画启动前一次性完成文章视图切换与目标坐标测量，避免动画中途 DOM 重排顿挫
    document.title = `${post.title} - 缎金SatinAu`;
    setPostHeaderMeta(post.title, post.date);
    if (header) header.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (momentsCard) momentsCard.style.display = 'none';
    if (listEl) listEl.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';

    document.body.classList.remove('hero-list-entering', 'hero-list-leaving');
    postView.classList.add('hero-enter', 'hero-opening', 'show');
    postView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });

    const headerTitleMetrics = captureTextMetrics(postTitle);
    const dateMainEl = postDate.querySelector('.post-date-main') || postDate;
    const headerDateMetrics = captureTextMetrics(dateMainEl);

    if (onRevealPostView) onRevealPostView();

    // 3. 构建分层 Hero 替身（背景卡片层 + 独立视口坐标系的标题与日期层）
    document.querySelectorAll('.hero-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'hero-overlay';

    const surface = document.createElement('div');
    surface.className = 'hero-surface';
    surface.style.top = `${cardRect.top}px`;
    surface.style.left = `${cardRect.left}px`;
    surface.style.width = `${cardRect.width}px`;
    surface.style.height = `${cardRect.height}px`;
    if (post.cover) {
        const coverDiv = document.createElement('div');
        coverDiv.className = 'card-cover';
        coverDiv.style.backgroundImage = `url('${post.cover}')`;
        surface.appendChild(coverDiv);
    }

    const floatingTitle = createFloatingTextElement(
        'hero-floating-title',
        post.title,
        cardTitleMetrics,
        headerTitleMetrics,
        false
    );
    const floatingDate = createFloatingTextElement(
        'hero-floating-date',
        post.date,
        cardDateMetrics,
        headerDateMetrics,
        false
    );

    overlay.appendChild(surface);
    overlay.appendChild(floatingTitle);
    overlay.appendChild(floatingDate);
    document.body.appendChild(overlay);
    document.body.classList.add('hero-open');

    // 强制重排以确立初始状态
    void overlay.offsetHeight;

    // 4. 启动全程单一曲线的平滑展开与标题位移动画
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    requestAnimationFrame(() => {
        overlay.classList.add('expanded');
        surface.style.top = '0px';
        surface.style.left = '0px';
        surface.style.width = `${vw}px`;
        surface.style.height = `${vh}px`;

        setFloatingTextState(floatingTitle, cardTitleMetrics, headerTitleMetrics, true);
        setFloatingTextState(floatingDate, cardDateMetrics, headerDateMetrics, true);
    });

    // 5. 动画结束，无缝交接给吸顶标题栏并移除替身
    heroCleanupTimers.push(setTimeout(() => {
        postView.classList.remove('hero-opening');
        overlay.remove();
        document.body.classList.remove('hero-open');
        isHeroAnimating = false;
        if (onComplete) onComplete();
    }, 510));
}

// Hero 收起动画逻辑：一次性切换至列表布局并沿单一连续曲线从全屏与顶部吸顶栏飞回对应卡片
function animateHeroClose(callback) {
    clearHeroTimers();
    isHeroAnimating = true;

    const headerTitleMetrics = captureTextMetrics(postTitle);
    const dateMainEl = postDate.querySelector('.post-date-main') || postDate;
    const headerDateMetrics = captureTextMetrics(dateMainEl);
    const titleText = postTitle.textContent || (currentPost ? currentPost.title : '');
    const dateText = dateMainEl.textContent ? dateMainEl.textContent.split('·')[0].trim() : (currentPost ? currentPost.date : '');
    const coverUrl = currentPost && currentPost.cover ? currentPost.cover : null;

    // 1. 在动画启动前一次性完成列表布局挂载、滚动恢复与坐标测量，杜绝动画中途切换 DOM 造成的停顿感
    const header = document.querySelector('header');
    const searchContainer = document.querySelector('.search-container');
    const momentsCard = document.getElementById('momentsCard');

    document.body.classList.add('list-restored-view', 'hero-list-entering');
    postView.style.display = 'none';
    postView.classList.remove('hero-enter', 'hero-opening', 'hero-closing', 'show');

    if (header) header.style.display = '';
    if (searchContainer) searchContainer.style.display = '';
    if (momentsCard) momentsCard.style.display = '';
    listEl.classList.add('list-restored');
    listEl.style.display = 'grid';

    const targetCard = findCardForPost(currentPost);
    if (targetCard) {
        activeCardElement = targetCard;
        targetCard.classList.add('is-animating');
    }

    window.scrollTo({ top: listScrollY, behavior: 'instant' });
    void listEl.offsetHeight;

    if (typeof window.refreshScrollAnimations === 'function') {
        window.refreshScrollAnimations(true);
    }

    let targetCardRect = targetCard ? targetCard.getBoundingClientRect() : activeCardRect;
    // 若目标卡片不在当前视口清晰区（如通过直链访问文章后返回，或卡片过于贴近视口边缘），自动将列表定位至卡片居中处
    if (targetCard && targetCardRect && (targetCardRect.bottom < 60 || targetCardRect.top > window.innerHeight * 0.72)) {
        const centeredScrollY = Math.max(0, window.scrollY + targetCardRect.top - (window.innerHeight - targetCardRect.height) * 0.42);
        listScrollY = centeredScrollY;
        window.scrollTo({ top: centeredScrollY, behavior: 'instant' });
        void listEl.offsetHeight;
        if (typeof window.refreshScrollAnimations === 'function') {
            window.refreshScrollAnimations(true);
        }
        targetCardRect = targetCard.getBoundingClientRect();
    }

    const cardTitleEl = targetCard ? targetCard.querySelector('.value') : null;
    const cardDateEl = targetCard ? targetCard.querySelector('.label') : null;
    const cardTitleMetrics = captureTextMetrics(cardTitleEl);
    const cardDateMetrics = captureTextMetrics(cardDateEl);

    // 2. 构建分层 Hero 替身：卡片表面从全屏缩回目标卡片，标题与日期从吸顶栏飞回目标卡片
    document.querySelectorAll('.hero-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'hero-overlay expanded';

    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const surface = document.createElement('div');
    surface.className = 'hero-surface';
    surface.style.top = '0px';
    surface.style.left = '0px';
    surface.style.width = `${vw}px`;
    surface.style.height = `${vh}px`;
    if (coverUrl) {
        const coverDiv = document.createElement('div');
        coverDiv.className = 'card-cover';
        coverDiv.style.backgroundImage = `url('${coverUrl}')`;
        surface.appendChild(coverDiv);
    }

    const floatingTitle = createFloatingTextElement(
        'hero-floating-title',
        titleText,
        cardTitleMetrics,
        headerTitleMetrics,
        true
    );
    const floatingDate = createFloatingTextElement(
        'hero-floating-date',
        dateText,
        cardDateMetrics,
        headerDateMetrics,
        true
    );

    overlay.appendChild(surface);
    overlay.appendChild(floatingTitle);
    overlay.appendChild(floatingDate);
    document.body.appendChild(overlay);
    document.body.classList.add('hero-open');

    void overlay.offsetHeight;

    // 3. 启动全程单一曲线（0.5s cubic-bezier(0.22, 1, 0.36, 1)）的缩回与标题飞回动画
    requestAnimationFrame(() => {
        overlay.classList.remove('expanded');

        if (!targetCardRect || targetCardRect.width === 0) {
            surface.style.opacity = '0';
        } else {
            surface.style.top = `${targetCardRect.top}px`;
            surface.style.left = `${targetCardRect.left}px`;
            surface.style.width = `${targetCardRect.width}px`;
            surface.style.height = `${targetCardRect.height}px`;
        }

        setFloatingTextState(floatingTitle, cardTitleMetrics, headerTitleMetrics, false);
        setFloatingTextState(floatingDate, cardDateMetrics, headerDateMetrics, false);
    });

    // 4. 替身精准落位至目标卡片后无缝交接
    heroCleanupTimers.push(setTimeout(() => {
        if (activeCardElement) {
            activeCardElement.classList.remove('is-animating');
        }
        overlay.remove();
        document.body.classList.remove('hero-open', 'hero-list-entering');
        isHeroAnimating = false;

        if (callback) callback();
    }, 510));
}

// 加载单篇文章（用于直链访问或重试）
function loadPost(post, forceRefresh = false) {
    currentPost = post;
    postError.style.display = "none";
    postContent.innerHTML = "";

    showLoading(true);

    fetchPostMarkdown(post, forceRefresh)
        .then(md => {
            renderPost(post, md);
        })
        .catch(err => {
            console.error("加载文章失败:", err);
            showLoading(false);
            postContent.innerHTML = "";
            postError.style.display = "block";
            postView.style.display = "block";
            const header = document.querySelector('header');
            const searchContainer = document.querySelector('.search-container');
            const blogList = document.getElementById('blogList');
            const momentsCard = document.getElementById('momentsCard');
            if (header) header.style.display = 'none';
            if (searchContainer) searchContainer.style.display = 'none';
            if (blogList) blogList.style.display = 'none';
            if (momentsCard) momentsCard.style.display = 'none';
            setPostHeaderMeta(post.title, post.date);
        });
}

// 渲染文章正文及统计信息（供直链加载与 Hero 动画共用）
function renderPostBodyContent(post, mdContent) {
    const stats = calculateReadingStats(mdContent);
    setPostHeaderMeta(post.title, post.date, stats);

    try {
        // 处理图片路径
        const processedMd = mdContent.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
            if (!src.startsWith('http://') && !src.startsWith('https://')) {
                return `![${alt}](blog/${src})`;
            }
            return match;
        });
        
        postContent.innerHTML = marked.parse(processedMd);

        // === 给表格添加滚动容器 ===
        postContent.querySelectorAll('table').forEach(table => {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });

        // 创建 AI 摘要容器
        const summaryContainer = document.createElement('div');
        summaryContainer.className = 'ai-summary-card';
        summaryContainer.style.display = 'none';

        if (postContent.firstChild) {
            postContent.insertBefore(summaryContainer, postContent.firstChild);
        } else {
            postContent.appendChild(summaryContainer);
        }

        const cacheKey = `ai_summary_${post.file}`;
        const cachedSummary = sessionStorage.getItem(cacheKey);

        if (cachedSummary) {
            renderAiSummary(summaryContainer, cachedSummary);
        } else {
            renderGenerateButton(summaryContainer, mdContent, cacheKey);
        }

        // 创建评论区容器
        const commentContainer = document.createElement('div');
        commentContainer.id = 'comments-container';
        commentContainer.style.marginTop = '40px';
        postContent.appendChild(commentContainer);

        if (typeof window.initPageComments === 'function') {
            window.initPageComments('comments-container', post.file);
        } else {
            console.warn('Comment system not initialized: initPageComments missing');
        }

        initImageViewer();

        postContent.querySelectorAll('h2').forEach(h2 => {
            h2.classList.add('visible');
        });
        
        // 处理链接跳转
        postContent.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#') && 
                !href.startsWith('http://') && 
                !href.startsWith('https://')) {
                link.setAttribute('href', `blog/${href}`);
            }
            
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
                
                link.addEventListener('click', (e) => {
                    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
                        e.preventDefault();
                        showIosAlert(href);
                    }
                });
            }
        });
    } catch (err) {
        console.error("Markdown渲染失败:", err);
        postContent.innerHTML = "<p>文章解析错误，请稍后重试</p>";
    }
}

// 渲染文章内容（直链打开或强制刷新）
function renderPost(post, mdContent) {
    document.title = `${post.title} - 缎金SatinAu`;
    const header = document.querySelector('header');
    const searchContainer = document.querySelector('.search-container');
    const blogList = document.getElementById('blogList');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const momentsCard = document.getElementById('momentsCard');
    
    if (header) header.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (blogList) blogList.style.display = 'none';
    if (momentsCard) momentsCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';

    renderPostBodyContent(post, mdContent);

    listEl.style.display = "none";
    postView.classList.remove("hero-opening");
    postView.style.display = "block";
    postView.classList.add("hero-enter", "show");

    showLoading(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
}

// 显示/隐藏加载动画
function showLoading(show) {
if (show) {
    loader.classList.add("show");
    document.querySelector('.bottom-nav').style.pointerEvents = 'auto';
} else {
    loader.classList.remove("show");
}
}

// 防抖函数
function debounce(func, wait) {
let timeout;
return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
};
}

// 初始化按钮事件监听
function initBlogButtons() {
// 返回文章列表按钮
const backToListBtn = document.getElementById('backToListBtn');
if (backToListBtn && !backToListBtn.dataset.bound) {
    backToListBtn.addEventListener('click', () => {
        closePostWithHero(true);
    });
    backToListBtn.dataset.bound = "true";
}

// 返回顶部按钮
const backToTopBtn = document.getElementById('backToTopBtn');
if (backToTopBtn && !backToTopBtn.dataset.bound) {
    backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    });
    backToTopBtn.dataset.bound = "true";
}

const shareBtn = document.getElementById('shareArticleBtn');
if (shareBtn && !shareBtn.dataset.bound) {
    shareBtn.addEventListener('click', handleShare);
    shareBtn.dataset.bound = "true";
}

const searchInput = document.getElementById('blogSearchInput');
if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.contact-card'); // 假设文章卡片用的是这个类
        
        cards.forEach(card => {
            // 获取标题或内容文本
            const text = card.textContent.toLowerCase();
            if(text.includes(keyword)) {
                card.style.display = ''; // 显示
            } else {
                card.style.display = 'none'; // 隐藏
            }
        });

        if (typeof window.refreshScrollAnimations === 'function') {
            window.refreshScrollAnimations(false);
        }
    });
    searchInput.dataset.bound = "true";
}
}

function handleShare(e) {
  // 1. 获取文章信息
  const title = postTitle ? postTitle.textContent.trim() : '未命名文章';
  
  // 从 postDate 获取日期 (格式: "2024-01-01 · 1200字")
  let date = '';
  if (postDate && postDate.textContent) {
     date = postDate.textContent.split('·')[0].trim();
  }

  // 获取纯文本摘要（排除 AI 摘要卡片和评论区内容）
  let plainText = '';
  if (postContent) {
    const contentClone = postContent.cloneNode(true);
    contentClone.querySelectorAll('.ai-summary-card, #comments-container, script, style').forEach(el => el.remove());
    plainText = contentClone.innerText || contentClone.textContent || '';
  }
  // 清理多余空白与换行
  plainText = plainText.replace(/\s+/g, ' ').trim(); 

  // 获取当前 URL
  const url = window.location.href;

  // 2. 调用 GlobalModal 生成分享卡片
  const modal = document.getElementById('globalModal');
  if (modal && modal.share) {
    const trigger = e ? e.currentTarget : document.getElementById('shareArticleBtn');
    modal.with(trigger).share(title, plainText, url, date);
  } else {
    // 降级处理：如果没有加载 html2canvas 或 modal 异常，直接复制链接
    const tempInput = document.createElement('input');
    document.body.appendChild(tempInput);
    tempInput.value = url;
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    if(typeof showToast === 'function') showToast('已复制文章链接');
    else alert('已复制链接');
  }
}

function initImageViewer() {
    // 销毁已存在的viewer实例（如果有）
    if (window.imageViewer) {
        window.imageViewer.destroy();
        window.imageViewer = null;
    }
    
    // 排除评论头像 (.comment-avatar) 和评论区容器 (#comments-container) 内的图片
    const validImages = Array.from(postContent.querySelectorAll('img')).filter(img => {
        return !img.classList.contains('comment-avatar') && 
               !img.closest('#comments-container') &&
               !img.classList.contains('ai-icon'); // 如果有 AI 摘要图标也排除
    });

    // 如果文章本身没有图片，直接返回，不初始化 Viewer
    if (validImages.length === 0) return;
    
    // 为图片容器初始化查看器
    window.imageViewer = new Viewer(postContent, {
        filter: function(image) {
            // 返回 false 表示不进入查看器列表
            return !image.classList.contains('comment-avatar') && 
                   !image.closest('#comments-container') &&
                   !image.classList.contains('ai-icon');
        },
        title: function(img) {
            const articleTitle = postTitle?.textContent;
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            return `${articleTitle} (${width} × ${height})`;
        },
        backdrop: true,
        toolbar: true,
        navbar: true,
        tooltip: true,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: true,
        transition: true,
        fullscreen: true,
        keyboard: true,
        className: 'viewer-custom',
        beforeShow: function() {
            document.body.style.overflow = 'hidden';
        },
        hidden: function() {
            document.body.style.overflow = '';
        }
    });
}

// 初始化博客页面
document.addEventListener('DOMContentLoaded', initBlog);

function calculateReadingStats(mdText) {
  const chineseCount = (mdText.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishCount = (mdText.match(/[a-zA-Z]+/g) || []).length;

  const totalCount = chineseCount + englishCount;

  // 阅读时长中文按 300字/分钟 英文按 200词/分钟
  const readingMinutes = Math.max(
    Math.ceil(chineseCount / 300),
    Math.ceil(englishCount / 200)
  );

  return `${totalCount} 字 · 约 ${readingMinutes} 分钟`;
}

/* ========== AI Summary Helper Functions ========== */

// 渲染 AI 结果
function renderAiSummary(container, text) {
    container.style.display = 'block';
    // 简单的打字机效果模拟
    container.innerHTML = `
        <div class="ai-header">
            <svg class="ai-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="url(#gemini_grad)"/>
                <defs>
                    <linearGradient id="gemini_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#4285F4"/>
                        <stop offset="1" stop-color="#D96570"/>
                    </linearGradient>
                </defs>
            </svg>
            AI 摘要
        </div>
        <div class="ai-content"></div>
    `;

    // 获取内容容器并执行打字机特效
    const contentBox = container.querySelector('.ai-content');
    typewriterEffect(contentBox, text);
}

function typewriterEffect(element, text) {
    element.innerHTML = ''; // 清空现有内容
    
    let chars;

    // 尝试使用 Intl.Segmenter
    if (window.Intl && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
        // 将迭代器转换为数组，提取 segment 属性
        chars = Array.from(segmenter.segment(text), s => s.segment);
    } 
    // 降级方案：使用 ES6 扩展运算符
    else {
        chars = [...text]; 
    }
    
    const fragment = document.createDocumentFragment();
    
    chars.forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.className = 'ai-char';
        
        // 设置递增的延迟时间
        span.style.animationDelay = `${index * 0.02}s`;
        
        fragment.appendChild(span);
    });
    
    element.appendChild(fragment);
}

// 渲染生成按钮及处理点击事件
function renderGenerateButton(container, rawMarkdown, cacheKey) {
    container.style.display = 'block';
    container.innerHTML = ''; // 清空

    const btn = document.createElement('button');
    btn.className = 'ai-generate-btn';
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,1L17.74,3.75L15,5L17.74,6.26L19,9L20.25,6.26L23,5L20.25,3.75M9,4L6.5,9.5L1,12L6.5,14.5L9,20L11.5,14.5L17,12L11.5,9.5M19,15L17.74,17.74L15,19L17.74,20.25L19,23L20.25,20.25L23,19L20.25,17.74"/>
        </svg>
        生成 AI 摘要
    `;
    
    // 提示文字
    const hint = document.createElement('span');
    hint.style.fontSize = '12px';
    hint.style.opacity = '0.5';
    hint.style.marginLeft = '10px';
    hint.textContent = 'Powered by Gemini';

    container.appendChild(btn);
    container.appendChild(hint);

    btn.addEventListener('click', async () => {
        // UI 切换为加载状态
        btn.disabled = true;
        btn.innerHTML = '<div class="ai-loading-spinner"></div> 正在思考...';
        hint.textContent = '需要几秒钟...';

        try {
            // 1. 清理 Markdown 符号，减少 Token 消耗
            const cleanText = rawMarkdown
                .replace(/!\[.*?\]\(.*?\)/g, '') // 去除图片
                .replace(/[#*`\[\]()]/g, '')     // 去除特殊符
                .substring(0, 10000);            // 截断

            // 2. 发送请求给 Cloudflare Worker
            const WORKER_URL = "https://blog-ai-summary.satinau.cn"; 

            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: cleanText })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '请求失败');
            }

            // 3. 成功，保存并显示
            const summary = data.summary;
            sessionStorage.setItem(cacheKey, summary); // 缓存到会话
            renderAiSummary(container, summary);

        } catch (err) {
            console.error('AI Summary Error:', err);
            // 恢复按钮状态，允许重试
            btn.disabled = false;
            btn.innerHTML = '⚠️ 生成失败，点击重试';
            hint.textContent = '网络有点问题';
            
            // 使用现有的 Toast 组件报错
            if (typeof showToast === 'function') {
                showToast('AI 摘要生成失败，请重试');
            }
        }
    });
}