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
const listEl = document.getElementById("blogList");
const postView = document.getElementById("postView");
const postTitle = document.getElementById("postTitle");
const postDate = document.getElementById("postDate");
const postContent = document.getElementById("postContent");
const backToList = document.getElementById("backToList");
const loader = document.getElementById("loadingOverlay");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const retryBtn = document.getElementById("retryBtn");
const postError = document.getElementById("postError");

// 缓存机制
const postCache = new Map();
let postsData = [];
let currentPost = null;

// 存储动画状态
let activeCardElement = null; // 当前点击的卡片 DOM 元素
let activeCardRect = null;    // 卡片点击时的位置尺寸信息
let listScrollY = 0;

// 初始化
function initBlog() {
    // 先隐藏错误状态，显示加载状态
    const loader = document.getElementById("loadingOverlay");
    const emptyState = document.getElementById("emptyState");
    const errorState = document.getElementById("errorState");

    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (loader) loader.classList.add("show");

    loadPostsList().finally(() => {
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
        
        if (cachedPost) {
        loadPost(cachedPost);
        } else {
        // 缓存中没有则先加载列表再查找
        loadPostsList().then(() => {
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
        });
        }
    }

    window.addEventListener('popstate', (event) => {
    if (event.state && event.state.title) {
        // 后退到某篇文章
        const post = postCache.get(event.state.title) || 
                    postsData.find(p => p.title === event.state.title);
        if (post) {
        loadPost(post);
        }
    } else {
        // 恢复默认页面 title
            document.title = "博客Blog - 缎金SatinAu";
            
            // 如果当前有激活的卡片（说明是从文章页退回来的），执行收缩动画
            if (activeCardElement) {
                animateHeroClose(() => {
                    resetBlogView();
                });
            } else {
                // 否则直接重置视图（防止卡片消失）
                resetBlogView();
            }
        }
    });

    // 返回列表按钮事件 (保持之前的逻辑，它会调用 animateHeroClose)
    backToList.addEventListener("click", () => {
        if (activeCardElement) {
            animateHeroClose(() => {
                resetBlogView();
            });
        } else {
            resetBlogView();
        }
    });

    // 重试按钮事件
    retryBtn.addEventListener("click", loadPostsList);

    // 文章内重试按钮事件委托
    postView.addEventListener("click", (e) => {
        if (e.target.closest(".retryPost") && currentPost) {
        loadPost(currentPost, true);
        }
    });
}

function resetBlogView() {
    document.title = "博客Blog - 缎金SatinAu";
    const header = document.querySelector('header');
    const searchContainer = document.querySelector('.search-container');
    const blogList = document.getElementById('blogList');
    const momentsCard = document.getElementById('momentsCard');
    
    if (header) header.style.display = '';
    if (searchContainer) searchContainer.style.display = '';
    if (blogList) blogList.style.display = 'grid';
    if (momentsCard) momentsCard.style.display = '';
    
    postView.style.display = "none";
    postView.classList.remove('hero-enter', 'show');
    
    // === 直接返回时也标记为已恢复，防止闪烁 ===
    listEl.classList.add('list-restored');
    listEl.style.display = "grid";

    // 清理 body 锁定
    document.body.classList.remove('hero-open');
    
    // === 确保所有卡片的隐藏状态被移除 ===
    // 防止浏览器后退时卡片 opacity: 0
    document.querySelectorAll('.contact-card').forEach(card => {
        card.classList.remove('is-animating');
    });

    // 如果不是通过动画关闭的（比如异常重置），尝试恢复滚动
    if (!activeCardElement && listScrollY > 0) {
        window.scrollTo(0, listScrollY);
    }
    
    // 只有在手动点击返回按钮时才 pushState，浏览器后退(popstate)不需要
    // 这里需要根据调用来源区分，但简化起见，popstate 触发时通常 URL 已经变了
    // 如果 URL 还是 blog.html，就不 push
    if (!window.location.search) {
       // 已经是列表页 URL，不做操作
    } else {
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

// 显式返回 fetch 的 Promise 链
return fetch("https://blog.satinau.cn/blog/index.json")
    .then(res => {
    if (!res.ok) throw new Error("网络响应异常");
    return res.json();
    })
    .then(posts => {
    postsData = posts;
    renderPostsList(posts);
    
    // 隐藏加载状态，显示列表
    listEl.style.display = "grid";
    
    // 如果没有文章，显示空状态
    if (posts.length === 0) {
        listEl.style.display = "none";
        emptyState.style.display = "block";
    }
    })
    .catch(err => {
    console.error("加载文章列表失败:", err);
    errorState.style.display = "block";
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

posts.forEach((post, index) => {
    const card = document.createElement("a");
    card.className = "contact-card";
    card.dataset.title = post.title; // 方便查找
    card.href = "javascript:void(0);";
    card.innerHTML = `
    <div class="text">
        <div class="value">${post.title}</div>
        <div class="label">${post.date}</div>
    </div>
    `;
    
    // 点击事件 - 增加动画逻辑
    card.addEventListener("click", debounce((e) => {
        // === 修复 Issue 2: 记录当前滚动位置 ===
        listScrollY = window.scrollY;
        
        activeCardElement = card;
        activeCardRect = card.getBoundingClientRect(); // 记录相对于视口的位置

        currentPost = post;
        postCache.set(post.title, post);
        
        // 锁定 body 防止滚动
        document.body.classList.add('hero-open');

        animateHeroOpen(card, post, () => {
            const encodedTitle = encodeURIComponent(post.title);
            history.pushState({ title: post.title }, post.title, `?title=${encodedTitle}`);
            loadPost(post);
        });
    }, 300));
    
    listEl.appendChild(card);

    // 错位淡入动画
    const cards = document.querySelectorAll('.contact-card, h2');
    const observer = new IntersectionObserver((entries) => {
      // 收集当前可见的卡片
      const visibleCards = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      // 对可见卡片按顺序添加动画，每组最多3张同时显示
      visibleCards.forEach((entry, index) => {
        if (!entry.target.classList.contains('visible')) {
          entry.target.style.animationDelay = `${Math.floor(index / 3) * 0.2 + (index % 3) * 0.2}s`;
          entry.target.classList.add('visible');
        }
      });
    }, { 
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    });

    cards.forEach(card => observer.observe(card));
});
}

// Hero 展开动画逻辑
function animateHeroOpen(card, post, onAnimationStart) {
    // 创建替身元素 (Hero Overlay)
    const overlay = document.createElement('div');
    overlay.className = 'hero-overlay';
    
    // 设置初始位置（与卡片完全重合）
    const rect = activeCardRect;
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    
    // 填充内容以实现平滑过渡
    overlay.innerHTML = `
        <div class="text-container">
            <div class="hero-title">${post.title}</div>
            <div class="hero-date">${post.date}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    // 隐藏原卡片
    requestAnimationFrame(() => {
        card.classList.add('is-animating');
        
        // 强制重绘后执行动画到全屏
        requestAnimationFrame(() => {
            overlay.classList.add('expanded');
            
            // 目标位置：全屏覆盖
            overlay.style.top = '0px';
            overlay.style.left = '0px';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            
            // 回调：开始加载数据
            if (onAnimationStart) onAnimationStart();
            
            // 动画结束后处理
            setTimeout(() => {
                // 显示真正的文章容器，但内容由 loadPost 控制 fade in
                // 这里的 500ms 对应 CSS transition 时间
                overlay.remove(); 
            }, 500);
        });
    });
}

// Hero 收起动画逻辑
function animateHeroClose(callback) {
    // 创建全屏替身 (从当前全屏状态开始)
    const overlay = document.createElement('div');
    overlay.className = 'hero-overlay expanded';
    overlay.style.top = '0px';
    overlay.style.left = '0px';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    
    const title = postTitle.textContent;
    const dateText = postDate.textContent ? postDate.textContent.split('·')[0] : '';
    
    overlay.innerHTML = `
        <div class="text-container" style="opacity: 0;">
            <div class="hero-title">${title}</div>
            <div class="hero-date">${dateText}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 隐藏文章视图，恢复列表环境
    postView.style.display = 'none';
    
    const header = document.querySelector('header');
    const searchContainer = document.querySelector('.search-container');
    const blogList = document.getElementById('blogList');
    const momentsCard = document.getElementById('momentsCard');
    
    if (header) header.style.display = '';
    if (searchContainer) searchContainer.style.display = '';
    if (momentsCard) momentsCard.style.display = '';
    
    // === 标记列表为“已恢复”状态 ===
    // 这会让 CSS 跳过 staggerFade 动画，直接显示卡片
    listEl.classList.add('list-restored');

    // 禁止动画（用于过渡期间的绝对静止）
    listEl.classList.add('disable-animation');
    listEl.style.display = "grid";

    // 恢复滚动位置
    window.scrollTo(0, listScrollY);
    
    // 解锁 body 滚动
    document.body.classList.remove('hero-open');

    // === 强制浏览器重排 (Force Reflow) ===
    // 这行代码迫使浏览器立刻计算布局，确保卡片回到了正确位置，且没有动画干扰
    void listEl.offsetHeight; 

    // 重新计算目标位置
    // 此时卡片是静止的，获取的坐标是 100% 准确的
    let targetRect = activeCardRect; 
    if (activeCardElement) {
        targetRect = activeCardElement.getBoundingClientRect();
    }

    // 执行收缩动画
    requestAnimationFrame(() => {
        // 移除 expanded 类，触发 CSS transition
        overlay.classList.remove('expanded');
        
        const textContainer = overlay.querySelector('.text-container');
        if (textContainer) textContainer.style.opacity = '1';

        // 飞回目标位置
        // 增加容错：如果 targetRect 异常，淡出销毁
        if (!targetRect || targetRect.width === 0) {
             overlay.style.opacity = 0;
        } else {
            overlay.style.top = `${targetRect.top}px`;
            overlay.style.left = `${targetRect.left}px`;
            overlay.style.width = `${targetRect.width}px`;
            overlay.style.height = `${targetRect.height}px`;
        }

        // 动画结束后清理
        setTimeout(() => {
            // 移除替身
            overlay.remove();
            
            if (activeCardElement) {
                activeCardElement.classList.remove('is-animating');
            }
            
            // 移除“禁止动画”锁，恢复鼠标 Hover 效果
            // 注意：此时 .list-restored 依然保留，所以不会触发进场动画
            requestAnimationFrame(() => {
                listEl.classList.remove('disable-animation');
            });

            if (callback) callback();
        }, 500);
    });
}

// 加载单篇文章
function loadPost(post, forceRefresh = false) {
currentPost = post;
postError.style.display = "none";
postContent.innerHTML = "";

// 显示加载动画
showLoading(true);

// 检查缓存
if (!forceRefresh && postCache.has(post.file)) {
    // 稍微延迟渲染，等待 Hero 动画遮盖住屏幕
    setTimeout(() => {
        renderPost(post, postCache.get(post.file));
    }, 300); // 稍微延迟一点点，让 Hero 动画先跑起来，体验更流畅
    return;
}

// 从网络加载
fetch(`https://blog.satinau.cn/blog/${post.file}`)
    .then(res => {
        if (!res.ok) throw new Error("文章加载失败");
        return res.text();
    })
    .then(md => {
        postCache.set(post.file, md);
        renderPost(post, md);
    })
    .catch(err => {
        console.error("加载文章失败:", err);
        showLoading(false);
        postContent.innerHTML = "";
        postError.style.display = "block";
        // 如果出错，也要显示视图容器以便显示错误信息
        postView.style.display = "block";
        // 隐藏列表等
        const header = document.querySelector('header');
        const searchContainer = document.querySelector('.search-container');
        const blogList = document.getElementById('blogList');
        if (header) header.style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'none';
        if (blogList) blogList.style.display = 'none';
    });
}

// 渲染文章内容
function renderPost(post, mdContent) {
    document.title = `${post.title} - 缎金SatinAu`;
    // 隐藏"最新文章"及其上方所有元素
    const header = document.querySelector('header');
    const searchContainer = document.querySelector('.search-container'); // 最新文章标题
    const blogList = document.getElementById('blogList');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const momentsCard = document.getElementById('momentsCard');
    
    // 隐藏头部和列表区域
    if (header) header.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (blogList) blogList.style.display = 'none';
    if (momentsCard) momentsCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';

    postTitle.textContent = post.title;
    // 字数统计 & 阅读时间
    const stats = calculateReadingStats(mdContent);
    postDate.textContent = `${post.date} · ${stats}`;

    // 优化Markdown渲染
    try {
        // 处理图片路径
        const processedMd = mdContent.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
        // 如果是相对路径，添加前缀
        if (!src.startsWith('http://') && !src.startsWith('https://')) {
            return `![${alt}](blog/${src})`;
        }
        return match;
        });
        
        postContent.innerHTML = marked.parse(processedMd);

        // 创建容器
        const summaryContainer = document.createElement('div');
        summaryContainer.className = 'ai-summary-card';
        summaryContainer.style.display = 'none'; // 默认隐藏

        // 插入到文章最顶部
        if (postContent.firstChild) {
            postContent.insertBefore(summaryContainer, postContent.firstChild);
        } else {
            postContent.appendChild(summaryContainer);
        }

        // 检查缓存 (避免重复请求)
        // 使用 "ai_summary_" + 文章文件名作为 key
        const cacheKey = `ai_summary_${post.file}`;
        const cachedSummary = sessionStorage.getItem(cacheKey);

        if (cachedSummary) {
            // 如果有缓存，直接显示结果
            renderAiSummary(summaryContainer, cachedSummary);
        } else {
            // 如果没缓存，显示生成按钮
            renderGenerateButton(summaryContainer, mdContent, cacheKey);
        }

        // 插入评论区容器已移除，评论系统已下线
        // Supabase 后端已下线

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
        
        // 外部链接处理
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            
            // 对于iOS设备使用弹窗确认
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

    // 显示文章视图
    listEl.style.display = "none";
    postView.style.display = "block";

    // 添加 hero-enter 类，配合 CSS 实现内容淡入 (替代原本的 BlurFadeUp)
    postView.classList.add("hero-enter");
    
    // 稍微延迟让 display:block 生效，然后添加 show 触发淡入
    requestAnimationFrame(() => {
        postView.classList.add("show");
    });

    showLoading(false);
    window.scrollTo({ top: 0, behavior: 'instant' }); // 瞬间滚到顶部，避免动画时看到半截
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
if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
            // 复用动画关闭逻辑
        if (activeCardRect && activeCardElement) {
            animateHeroClose(() => {
                resetBlogView();
            });
        } else {
            resetBlogView();
        }
    });
}

// 返回顶部按钮
const backToTopBtn = document.getElementById('backToTopBtn');
if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    });
}
}

