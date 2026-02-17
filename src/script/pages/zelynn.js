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

/* ============= zelynn.html 独有逻辑 ============= */
// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 图片画廊容器
  const galleryContainer = document.getElementById('zelynnGallery');
  const filterContainer = document.getElementById('gallery-filter');
  const noResultMsg = document.getElementById('no-result-msg');
  
  // 获取全局 HDR 设置状态
  const useGlobalHDR = localStorage.getItem('enableHDR') === 'true';

  console.log(`HDR Mode: ${useGlobalHDR}`);

  // === HDR 提示智能检测逻辑 ===
  const tipsContainer = document.getElementById('gallery-tips');
  // 检测设备屏幕是否支持 HDR (High Dynamic Range)
  // 标准媒体查询: (dynamic-range: high)
  const isHardwareHDR = window.matchMedia && window.matchMedia('(dynamic-range: high)').matches;
  // 如果设备支持 HDR 但用户未开启 HDR 模式，提示开启
  if (isHardwareHDR && !useGlobalHDR && tipsContainer) {
    tipsContainer.innerHTML = '<span style="opacity: 0.9; font-weight: 500;">您的设备支持显示HDR图片</span> <a href="/pages/settings.html#hdr-setting-anchor" style="color: var(--primary-color); font-weight: 600; margin-left: 6px; text-decoration: none;"> 去开启 &rarr; </a>';
  }

  // 存储当前选中的标签
  let activeTags = new Set();
  // 存储Viewer实例
  let galleryViewer = null;

  // 加载图片列表
  fetch(`${getCdnBaseUrl()}/zelynn/list.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error('图片列表加载失败');
      }
      return response.json();
    })
    .then(images => {
      // 提取所有唯一标签
      const allTags = new Set();
      images.forEach(img => {
        if (Array.isArray(img.tags)) {
          img.tags.forEach(tag => allTags.add(tag));
        }
      });

      // 生成筛选按钮
      if (filterContainer && allTags.size > 0) {
        // 转换并在数组中排序
        const sortedTags = Array.from(allTags).sort();
        
        sortedTags.forEach(tag => {
          const btn = document.createElement('div');
          btn.className = 'filter-tag';
          btn.textContent = tag;
          btn.dataset.tag = tag;
          
          btn.addEventListener('click', () => {
            // 切换选中状态
            if (activeTags.has(tag)) {
              activeTags.delete(tag);
              btn.classList.remove('active');
            } else {
              activeTags.add(tag);
              btn.classList.add('active');
            }
            // 执行筛选
            filterImages();
          });
          
          filterContainer.appendChild(btn);
        });
      }
      
      // 清空加载提示
      galleryContainer.innerHTML = '';
      
      // 创建图片元素
      images.forEach(imgInfo => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gallery-item';

        // 格式化为 JSON 字符串存储
        wrapper.dataset.tags = JSON.stringify(imgInfo.tags || []);

        const img = document.createElement('img');
        
        // 动态判断当前图片的后缀
        // 只有当 (全局开关开启) 且 (该图片标记为 hdr: true) 时，才用 avif，否则用 webp
        let currentExt = '.webp';
        if (useGlobalHDR && imgInfo.hdr === true) {
            currentExt = '.avif';
        }

        // 拼接地址
        img.src = `${getCdnBaseUrl()}/zelynn/${imgInfo.filename}${currentExt}`;
        
        img.alt = imgInfo.alt || '泽凌图片';
        // 将跳转链接存储在 dataset 中，供 Viewer 读取
        img.dataset.link = imgInfo.url || '';
        
        img.loading = 'lazy'; // 懒加载
        
        // HDR 角标：仅当全局 HDR 开启 且 图片标记为 hdr:true
        if (useGlobalHDR && imgInfo.hdr === true) {
          const badge = document.createElement('span');
          badge.className = 'hdr-badge';
          badge.textContent = 'HDR';
          wrapper.classList.add('is-hdr');
          wrapper.appendChild(badge);
        }
        
        // 添加错误处理
        img.onerror = function() {
          // 如果尝试加载 AVIF 失败（文件不存在或浏览器不支持），回退到 WEBP
          if (this.src.endsWith('.avif')) {
             console.warn('AVIF loading failed, falling back to WEBP:', this.src);
             this.src = this.src.replace('.avif', '.webp');
             return;
          }

          this.alt = '图片加载失败: ' + imgInfo.alt;
          this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3QgeD0iMTIiIHk9IjE2IiB3aWR0aD0iNzIiIGhlaWdodD0iNTYiIHJ4PSI2IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtZGFzaGFycmF5PSI2IDQiLz48bGluZSB4MT0iMjIiIHkxPSI2MCIgeDI9Ijc0IiB5Mj0iMjgiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxsaW5lIHgxPSI0OCIgeTE9IjM0IiB4Mj0iNDgiIHkyPSI1MCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iNDgiIGN5PSI1OCIgcj0iMi41IiBmaWxsPSJjdXJyZW50Q29sb3IiLz48L3N2Zz4=';
        };
        
        wrapper.appendChild(img);
        galleryContainer.appendChild(wrapper);
      });

      // === 筛选核心逻辑 ===
      function filterImages() {
        const items = galleryContainer.querySelectorAll('.gallery-item');
        let hasVisibleItems = false;

        items.forEach(item => {
          const itemTags = JSON.parse(item.dataset.tags || '[]');
          
          let isVisible = true;
          if (activeTags.size > 0) {
            isVisible = Array.from(activeTags).every(tag => itemTags.includes(tag));
          }

          if (isVisible) {
            item.style.display = ''; // 恢复默认 display
            hasVisibleItems = true;
          } else {
            item.style.display = 'none';
          }
        });

        // 处理无结果提示
        if (noResultMsg) {
          noResultMsg.style.display = hasVisibleItems ? 'none' : 'block';
        }

        // 更新 Viewer.js 实例，使其只包含当前可见的图片
        if (galleryViewer) {
          galleryViewer.update();
        }
      }
      
      // 初始化Viewer.js
      if (images.length > 0) {
        galleryViewer = new Viewer(galleryContainer, {
          url: 'src', // 使用img的src属性作为大图地址
          title: function(image) {
            return image.alt; // 显示alt作为标题
          },
          filter: function(image) {
          // 确保只查看显示的图片
            return image.parentElement.style.display !== 'none';
          },
          toolbar: true,
          tooltip: true,
          movable: true,
          zoomable: true,
          rotatable: true,
          scalable: true,
          transition: true,
          fullscreen: true,
          keyboard: true,
          // 当图片显示完成时触发
          viewed: function(event) {
            // 获取当前显示的原始图片元素
            const currentImg = event.detail.originalImage;
            // 获取对应的链接
            const linkUrl = currentImg.dataset.link;
            // 获取 Viewer 生成的标题元素
            // viewer.viewer 是 Viewer 生成的模态框 DOM 根节点
            const titleElement = galleryViewer.viewer.querySelector('.viewer-title');

            if (titleElement) {
              // 重置样式和事件（防止上一个图片的事件残留）
              titleElement.style.cursor = '';
              titleElement.style.textDecoration = '';
              titleElement.style.color = '';
              titleElement.onclick = null;
              titleElement.title = '';

              // 如果有链接，则绑定点击事件并修改样式
              if (linkUrl && linkUrl.trim() !== '') {
                titleElement.style.cursor = 'pointer';
                titleElement.title = '点击访问 / Click to visit'; // 鼠标悬停提示
                
                // 绑定点击跳转
                titleElement.onclick = function(e) {
                  // 阻止冒泡防止关闭查看器
                  e.stopPropagation(); 
                  window.open(linkUrl, '_blank');
                };
              }
            }
          }
        });
      }
    })
    .catch(error => {
      console.error('加载图片失败:', error);
      galleryContainer.innerHTML = '<div class="image-error">图片加载失败，请稍后重试</div>';
    });
});