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

/* 核心滚动逻辑脚本 */
document.addEventListener("DOMContentLoaded", () => {
    const scrollContainer = document.getElementById('scroll-sequence');
    const scenes = document.querySelectorAll('.intro-scene');
    const totalScenes = scenes.length;
    const scrollHint = document.getElementById('scroll-hint');
    const navBar = document.querySelector('navigate-bar');
    const earthBg = document.getElementById('earth-bg'); // 特殊处理地球

    // 加载 Markdown 内容
    fetch(`${getCdnBaseUrl()}/data/aboutme.md`)
    .then(res => res.ok ? res.text() : "加载失败")
    .then(md => {
        document.getElementById("aboutmeContent").innerHTML = marked.parse(md);
        new Viewer(document.getElementById('aboutmeContent'), { toolbar: false, transition: true });
    })
    .catch(() => document.getElementById("aboutmeContent").innerHTML = "<p>加载失败。</p>");
    
    // 初始化评论
    if (typeof initPageComments === 'function') initPageComments('aboutme-comments', 'aboutme');

    // 滚动提示在 3秒后显示
    setTimeout(() => {
    if(window.scrollY < 100) scrollHint.style.opacity = 1;
    }, 2000);

    // === 核心动画循环 ===
    function updateAnimation() {
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const containerTop = scrollContainer.offsetTop;
    const containerHeight = scrollContainer.offsetHeight;
    
    // 计算在 Scroll Sequence 中的进度 (0 到 totalScenes)
    // 我们减去 viewportHeight 是为了让最后一幕滚完后，页面能自然继续向下
    let rawProgress = (scrollY - containerTop) / viewportHeight;
    
    // 限制范围，处理开头和结尾
    if (rawProgress < 0) rawProgress = 0;
    
    // 隐藏/显示滚动提示
    if (rawProgress > 0.1) scrollHint.style.opacity = 0;

    // 导航栏显示逻辑：当滚动超过 Sequence 区域后显示
    // 5.5 代表滚动到第 6 幕快结束时
    if (rawProgress > totalScenes - 0.5) {
        navBar.classList.add('show');
    } else {
        navBar.classList.remove('show');
    }

    // 遍历所有场景进行动画处理
    scenes.forEach((scene, index) => {
        // 当前场景的相对进度：
        // index = 0 时，progress 在 0~1 之间为活跃
        // index = 1 时，progress 在 1~2 之间为活跃
        const sceneProgress = rawProgress - index;

        const bg = scene.querySelector('.scene-bg');
        const content = scene.querySelector('.scene-content');

        if (sceneProgress >= -0.5 && sceneProgress <= 1.5) {
        // === 场景激活状态 ===
        
        // 1. 透明度控制 (Fade In / Fade Out)
        // 进入期 (-0.5 ~ 0): 0 -> 1
        // 保持期 (0 ~ 0.5): 1
        // 退出期 (0.5 ~ 1): 1 -> 0
        let opacity = 0;
        if (sceneProgress < 0) {
            opacity = (sceneProgress + 0.5) * 2; // -0.5->0 => 0->1
        } else if (sceneProgress < 0.6) {
            opacity = 1;
        } else {
            opacity = 1 - (sceneProgress - 0.6) * 2.5; // 0.6->1 => 1->0
        }
        opacity = Math.max(0, Math.min(1, opacity));
        
        scene.style.opacity = opacity;
        
        // 优化性能：如果不透明，则隐藏
        if (opacity === 0) {
            scene.style.visibility = 'hidden';
            return; 
        } else {
            scene.style.visibility = 'visible';
        }

        // 2. 视差位移与缩放 (Parallax & Scale)
        // 内容随滚动轻微上移
        const contentTranslateY = sceneProgress * -60; 
        content.style.transform = `translateY(${contentTranslateY}px)`;
        
        // 背景缩放效果 (Apple Effect)
        // 随着滚动，背景缓慢放大
        let scale = 1 + (sceneProgress + 0.5) * 0.1; 
        
        // 特殊处理 Scene 4 (Earth Zoom)
        if (scene.id === 'scene-4' && earthBg) {
            // 地球旋转放大的特殊逻辑
            // 进度从 -0.5 到 1
            const earthScale = 1 + Math.max(0, sceneProgress + 0.5) * 1.5; // 放大更多
            const rotate = (sceneProgress + 0.5) * 15; // 旋转
            earthBg.style.transform = `translate(-50%, -50%) scale(${earthScale}) rotate(${rotate}deg)`;
            // 地球变暗一点以免抢戏
            earthBg.style.filter = `blur(${Math.abs(sceneProgress*5)}px) brightness(${1 - sceneProgress*0.3})`;
        } else {
            // 普通背景处理
            if(bg) {
                bg.style.transform = `translate(-50%, -50%) scale(${scale})`;
                // 进出场时模糊
                const blurAmount = Math.abs(sceneProgress - 0.3) * 10;
                // 稍微变暗
                const brightness = 1 - Math.max(0, sceneProgress * 0.4);
                bg.style.filter = `blur(${blurAmount}px) brightness(${brightness})`;
            }
        }

        } else {
        // === 场景非激活状态 ===
        scene.style.opacity = 0;
        scene.style.visibility = 'hidden';
        }
    });
    
    requestAnimationFrame(updateAnimation);
    }

    // 启动动画循环
    requestAnimationFrame(updateAnimation);
});