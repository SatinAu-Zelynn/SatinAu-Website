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

// 配置 Cloudflare Worker 后端地址
const API_BASE = 'https://db.satinau.cn';

document.addEventListener('DOMContentLoaded', () => {
    // 根据页面初始化不同逻辑
    if (document.getElementById('login-page')) {
        initLoginPage();
    } else if (document.getElementById('account-page')) {
        initProfilePage();
    }
});

/* ========== 登录页逻辑 ========== */
function initLoginPage() {
    // 检查是否已登录，已登录则跳转
    if (localStorage.getItem('auth_token')) {
        window.location.href = '/pages/account/index.html';
        return;
    }

    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // 切换 Tab
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tab.dataset.tab === 'login') {
                loginForm.style.display = 'block';
                registerForm.style.display = 'none';
            } else {
                loginForm.style.display = 'none';
                registerForm.style.display = 'block';
            }
        });
    });

    // 处理登录
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;
        const btn = loginForm.querySelector('button');

        setLoading(btn, true);

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || '登录失败');

            // 保存 Token
            localStorage.setItem('auth_token', data.token);
            // 保存用户信息 (简单缓存)
            localStorage.setItem('user_info', JSON.stringify(data.user));

            showToast('登录成功，正在跳转...');
            setTimeout(() => {
                window.location.href = '/pages/account/index.html';
            }, 1000);

        } catch (err) {
            showToast(err.message);
            setLoading(btn, false);
        }
    });

    // 处理注册
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nickname = document.getElementById('reg-nickname').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-pwd').value;
        const confirmPwd = document.getElementById('reg-pwd-confirm').value;
        const btn = registerForm.querySelector('button');

        if (password !== confirmPwd) {
            showToast('两次输入的密码不一致');
            return;
        }

        setLoading(btn, true);

        try {
            const res = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '注册失败');

            showToast('注册成功！请登录');
            // 切换到登录 Tab
            tabs[0].click();
            setLoading(btn, false);

        } catch (err) {
            showToast(err.message);
            setLoading(btn, false);
        }
    });
}

/* ========== 个人中心逻辑 ========== */
async function initProfilePage() {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        window.location.href = '/pages/account/login.html';
        return;
    }

    // 优先显示缓存数据，提升体验
    const cachedUser = localStorage.getItem('user_info');
    if (cachedUser) {
        renderProfile(JSON.parse(cachedUser));
    }

    try {
        // 从服务器获取最新数据
        const res = await fetch(`${API_BASE}/api/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            throw new Error('登录已过期');
        }

        const data = await res.json();
        localStorage.setItem('user_info', JSON.stringify(data)); // 更新缓存
        renderProfile(data);

        // 显示内容，隐藏 Loading
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('profileCard').style.display = 'flex';

    } catch (err) {
        showToast(err.message);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        setTimeout(() => {
             window.location.href = '/pages/account/login.html';
        }, 1500);
    }

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', () => {
        const modal = document.getElementById('globalModal');
        
        // 使用 GlobalModal 替代原生 confirm
        // 参数：提示语, 回调函数, 按钮文字
        modal.confirmAction(
            '确定要退出登录吗？', 
            () => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                window.location.href = '/';
            }, 
            '退出登录' // 自定义按钮文字
        );
    });
}

function renderProfile(user) {
    document.getElementById('userNickname').textContent = user.nickname;
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userId').textContent = user.id;
    document.getElementById('userAvatar').src = user.avatar || `/public/guest.png`;
    
    if(user.created_at) {
        const date = new Date(user.created_at);
        document.getElementById('userJoinDate').textContent = date.toLocaleDateString();
    }
}

function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.dataset.text = btn.textContent;
        btn.textContent = '处理中...';
        btn.disabled = true;
    } else {
        btn.textContent = btn.dataset.text;
        btn.disabled = false;
    }
}