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

// === 动态照片处理工具类 ===
class MotionPhotoHelper {
    /**
     * 尝试从 Blob 中提取视频
     * 支持: 
     * 1. Google Pixel (GCamera:MicroVideoOffset)
     * 2. Xiaomi / Redmi / POCO (MiCamera:MicroVideoOffset)
     * 3. Samsung / Generic (Trailer/Append method)
     */
    static async extractVideo(blob) {
        const buffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const size = uint8.length;

        // 1. 尝试 XMP 方法 (Google & Xiaomi)
        // 读取头部 64KB 查找 XMP
        const headerLimit = Math.min(65536, size);
        const decoder = new TextDecoder("utf-8");
        const headerText = decoder.decode(uint8.slice(0, headerLimit));
        
        // 匹配正则：支持 Google 和 Xiaomi 的命名空间
        // Google: GCamera:MicroVideoOffset
        // Xiaomi: MiCamera:MicroVideoOffset 或 直接 MicroVideoOffset
        let xmpMatch = /GCamera:MicroVideoOffset="(\d+)"/.exec(headerText);
        
        if (!xmpMatch) {
            // 尝试 Xiaomi 特有的 MiCamera 命名空间
            xmpMatch = /MiCamera:MicroVideoOffset="(\d+)"/.exec(headerText);
        }
        
        if (!xmpMatch) {
            // 尝试宽泛匹配 (防止某些厂商省略命名空间)
            xmpMatch = /MicroVideoOffset="(\d+)"/.exec(headerText);
        }
        
        if (xmpMatch) {
            const videoOffset = parseInt(xmpMatch[1]);
            if (videoOffset > 0 && videoOffset < size) {
                console.log(`[MotionPhoto] 检测到 XMP 偏移量: ${videoOffset} (Google/Xiaomi)`);
                return new Blob([uint8.slice(size - videoOffset)], { type: 'video/mp4' });
            }
        }

        // 2. 尝试搜索 MP4 标识 (Samsung / Generic / Old Xiaomi)
        // 从文件末尾向前搜索 'ftyp' 标识
        // 很多小米旧机型和三星直接将 MP4 拼接到文件末尾
        const searchLimit = Math.min(10 * 1024 * 1024, size); // 增加搜索范围到 10MB，以防视频较大
        const searchStart = size - searchLimit;
        
        for (let i = searchStart; i < size - 20; i++) {
            // 检查 'ftyp' (0x66 0x74 0x79 0x70)
            if (uint8[i] === 0x66 && uint8[i+1] === 0x74 && uint8[i+2] === 0x79 && uint8[i+3] === 0x70) {
                // ftyp 前面应该是 size (Uint32 Big Endian)
                // MP4 头部结构: [4 bytes size] [4 bytes 'ftyp'] ...
                const boxSize = (uint8[i-4] << 24) | (uint8[i-3] << 16) | (uint8[i-2] << 8) | uint8[i-1];
                
                const possibleStart = i - 4;
                // 校验：
                // 1. Box size 应该合理 (通常 > 16)
                // 2. 视频不应该超出文件尾部太多 (允许少量 Metadata 冗余)
                if (boxSize > 16 && boxSize < 1000000 && (possibleStart + boxSize) < size + 5000000) {
                    console.log(`[MotionPhoto] 检测到 MP4 头部 (ftyp)`);
                    return new Blob([uint8.slice(possibleStart)], { type: 'video/mp4' });
                }
            }
        }

        return null;
    }
}

