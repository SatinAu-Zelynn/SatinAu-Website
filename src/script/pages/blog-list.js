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

/* ========== 博客列表页面逻辑 ========== */

// DOM元素引用
const listEl = document.getElementById("blogList");
const loader = document.getElementById("loadingOverlay");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const retryBtn = document.getElementById("retryBtn");
const searchInput = document.getElementById("blogSearchInput");

let postsData = [];

// 初始化
function initBlog() {
    // 先显示加载状态
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (loader) loader.classList.add("show");

    loadPostsList().finally(() => {
        if (loader) loader.classList.remove("show");
    });

    // 重试按钮
    if (retryBtn) {
        retryBtn.addEventListener("click", loadPostsList);
    }
    
    // 搜索功能
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.contact-card:not([data-moments="true"])');
            
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = text.includes(keyword) ? '' : 'none';
            });
        });
    }
}

// 加载文章列表
function loadPostsList() {
    if (listEl) listEl.style.display = "none";
    if (emptyState) emptyState.style.display = "none";
    if (errorState) errorState.style.display = "none";

    return fetch("/blog/index.json")
        .then(res => {
            if (!res.ok) throw new Error("网络响应异常");
            return res.json();
        })
        .then(posts => {
            postsData = posts;
            renderPostsList(posts);
            
            if (listEl) listEl.style.display = "grid";
            
            if (posts.length === 0) {
                if (listEl) listEl.style.display = "none";
                if (emptyState) emptyState.style.display = "block";
            }
        })
        .catch(err => {
            console.error("加载文章列表失败:", err);
            if (errorState) errorState.style.display = "block";
            throw err;
        });
}

// 将标题转换为URL-safe的slug
function titleToSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 100);
}

// 渲染文章列表
function renderPostsList(posts) {
    if (!listEl) return;
    
    listEl.innerHTML = "";

    posts.forEach((post) => {
        const card = document.createElement("a");
        card.className = "contact-card";
        const slug = titleToSlug(post.title);
        card.href = `/blog/${slug}/`;
        card.innerHTML = `
            <div class="text">
                <div class="value">${post.title}</div>
                <div class="label">${post.date}</div>
            </div>
        `;
        
        listEl.appendChild(card);
    });

    // 错位淡入动画
    const cards = document.querySelectorAll('.contact-card, h2');
    const observer = new IntersectionObserver((entries) => {
        const visibleCards = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

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
}

// 初始化博客列表页面
document.addEventListener('DOMContentLoaded', initBlog);