const shareBtn = document.getElementById('shareArticleBtn');
if (shareBtn) {
  shareBtn.addEventListener('click', handleShare);
}

function handleShare() {
  // 1. 获取文章信息
  const title = postTitle ? postTitle.textContent.trim() : '未命名文章';
  
  // 从 postDate 获取日期 (格式: "2024-01-01 · 1200字")
  let date = '';
  if (postDate && postDate.textContent) {
     date = postDate.textContent.split('·')[0].trim();
  }

  // 获取纯文本摘要
  // 过滤掉 markdown 符号，只留前 100 字
  let plainText = postContent ? postContent.innerText : '';
  // 简单的清理逻辑，移除多余空行
  plainText = plainText.replace(/\n+/g, ' ').trim(); 

  // 获取当前 URL
  const url = window.location.href;

  // 2. 调用 GlobalModal 生成分享卡片
  const modal = document.getElementById('globalModal');
  if (modal && modal.share) {
    modal.share(title, plainText, url, date);
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
    
    // 选择文章中所有图片
    const postImages = postContent.querySelectorAll('img');
    if (postImages.length === 0) return;
    
    // 为图片容器初始化查看器
    window.imageViewer = new Viewer(postContent, {
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

const searchInput = document.getElementById('blogSearchInput');
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
});