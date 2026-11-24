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

(function() {
const API_BASE = '';

let pollingInterval = null;
let currentComments = [];

window.cleanupPageComments = function() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
};

// 监听全局登录状态变动，实时同步评论区登录态显示
window.addEventListener('auth-status-changed', () => {
    checkLoginState();
});

// 为了让全局函数能获取 pageId
const originalInit = window.initPageComments;
window.initPageComments = async function(containerId, pageId) {
    window.cleanupPageComments();
    window.currentPageId = pageId; // 保存全局变量
    
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. 渲染基础框架
    container.innerHTML = `
        <div class="comments-section">
            <h3 class="comments-title">评论 <span id="commentCount" style="font-size:0.8em;opacity:0.6;font-weight:normal"></span></h3>
            
            <!-- 输入区域 -->
            <div id="commentInputArea" class="comment-input-wrapper">
                <!-- 登录后显示 -->
                <div id="loggedInView" style="display:none;">
                    <div class="comment-header" style="margin-bottom:10px; align-items:center;">
                        <img id="myAvatar" src="" class="comment-avatar" style="width:32px!important;height:32px!important;">
                        <span id="myNickname" style="font-weight:bold; margin-left:10px;"></span>
                        <button id="logoutLink" style="margin-left:auto; font-size:12px; background:none; border:none; color:var(--primary-color); cursor:pointer;">退出</button>
                    </div>
                    <textarea id="mainCommentText" class="comment-textarea" placeholder="写下你的想法..."></textarea>
                    <div class="comment-actions">
                        <span class="comment-tip">支持 Markdown 语法</span>
                        <button type="button" id="submitCommentBtn" class="comment-submit-btn">发表评论</button>
                    </div>
                </div>

                <!-- 未登录显示 -->
                <div id="guestView" style="text-align:center; padding: 20px;">
                    <p style="margin-bottom:15px;">登录后参与讨论</p>
                    <button id="goToLoginBtn" class="comment-submit-btn">去登录 / 注册</button>
                </div>
            </div>

            <!-- 列表区域 -->
            <div id="commentList" class="comment-list">
                <div style="text-align:center; padding:20px; color:#888;">正在加载评论...</div>
            </div>
        </div>
    `;

    // 2. 检查登录状态
    checkLoginState();

    // 3. 加载评论数据
    await loadComments(pageId);

    // 4. 绑定事件
    bindEvents(pageId);
};

// 检查登录状态并切换视图
function checkLoginState() {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_info');
    
    const loggedInView = document.getElementById('loggedInView');
    const guestView = document.getElementById('guestView');
    const myAvatar = document.getElementById('myAvatar');
    const myNickname = document.getElementById('myNickname');
    if (!loggedInView || !guestView) return;

    if (token && userStr) {
        const user = JSON.parse(userStr);
        loggedInView.style.display = 'block';
        guestView.style.display = 'none';
        myNickname.textContent = user.nickname;
        myAvatar.src = user.avatar || '/public/guest.png';
    } else {
        loggedInView.style.display = 'none';
        guestView.style.display = 'block';
    }
}

function startPendingPolling(pageId) {
    if (!pollingInterval) {
        pollingInterval = setInterval(() => loadComments(pageId, { silent: true }), 1500);
    }
}

function renderCommentList(comments, pageId) {
    const listEl = document.getElementById('commentList');
    const countEl = document.getElementById('commentCount');
    if (!listEl || !countEl) return;

    currentComments = Array.isArray(comments) ? comments : [];

    const hasPending = currentComments.some(c => c.status === 'pending');
    if (hasPending) {
        startPendingPolling(pageId);
    } else if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }

    if (currentComments.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:30px; opacity:0.6;">暂无评论，快来抢沙发吧~</div>';
        countEl.textContent = '(0)';
        return;
    }

    countEl.textContent = `(${currentComments.length})`;

    const commentMap = {};
    const roots = [];
    currentComments.forEach(c => {
        commentMap[c.id] = { ...c, children: [] };
    });
    Object.values(commentMap).forEach(c => {
        if (c.parent_id && commentMap[c.parent_id]) {
            commentMap[c.parent_id].children.push(c);
        } else {
            roots.push(c);
        }
    });

    roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    listEl.innerHTML = roots.map(c => renderCommentItem(c)).join('');
}

