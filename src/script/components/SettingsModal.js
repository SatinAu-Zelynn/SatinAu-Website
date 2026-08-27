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

window.mountSettingsToModal = function(modalInstance, anchorId = null) {
  modalInstance.modal.className = 'modal settings-modal';

  // 渲染设置窗口结构（头部固定 + 内部可滚动）
  modalInstance.content.innerHTML = `
    <div class="settings-modal-header">
      <div class="settings-modal-title">网站设置</div>
      <div class="settings-modal-actions">
        <button class="reset-btn" id="modalSettingsResetBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          恢复默认
        </button>
        <button class="settings-modal-close" id="modalSettingsCloseBtn" title="关闭">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <div class="settings-modal-body">
      <section id="ui-settings">
        <h2 class="setting-group-title">外观样式</h2>
        <p class="setting-group-desc">调整网站的视觉效果</p>

        <div class="setting-item">
          <label>
            字体风格
            <span class="tooltip">无衬线体为 MiSans + Google Sans ，衬线体为 Noto Serif</span>
          </label>
          
          <div class="custom-select-wrapper" id="fontSelectComponent">
            <div class="custom-select-trigger" tabindex="0">
              <span class="selected-value">无衬线 (推荐)</span>
              <div class="arrow"></div>
            </div>
            
            <div class="custom-options">
              <div class="custom-option selected" data-value="sans" style="font-family: var(--font-sans);">无衬线 (推荐)</div>
              <div class="custom-option" data-value="serif" style="font-family: var(--font-serif);">衬线体</div>
              <div class="custom-option" data-value="system" style="font-family: var(--font-system);">系统字体</div>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label>
            颜色模式
            <span class="tooltip">切换明亮、深色或跟随系统设定</span>
          </label>
          
          <div class="segmented-control" id="themeModeControl">
            <button data-value="light">明亮</button>
            <button data-value="system">系统</button>
            <button data-value="dark">深色</button>
          </div>
        </div>

        <!-- 主题色设置项 -->
        <div class="setting-item">
          <label>
            主题色
            <span class="tooltip">自定义网站的主色调（如按钮、链接颜色）</span>
          </label>
          
          <div id="themeColorSelector" class="theme-selector-wrapper"></div>
        </div>

        <div class="setting-item" id="hdr-setting-anchor">
          <label for="hdrModeToggle">
            HDR 图片模式 (Beta)
            <span class="tooltip">
              开启后泽凌页面部分图片将加载 AVIF 高动态范围图片<br>
              若显示异常或黑屏，请关闭此项（默认使用 WEBP）
            </span>
          </label>
          <div class="toggle-switch">
            <input type="checkbox" id="hdrModeToggle" onchange="toggleHDRMode()">
            <label for="hdrModeToggle" class="switch-slider"></label>
          </div>
        </div>

        <div class="setting-item" id="live2d-setting-anchor">
          <label for="live2dToggle">
            虚拟形象 (Live2D)
            <span class="tooltip">在屏幕左下角显示小雪狐泽凌（默认开启）</span>
          </label>
          <div class="toggle-switch">
            <input type="checkbox" id="live2dToggle" onchange="toggleLive2D()">
            <label for="live2dToggle" class="switch-slider"></label>
          </div>
        </div>

        <div class="setting-item">
          <label for="performanceModeToggle">
            性能模式
            <span class="tooltip">启用后，限制部分模糊和动画以提升流畅度（默认禁用）</span>
          </label>
          <div class="toggle-switch">
            <input type="checkbox" id="performanceModeToggle" onchange="togglePerformanceMode()">
            <label for="performanceModeToggle" class="switch-slider"></label>
          </div>
        </div>
      </section>

      <section id="function-settings">
        <h2 class="setting-group-title">功能开关</h2>
        <p class="setting-group-desc">控制网站的一些额外功能和交互</p>

        <div class="setting-item">
          <label for="autoHideNavToggle">
            自动隐藏导航栏
            <span class="tooltip">向下滚动时隐藏导航栏，向上滚动时显示（默认禁用）</span>
          </label>
          <div class="toggle-switch">
            <input type="checkbox" id="autoHideNavToggle" onchange="toggleAutoHideNav()">
            <label for="autoHideNavToggle" class="switch-slider"></label>
          </div>
        </div>

        <div class="setting-item">
          <label for="customRightClickMenuToggle">
            替换默认右键菜单
            <span class="tooltip">启用后，将使用自带右键菜单替换浏览器默认菜单（默认启用）</span>
          </label>
          <div class="toggle-switch">
            <input type="checkbox" id="customRightClickMenuToggle" onchange="toggleCustomRightClickMenu()">
            <label for="customRightClickMenuToggle" class="switch-slider"></label>
          </div>
        </div>

        <div class="setting-item">
          <label for="nativeNotificationToggle">
            系统原生通知
            <span class="tooltip">开启后使用系统推送，关闭时使用网站自带悬浮通知</span>
          </label>
          
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="more-btn" 
                    onclick="window.pushNotification('来自 缎金SatinAu 的问候', { body: '这是一条测试通知，无论是原生还是应用内样式都能正常显示。', requireInteraction: false });" 
                    style="width:auto; height:auto; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight:600; text-decoration:none; background:rgba(128,128,128,0.2); margin:0;">
              测试
            </button>
            
            <div class="toggle-switch">
              <input type="checkbox" id="nativeNotificationToggle" onchange="toggleNativeNotifications()">
              <label for="nativeNotificationToggle" class="switch-slider"></label>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label for="chimeToggle">
            整点报时
            <span class="tooltip">整点自动弹窗并播放 Westminster 钟声（需保持网页开启）</span>
          </label>
          
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="more-btn" 
                    onclick="triggerChime(new Date().getHours()); showToast('🔊 正在测试报时效果...')" 
                    style="width:auto; height:auto; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight:600; text-decoration:none; background:rgba(128,128,128,0.2); margin:0;">
              测试
            </button>
            
            <div class="toggle-switch">
              <input type="checkbox" id="chimeToggle" onchange="toggleHourlyChime()">
              <label for="chimeToggle" class="switch-slider"></label>
            </div>
          </div>
        </div>

        <div class="setting-item" id="route-switching">
          <label>
            静态资源线路
            <span class="tooltip">切换图片和数据的加载源，若加载缓慢可尝试切换</span>
          </label>
          
          <div class="custom-select-wrapper" id="cdnSelectComponent">
            <div class="custom-select-trigger" tabindex="0">
              <span class="selected-value">线路一 (Cloudflare)</span>
              <div class="arrow"></div>
            </div>
            
            <div class="custom-options">
              <div class="custom-option selected" data-value="cf">线路一 (Cloudflare)</div>
              <div class="custom-option" data-value="eo">线路二 (EdgeOne)</div>
            </div>
          </div>
        </div>
      </section>

      <section id="about-help">
        <h2 class="setting-group-title">关于与帮助</h2>
        <p class="setting-group-desc">网站信息及故障排查</p>
        <div class="setting-item">
          <label>
            帮助中心
            <span class="tooltip">常见问题与说明</span>
          </label>
          <button class="more-btn" onclick="window.open('/pages/help/index.html', '_blank')" style="width:auto; height:auto; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:600; text-decoration:none; background:rgba(128,128,128,0.2);">
            查看详情
          </button>
        </div>
        <div class="setting-item">
          <label>
            用户协议与隐私说明
            <span class="tooltip">关于隐私政策、第三方服务及开源致谢的说明</span>
          </label>
          <button class="more-btn" onclick="window.open('/pages/agreement.html', '_blank')" style="width:auto; height:auto; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:600; text-decoration:none; background:rgba(128,128,128,0.2);">
            查看详情
          </button>
        </div>
        <div class="setting-item">
          <label>
            更新 Cookie 首选项
            <span class="tooltip">Cookie 首选项中心</span>
          </label>
          <button class="more-btn" id="modal_open_preferences_center" style="width:auto; height:auto; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:600; text-decoration:none; background:rgba(128,128,128,0.2);">
            立即更新
          </button>
        </div>
        <div class="setting-item">
          <label>
            浏览器兼容性检测
            <span class="tooltip">查看当前浏览器对本网站技术的支持情况</span>
          </label>
          <button class="more-btn" onclick="window.open('/pages/help/compatibility.html', '_blank')" style="width:auto; height:auto; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:600; text-decoration:none; background:rgba(128,128,128,0.2);">
            立即检测
          </button>
        </div>
        <div class="setting-item">
          <label>
            博客后台
            <span class="tooltip">编辑博客文章和网站内容</span>
          </label>
          <button class="more-btn" id="modalAdminBtn" style="width:auto; height:auto; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight:600; text-decoration:none; background:rgba(128,128,128,0.2);">
            进入后台
          </button>
        </div>
      </section>
    </div>
  `;

  // 绑定头部按钮
  modalInstance.querySelector('#modalSettingsCloseBtn').onclick = () => modalInstance.close();
  modalInstance.querySelector('#modalSettingsResetBtn').onclick = (e) => {
    if (typeof window.restoreDefaultSettings === 'function') {
      window.restoreDefaultSettings(e.currentTarget);
    }
  };

  // 绑定 TermsFeed Cookie 首选项
  const cookieBtn = modalInstance.querySelector('#modal_open_preferences_center');
  if (cookieBtn) {
    cookieBtn.onclick = (e) => {
      e.preventDefault();
      const origBtn = document.getElementById('open_preferences_center');
      if (origBtn) origBtn.click();
      else if (window.cookieconsent && typeof window.cookieconsent.openPreferencesCenter === 'function') {
        window.cookieconsent.openPreferencesCenter();
      }
    };
  }

  // 后台管理按钮
  const adminBtn = modalInstance.querySelector('#modalAdminBtn');
  if (adminBtn) {
    adminBtn.onclick = () => {
      modalInstance.openWeb('https://admin.satinau.cn');
    };
  }

  // ===== 初始化弹窗内的各项控件状态 =====

  // 1. 初始化各 Toggle 开关状态
  const initToggle = (id, getter) => {
    const el = modalInstance.querySelector(`#${id}`);
    if (el && typeof getter === 'function') {
      el.checked = getter();
    }
  };
  initToggle('hdrModeToggle', () => localStorage.getItem('enableHDR') === 'true');
  initToggle('live2dToggle', () => typeof isLive2DEnabled === 'function' ? isLive2DEnabled() : true);
  initToggle('performanceModeToggle', () => typeof isPerformanceMode === 'function' ? isPerformanceMode() : false);
  initToggle('autoHideNavToggle', () => typeof isAutoHideNavEnabled === 'function' ? isAutoHideNavEnabled() : false);
  initToggle('customRightClickMenuToggle', () => typeof getCustomMenuSetting === 'function' ? getCustomMenuSetting() : true);
  initToggle('nativeNotificationToggle', () => typeof isNativeNotificationEnabled === 'function' ? isNativeNotificationEnabled() : false);
  initToggle('chimeToggle', () => typeof isChimeEnabled === 'function' ? isChimeEnabled() : true);

  // 2. 初始化字体选择下拉
  const fontWrapper = modalInstance.querySelector('#fontSelectComponent');
  if (fontWrapper && typeof initCustomSelect === 'function') {
    initCustomSelect(fontWrapper, 'setting_font_mode', (mode) => {
      if (typeof applyFontMode === 'function') applyFontMode(mode);
      modalInstance.showToast('字体已切换');
    });
  }

  // 3. 初始化 CDN 选择下拉
  const cdnWrapper = modalInstance.querySelector('#cdnSelectComponent');
  if (cdnWrapper && typeof initCustomSelect === 'function') {
    initCustomSelect(cdnWrapper, 'setting_cdn_source', (mode) => {
      const nameMap = { 'eo': 'EdgeOne', 'cf': 'Cloudflare' };
      modalInstance.showToast(`线路已切换为：${nameMap[mode] || mode}，即将刷新...`);
      setTimeout(() => location.reload(), 1000);
    });
  }

  // 4. 初始化颜色模式 (Segmented Control)
  const modeControl = modalInstance.querySelector('#themeModeControl');
  if (modeControl) {
    const savedMode = localStorage.getItem('setting_theme_mode') || 'system';
    const btns = modeControl.querySelectorAll('button');
    btns.forEach(btn => {
      if (btn.dataset.value === savedMode) btn.classList.add('active');
      else btn.classList.remove('active');

      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const selected = btn.dataset.value;
        if (selected === 'system') {
          localStorage.removeItem('setting_theme_mode');
          modalInstance.showToast('已切换为：跟随系统');
        } else {
          localStorage.setItem('setting_theme_mode', selected);
          modalInstance.showToast(`已切换为：${selected === 'light' ? '明亮模式' : '深色模式'}`);
        }
        if (typeof applyThemeMode === 'function') applyThemeMode(selected);
      });
    });
  }

  // 5. 初始化主题色色块选择器
  const themeSelector = modalInstance.querySelector('#themeColorSelector');
  if (themeSelector && typeof initThemeColorSelector === 'function') {
    const savedColor = localStorage.getItem('setting_theme_color') || 'default';
    initThemeColorSelector(themeSelector, savedColor);
  }

  // 6. 统一初始化滑块动效
  if (typeof initSegmentedControls === 'function') {
    initSegmentedControls();
  }

  // 显示模态框
  modalInstance.show();

  // 如果指定了锚点 ID，滚动到该位置
  if (anchorId) {
    setTimeout(() => {
      const target = modalInstance.querySelector(`#${anchorId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.transition = 'box-shadow 0.3s ease';
        target.style.boxShadow = '0 0 0 2px var(--primary-color)';
        setTimeout(() => { target.style.boxShadow = ''; }, 1500);
      }
    }, 300);
  }
};