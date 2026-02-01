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
  
  // 获取 HDR 设置状态
  // 默认为 false (使用 webp)，只有明确设置为 'true' 时才使用 avif
  const useHDR = localStorage.getItem('enableHDR') === 'true';
  const imgExtension = useHDR ? '.avif' : '.webp';

  console.log(`Loading images with extension: ${imgExtension} (HDR: ${useHDR})`);

  // 加载图片列表
  fetch('https://blog.satinau.cn/zelynn/list.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('图片列表加载失败');
      }
      return response.json();
    })
    .then(images => {
      // 清空加载提示
      galleryContainer.innerHTML = '';
      
      // 创建图片元素
      images.forEach(imgInfo => {
        const img = document.createElement('img');
        
        // 动态拼接后缀
        img.src = `https://blog.satinau.cn/zelynn/${imgInfo.filename}${imgExtension}`;
        
        img.alt = imgInfo.alt || '泽凌图片';
        // [新增] 将跳转链接存储在 dataset 中，供 Viewer 读取
        img.dataset.link = imgInfo.url || '';
        
        img.loading = 'lazy'; // 懒加载
        
        // 添加错误处理
        img.onerror = function() {
          // 如果开启了 HDR 但加载失败（例如浏览器不支持 AVIF），可以尝试回退到 WEBP
          if (this.src.endsWith('.avif')) {
             console.warn('AVIF loading failed, falling back to WEBP:', this.src);
             this.src = this.src.replace('.avif', '.webp');
             return;
          }

          this.alt = '图片加载失败: ' + imgInfo.alt;
          this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTEyIDJjLTUuNSAyLTkgNi41LTkgMTFzMy41IDExIDkgMTExIDktMy41IDktMTEtMy41LTExLTktMTF6bTAgMTZjLTMuMyAwLTYtMi43LTYtNnMzLjcgMiA2IDIgNi0zLjMgNi02LTMuMy02LTYtNnoiLz48cGF0aCBmaWxsPSIjRjRBNEEwIiBkPSJNMTIgMTVoLjAxdjEuOTlsLS4wMS4wMUwxMiAxOWwtMS4wMS0xLjA5LS4wMS0uMDFWMTVoLjAxeiIvPjwvc3ZnPg==';
        };
        
        galleryContainer.appendChild(img);
      });
      
      // 初始化Viewer.js
      if (images.length > 0) {
        const viewer = new Viewer(galleryContainer, {
          url: 'src', // 使用img的src属性作为大图地址
          title: function(image) {
            return image.alt; // 显示alt作为标题
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
            const titleElement = viewer.viewer.querySelector('.viewer-title');

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