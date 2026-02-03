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
document.addEventListener('DOMContentLoaded', function() {
  const zelynnBg = document.getElementById('zelynn-bg');
  if (!zelynnBg) return;
  
  // 强制使用 webp 格式
  const imgExtension = '.webp';
  
  // 图片基础路径
  const baseUrl = 'https://blog.satinau.cn/zelynn/';
  const listUrl = 'https://blog.satinau.cn/zelynn/list.json';
  
  let images = [];
  let currentIndex = 0;

  // 预加载图片
  function preloadImage(url) {
    const img = new Image();
    img.src = url;
  }

  // 切换背景
  function changeBackground() {
    if (images.length === 0) return;
    
    const imgInfo = images[currentIndex];
    const imgUrl = `${baseUrl}${imgInfo.filename}${imgExtension}`;
    
    // 创建临时图片对象检测加载，确保平滑切换
    const tempImg = new Image();
    tempImg.src = imgUrl;
    tempImg.onload = () => {
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
    const nextImgUrl = `${baseUrl}${images[nextIndex].filename}${imgExtension}`;
    preloadImage(nextImgUrl);
  }

  // 获取图片列表
  fetch(listUrl)
    .then(res => res.json())
    .then(data => {
      images = data;
      // 随机打乱顺序
      images.sort(() => Math.random() - 0.5);

      if (images.length > 0) {
        changeBackground(); // 立即显示
        setInterval(changeBackground, 5000); // 5秒轮播
      }
    })
    .catch(err => {
      console.error('首页背景加载失败:', err);
      // 加载失败时的保底渐变色
      zelynnBg.style.background = 'linear-gradient(135deg, #a18cd1, #fbc2eb)'; 
    });
});