// 加载评论 (使用两次循环确保楼中楼正确归位)
async function loadComments(pageId, { silent = false } = {}) {
    const listEl = document.getElementById('commentList');
    if (!listEl) return;

    try {
        // 构建请求头 (带 Token)
        const token = localStorage.getItem('auth_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/comments?page_id=${encodeURIComponent(pageId)}`, {
            headers,
            cache: 'no-store'
        });
        
        if (!res.ok) throw new Error('加载失败');
        
        const comments = await res.json();
        renderCommentList(comments, pageId);

    } catch (err) {
        console.error(err);
        if (!silent) {
            listEl.innerHTML = '<div style="text-align:center; color:#ff4444;">评论加载失败，请稍后重试</div>';
        }
    }
}

// 渲染单个评论 HTML
function renderCommentItem(comment) {
    const date = new Date(comment.created_at).toLocaleString();
    const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');
    const isOwner = currentUser.id === comment.user_id;

    const safeContent = escapeHtml(comment.content).replace(/\n/g, '<br>');

    // === 状态标签逻辑 ===
    let statusHtml = '';
    let extraClass = '';
    let contentStyle = '';

    if (comment.status === 'pending') {
        statusHtml = `<span class="comment-status pending">审核中</span>`;
        extraClass = ' audit-pending';
        contentStyle = 'opacity: 0.8;';
    } else if (comment.status === 'rejected') {
        statusHtml = `<span class="comment-status rejected">审核不通过</span>
                      <a href="/pages/help/comment-policy.html" target="_blank" class="audit-help-icon" title="查看原因">?</a>`;
        extraClass = ' audit-rejected';
        contentStyle = 'opacity: 0.6; text-decoration: line-through; color: #ff3b30;';
    }

    let childrenHtml = '';
    if (comment.children && comment.children.length > 0) {
        const sortedChildren = comment.children.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        childrenHtml = `
            <div class="comment-children">
                ${sortedChildren.map(child => renderCommentItem(child)).join('')}
            </div>
        `;
    }

    // 只有审核通过的才能回复
    const canReply = comment.status === 'approved';

    return `
        <div class="comment-item${extraClass}" id="comment-${comment.id}">
            <img src="${comment.avatar || '/public/guest.png'}" class="comment-avatar" loading="lazy">
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-user">
                        ${escapeHtml(comment.nickname || '未知用户')}
                        ${statusHtml}
                    </span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-content" style="${contentStyle}">${safeContent}</div>
                
                <div class="comment-actions-bar">
                    ${canReply ? `<button class="comment-reply-btn" onclick="openReplyBox(${comment.id}, '${escapeHtml(comment.nickname || '')}')">回复</button>` : ''}
                    ${isOwner ? `<button class="comment-delete" onclick="deleteComment(${comment.id})">删除</button>` : ''}
                </div>

                <div id="reply-box-${comment.id}" class="reply-form-wrapper" style="display:none;"></div>

                ${childrenHtml}
            </div>
        </div>
    `;
}

// 事件绑定
function bindEvents(pageId) {
    // 登录按钮：跳转至新账号中心并自动携带当前页作为回跳地址
    const loginBtn = document.getElementById('goToLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        if (typeof window.openAccountLogin === 'function') {
          window.openAccountLogin(window.location.href);
        } else {
          window.location.href = `https://account.satinau.cn/login.html?app=satinau-main&redirect=${encodeURIComponent(window.location.href)}`;
        }
      });
    }

  // 退出按钮：同步退出原站与账号中心
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink && !logoutLink.dataset.bound) {
    logoutLink.addEventListener('click', () => {
      const doLogout = () => {
        if (typeof window.logoutGlobalAccount === 'function') {
          window.logoutGlobalAccount({
            syncCenter: true,
            redirectUrl: window.location.href
          });
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_info');
          localStorage.removeItem('auth_login_at');
          window.dispatchEvent(new CustomEvent('auth-status-changed', { detail: null }));
          const cleanRedirect = new URL(window.location.href);
          cleanRedirect.hash = '';
          window.location.href = `https://account.satinau.cn/login?action=logout&app=satinau-main&redirect=${encodeURIComponent(cleanRedirect.href)}`;
        }
      };

      const modal = document.getElementById('globalModal') || document.querySelector('global-modal');
      if (modal && typeof modal.confirmAction === 'function') {
        if (typeof modal.with === 'function') {
          modal.with(logoutLink).confirmAction('确定要退出登录吗？', doLogout, '退出登录');
        } else {
          modal.confirmAction('确定要退出登录吗？', doLogout, '退出登录');
        }
      } else if (confirm('确定要退出登录吗？')) {
        doLogout();
      }
    });
    logoutLink.dataset.bound = 'true';
  }

    // 提交主评论
    const submitBtn = document.getElementById('submitCommentBtn');
    if (submitBtn) {
        if (submitBtn.dataset.bound) return;
        
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const content = document.getElementById('mainCommentText').value;
            if (!content.trim()) return showToast('请输入评论内容');
            
            await submitComment(pageId, content, null);
        });
        
        submitBtn.dataset.bound = "true";
    }
}