// === 全局处理函数 ===
window.playMotionPhoto = async function(btn, src) {
    // 阻止冒泡
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const wrapper = btn.closest('.moment-img-wrapper');
    const img = wrapper.querySelector('img');
    const originalText = btn.innerHTML;

    // 状态：加载中
    btn.classList.add('loading');
    btn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"></path></svg>
        加载中
    `;

    try {
        const response = await fetch(src);
        if (!response.ok) throw new Error('下载失败');
        const blob = await response.blob();

        const videoBlob = await MotionPhotoHelper.extractVideo(blob);

        if (videoBlob) {
            const videoUrl = URL.createObjectURL(videoBlob);
            
            const video = document.createElement('video');
            video.src = videoUrl;
            video.autoplay = true;
            video.loop = true;
            video.muted = false; 
            video.controls = true;
            video.playsInline = true;
            
            video.style.opacity = '0';
            video.style.transition = 'opacity 0.5s ease';
            
            wrapper.appendChild(video);
            
            requestAnimationFrame(() => {
                video.style.opacity = '1';
                btn.style.display = 'none'; 
            });

            video.onerror = () => {
                showToast('视频解析成功但无法播放');
                video.remove();
                btn.style.display = 'flex';
            };

        } else {
            showToast('这不是一张包含动态信息的照片');
        }
    } catch (e) {
        console.error(e);
        showToast('动态照片加载失败');
    } finally {
        if (wrapper.querySelector('video') === null) {
            btn.classList.remove('loading');
            btn.innerHTML = originalText;
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // 修改为 moments.json
    const MOMENTS_API = `${getCdnBaseUrl()}/data/moments.json`;
    const momentsList = document.getElementById('momentsList');
    const statusMsg = document.getElementById('statusMsg');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // 获取数据
    fetch(MOMENTS_API)
    .then(response => {
        if (!response.ok) throw new Error('网络响应异常');
        return response.json();
    })
    .then(data => {
        // 隐藏全屏加载动画
        loadingOverlay.classList.remove('show');
        
        if (!data || data.length === 0) {
        statusMsg.textContent = "暂时没有动态哦~";
        return;
        }

        statusMsg.style.display = 'none';
        renderMoments(data);
    })
    .catch(err => {
        console.error('加载动态失败:', err);
        loadingOverlay.classList.remove('show');
        statusMsg.innerHTML = `加载失败，请<a href="javascript:location.reload()" style="color:var(--primary-color)">刷新</a>重试`;
    });

    // 渲染函数
    function renderMoments(moments) {
    // 按日期倒序排列
    moments.sort((a, b) => new Date(b.date) - new Date(a.date));

    moments.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'moment-card';
        // 设置动画延迟，形成阶梯出现效果
        card.style.animation = `blurFadeUp 0.8s ease forwards ${index * 0.15}s`;

        // 处理图片 HTML
        let imagesHtml = '';
        if (item.images && item.images.length > 0) {
        const count = item.images.length;
        // 根据数量设置 data-count 用于 CSS Grid 布局
        const gridClass = count <= 4 ? count : 'default';
        
        imagesHtml = `<div class="moment-gallery" data-count="${gridClass}">`;
        item.images.forEach(src => {
            // 懒加载 loading="lazy"
            const isPotentialMotion = /\.(jpg|jpeg|heic)$/i.test(src);
            const badgeHtml = isPotentialMotion 
            ? `<div class="live-badge" onclick="playMotionPhoto(this, '${src}')" title="播放动态照片">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg> LIVE
                </div>` 
            : '';

            imagesHtml += `
            <div class="moment-img-wrapper">
                <img src="${src}" alt="动态图片" loading="lazy">
                ${badgeHtml}
            </div>
            `;
        });
        imagesHtml += `</div>`;
        }

        // 构建卡片 HTML
        card.innerHTML = `
        <div class="moment-header">
            <img src="/favicon.ico" class="moment-avatar" alt="Avatar">
            <div class="moment-info">
            <span class="moment-author">缎金SatinAu</span>
            <span class="moment-date">${formatDate(item.date)}</span>
            </div>
        </div>
        <div class="moment-content">${marked.parse(item.content).replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')}</div>
        ${imagesHtml}
        `;

        momentsList.appendChild(card);
    });

    // 初始化图片查看器
    initViewer();
    }

    // 日期格式化 (YYYY年MM月DD日 HH:mm)
    function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const formatConfig = date.getFullYear() === now.getFullYear() 
        ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString('zh-CN', formatConfig).replace(/\//g, '-');
    }

    // 初始化 Viewer.js
    function initViewer() {
    const galleries = document.querySelectorAll('.moment-gallery');
    galleries.forEach(gallery => {
        new Viewer(gallery, {
        toolbar: {
            zoomIn: 1,
            zoomOut: 1,
            oneToOne: 1,
            reset: 1,
            prev: 1,
            play: 1,
            next: 1,
            rotateLeft: 1,
            rotateRight: 1,
            flipHorizontal: 1,
            flipVertical: 1,
        },
        navbar: true,
        title: false,
        transition: true
        });
    });
    }
});