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
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const emailLoginBtn = document.getElementById('emailLoginBtn');
const signupBtn = document.getElementById('signupBtn');
const githubLoginBtn = document.getElementById('githubLoginBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const authError = document.getElementById('authError');
const tabBtns = document.querySelectorAll('.tab-btn');
const authTabs = document.querySelectorAll('.auth-tab');

// 缓存机制
const postCache = new Map();
let postsData = [];
let currentPost = null;

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

    checkUserSession();
    setupAuthEventListeners();
    setupAuthStateListener();
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
        // 显示头部和列表区域
        const header = document.querySelector('header');
        const sectionTitle = document.querySelector('section h2');
        const blogList = document.getElementById('blogList');
        const momentsCard = document.getElementById('momentsCard');
        if (header) header.style.display = '';
        if (sectionTitle) sectionTitle.style.display = '';
        if (blogList) blogList.style.display = 'grid'; // 恢复列表显示
        if (momentsCard) momentsCard.style.display = '';
        postView.style.display = "none";
        listEl.style.display = "grid";
    }
    });

    // 检查用户会话
    async function checkUserSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('会话检查失败:', error);
        return;
    }

    if (session) {
        showUserInfo(session.user);
    } else {
        showLoginButton();
    }
    }

    // 显示用户信息
    function showUserInfo(user) {
    // 从元数据中优先获取用户名
    const meta = user.raw_user_meta_data || {};
    const displayName = meta.name || meta.user_name || meta.preferred_username || user.email;
    userInfo.innerHTML = `欢迎, ${displayName}`;
    userInfo.style.display = 'inline-block';
    logoutBtn.style.display = 'inline-block';
    loginBtn.style.display = 'none';
    }

    // 显示登录按钮
    function showLoginButton() {
    loginBtn.style.display = 'inline-block';
    userInfo.style.display = 'none';
    logoutBtn.style.display = 'none';
    }

    function setupAuthStateListener() {
    // 监听登录状态变化（包括OAuth回调）
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
        // 登录成功，显示用户信息
        showUserInfo(session.user);
        // 关闭登录弹窗（如果打开）
        authOverlay.style.display = 'none';
        authOverlay.classList.remove('show');
        authModal.classList.remove('show');
        showToast('登录成功');
        } else if (event === 'SIGNED_OUT') {
        // 登出成功
        showLoginButton();
        showToast('已退出登录');
        }
    });
    }

    // 设置认证事件监听
    function setupAuthEventListeners() {
    // 登录按钮
    loginBtn.addEventListener('click', () => {
        authOverlay.style.display = 'block';
        authOverlay.classList.add('show');
        authModal.classList.add('show');
    });

    // 关闭弹窗
    closeAuthModal.addEventListener('click', () => {
        authOverlay.style.display = 'none';
        authOverlay.classList.remove('show');
        authModal.classList.remove('show');
        authError.textContent = '';
    });

    // 标签切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        authTabs.forEach(t => t.style.display = 'none');
        btn.classList.add('active');
        document.getElementById(`${tab}Tab`).style.display = 'block';
        });
    });

    // 邮箱登录
    emailLoginBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
        });

        if (error) {
        authError.textContent = error.message;
        } else {
        showUserInfo(data.user);
        authOverlay.style.display = 'none';
        authOverlay.classList.remove('show');
        authModal.classList.remove('show');
        }
    });

    // 注册新用户
    signupBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: window.location.origin
        }
        });

        if (error) {
        authError.textContent = error.message;
        } else {
        authError.textContent = '注册成功';
        authError.style.color = 'green'; // 改为绿色提示
        document.getElementById('emailTab').style.display = 'block';
        document.getElementById('oauthTab').style.display = 'none';
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="email"]').classList.add('active');
        }
    });

    // GitHub 登录
    githubLoginBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            // 指定回调地址
            redirectTo: window.location.origin + '/blog'
        }
        });

        if (error) {
        authError.textContent = error.message;
        }
    });

    // Google 登录
    googleLoginBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
        });
        
        if (error) {
        authError.textContent = error.message;
        }
    });

    // 退出登录
    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
        showLoginButton();
        }
    });

    // 监听认证状态变化
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
        showUserInfo(session.user);
        } else {
        showLoginButton();
        }
    });
    }

    // 返回列表按钮事件
    backToList.addEventListener("click", () => {
        // 恢复默认页面 title
        document.title = "博客Blog - 缎金SatinAu";
        // 显示头部和列表区域
        const header = document.querySelector('header');
        const sectionTitle = document.querySelector('section h2');
        const blogList = document.getElementById('blogList');
        const momentsCard = document.getElementById('momentsCard');
        if (header) header.style.display = '';
        if (sectionTitle) sectionTitle.style.display = '';
        if (blogList) blogList.style.display = 'grid'; // 恢复列表显示
        if (momentsCard) momentsCard.style.display = '';
        postView.style.display = "none";
        listEl.style.display = "grid";
        history.pushState({}, "博客列表", "blog.html");
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

// 加载文章列表
function loadPostsList() {
// 显示加载状态
showLoading(true);
listEl.style.display = "none";
emptyState.style.display = "none";
errorState.style.display = "none";

// 显式返回 fetch 的 Promise 链
return fetch("https://blog.satinau.cn/index.json")
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
    card.href = "javascript:void(0);";
    card.innerHTML = `
    <div class="text">
        <div class="value">${post.title}</div>
        <div class="label">${post.date}</div>
    </div>
    `;
    
    // 点击事件 - 使用防抖处理
    card.addEventListener("click", debounce(() => {
    // 保存当前文章到缓存
    currentPost = post;
    postCache.set(post.title, post);
    
    // 更新URL，添加标题参数（使用encodeURIComponent处理特殊字符）
    const encodedTitle = encodeURIComponent(post.title);
    history.pushState({ title: post.title }, post.title, `?title=${encodedTitle}`);
    
    // 加载文章内容
    loadPost(post);
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

// 加载单篇文章
function loadPost(post, forceRefresh = false) {
currentPost = post;
postError.style.display = "none";
postContent.innerHTML = "";

// 显示加载动画
showLoading(true);

// 检查缓存
if (!forceRefresh && postCache.has(post.file)) {
    renderPost(post, postCache.get(post.file));
    showLoading(false);
    return;
}

// 从网络加载
fetch(`https://blog.satinau.cn/${post.file}`)
    .then(res => {
    if (!res.ok) throw new Error("文章加载失败");
    return res.text();
    })
    .then(md => {
    // 存入缓存
    postCache.set(post.file, md);
    renderPost(post, md);
    })
    .catch(err => {
    console.error("加载文章失败:", err);
    showLoading(false);
    postContent.innerHTML = "";
    postError.style.display = "block";
    });
}

// 渲染文章内容
function renderPost(post, mdContent) {
    document.title = `${post.title} - 缎金SatinAu`;
    // 隐藏"最新文章"及其上方所有元素
    const header = document.querySelector('header');
    const sectionTitle = document.querySelector('section h2'); // 最新文章标题
    const blogList = document.getElementById('blogList');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const momentsCard = document.getElementById('momentsCard');
    
    // 隐藏头部和列表区域
    if (header) header.style.display = 'none';
    if (sectionTitle) sectionTitle.style.display = 'none';
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

    // 触发文章淡入动画
    postView.classList.remove("animate");
    void postView.offsetWidth; // 强制重绘
    postView.classList.add("animate");

    // 隐藏加载动画
    showLoading(false);

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // 恢复默认页面 title
    document.title = "博客Blog - 缎金SatinAu";
    // 显示头部和列表区域
    const header = document.querySelector('header');
    const sectionTitle = document.querySelector('section h2');
    const blogList = document.getElementById('blogList');
    const momentsCard = document.getElementById('momentsCard');
    if (header) header.style.display = '';
    if (sectionTitle) sectionTitle.style.display = '';
    if (blogList) blogList.style.display = 'grid'; // 恢复列表显示
    if (momentsCard) momentsCard.style.display = '';
    postView.style.display = 'none';
    listEl.style.display = 'grid';
    history.pushState({}, "博客列表", "blog.html");
    emptyState.style.display = 'none';
    window.scrollTo(0, 0);
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

const downloadBtn = document.getElementById('downloadArticle');
if (downloadBtn) {
downloadBtn.addEventListener('click', downloadCurrentArticle);
}

function downloadCurrentArticle() {
// 获取文章标题和内容
const title = postTitle ? postTitle.textContent.trim() : '未命名文章';
const date = postDate ? postDate.textContent.trim() : '';
const content = postContent ? postContent.innerText.trim() : '';

// 构建要下载的文本内容
let textContent = `${title}\n\n`;
if (date) textContent += `发布日期: ${date}\n\n`;
textContent += content;
textContent += `\n---\n`;
textContent += `作者: 缎金SatinAu\n`;
textContent += `来源: https://satinau.cn/\n`;

// 创建Blob对象
const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });

// 创建下载链接
const a = document.createElement('a');
const url = URL.createObjectURL(blob);

// 设置下载属性
a.href = url;
a.download = `${title.replace(/\s+/g, '_')}.txt`; // 替换空格为下划线

// 触发下载
document.body.appendChild(a);
a.click();

// 清理
setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('开始下载文章TXT');
}, 0);
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

  return `字数：${totalCount} · 阅读时间：${readingMinutes} 分钟`;
}