// 提交评论逻辑 (API) - 修复：添加 finally 块确保按钮重置
async function submitComment(pageId, content, parentId) {
    const token = localStorage.getItem('auth_token');
    if (!token) return showToast('请先登录');

    const btn = parentId 
        ? document.querySelector(`#reply-box-${parentId} .reply-submit-btn`) 
        : document.getElementById('submitCommentBtn');
    
    // 保存原始按钮文字，以便恢复
    const originalText = parentId ? '回复' : '发表评论';
    
    if(btn) {
        btn.disabled = true;
        btn.textContent = '提交中...';
    }

    try {
        const res = await fetch(`${API_BASE}/api/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                page_id: pageId,
                content: content,
                parent_id: parentId
            })
        });

        const newComment = await res.json();
        if (!res.ok) throw new Error(newComment.error || '提交失败');

        showToast('已发表，正在审核中');
        
        // 成功后如果是回复，关闭回复框
        if(parentId) {
            closeReplyBox(parentId);
        } else {
            const mainTextarea = document.getElementById('mainCommentText');
            if (mainTextarea) mainTextarea.value = '';
        }

        const merged = [
            newComment,
            ...currentComments.filter(c => c.id !== newComment.id)
        ];
        renderCommentList(merged, pageId);

    } catch (err) {
        showToast(err.message);
    } finally {
        // 无论成功还是失败，都恢复按钮状态
        if(btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

// 删除评论逻辑
window.deleteComment = function(commentId) {
    const doDelete = async () => {
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`${API_BASE}/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('删除失败');
            
            showToast('已删除');
            currentComments = currentComments.filter(c => c.id !== commentId && c.parent_id !== commentId);
            renderCommentList(currentComments, window.currentPageId);

        } catch (err) {
            showToast(err.message);
        }
    };

    const modal = document.getElementById('globalModal');
    if (modal && modal.confirmAction) {
        // 尝试获取触发按钮以启用动画效果
        const triggerBtn = document.querySelector(`#comment-${commentId} .comment-delete`);
        if (triggerBtn) modal.with(triggerBtn);
        
        modal.confirmAction('确定要删除这条评论吗？', doDelete, '删除');
    } else {
        // 降级兼容：如果模态框组件未加载，使用原生弹窗
        if (confirm('确定要删除这条评论吗？')) {
            doDelete();
        }
    }
};

// 打开回复框 (全局函数供 HTML onclick 调用)
window.openReplyBox = function(commentId, nickname) {
    // 检查登录
    if (!localStorage.getItem('auth_token')) {
      showToast('请先登录');
      setTimeout(() => {
        if (typeof window.openAccountLogin === 'function') {
          window.openAccountLogin(window.location.href);
        } else {
          window.location.href = `https://account.satinau.cn/login.html?app=satinau-main&redirect=${encodeURIComponent(window.location.href)}`;
        }
      }, 1000);
      return;
    }

    // 关闭其他回复框
    document.querySelectorAll('.reply-form-wrapper').forEach(el => {
        el.style.display = 'none';
        el.innerHTML = '';
    });

    const box = document.getElementById(`reply-box-${commentId}`);
    box.style.display = 'block';
    box.innerHTML = `
        <textarea placeholder="回复 @${nickname}..." class="comment-textarea" style="min-height:60px; font-size:13px;"></textarea>
        <div class="reply-form-actions">
            <button class="reply-cancel-btn" onclick="closeReplyBox(${commentId})">取消</button>
            <button class="reply-submit-btn" onclick="submitReply(${commentId})">回复</button>
        </div>
    `;
    box.querySelector('textarea').focus();
};

window.closeReplyBox = function(commentId) {
    const box = document.getElementById(`reply-box-${commentId}`);
    box.style.display = 'none';
    box.innerHTML = '';
};

// 回复提交入口 (全局函数)
window.submitReply = function(parentId) {
    const box = document.getElementById(`reply-box-${parentId}`);
    if(!box) return;
    
    const textarea = box.querySelector('textarea');
    if(!textarea) return;
    
    const content = textarea.value;
    if (!content.trim()) return showToast('请输入回复内容');
    
    if (window.currentPageId) {
        submitComment(window.currentPageId, content, parentId);
    } else {
        console.error("Page ID not found");
        showToast('页面状态异常，请刷新重试');
    }
};

// 工具函数：转义 HTML
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
})();