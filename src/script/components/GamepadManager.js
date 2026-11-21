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

(function () {
  'use strict';

  if (window.SatinGamepad) return;

  /* ==========================================================================
   * 1. 控制器 Profile 抽象层（当前完整适配 Xbox，预留 PlayStation 扩展接口）
   * ========================================================================== */
  const STANDARD_ACTIONS = {
    CONFIRM: 0,     // Xbox: A  | PS(未来): Cross (✕)
    CANCEL: 1,      // Xbox: B  | PS(未来): Circle (○)
    ACTION_X: 2,    // Xbox: X  | PS(未来): Square (□)
    ACTION_Y: 3,    // Xbox: Y  | PS(未来): Triangle (△)
    NAV_PREV: 4,    // Xbox: LB | PS(未来): L1
    NAV_NEXT: 5,    // Xbox: RB | PS(未来): R1
    LT: 6,          // Xbox: LT | PS(未来): L2
    RT: 7,          // Xbox: RT | PS(未来): R2
    VIEW: 8,        // Xbox: View | PS(未来): Create / Share
    MENU: 9,        // Xbox: Menu | PS(未来): Options
    L3: 10,
    R3: 11,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15
  };

  const CONTROLLER_PROFILES = {
    xbox: {
      id: 'xbox',
      name: 'Xbox 控制器',
      supported: true,
      buttonMap: STANDARD_ACTIONS,
      labels: {
        CONFIRM: 'A',
        CANCEL: 'B',
        ACTION_X: 'X',
        ACTION_Y: 'Y',
        NAV_PREV: 'LB',
        NAV_NEXT: 'RB',
        LT: 'LT',
        RT: 'RT',
        VIEW: 'View',
        MENU: 'Menu',
        RS: 'RS',
        DPAD: '方向键'
      }
    },
    // 未来接入 PlayStation 手柄时，将 supported 改为 true 并补充 PS 图形渲染分支即可
    playstation: {
      id: 'playstation',
      name: 'PlayStation 控制器',
      supported: false,
      buttonMap: STANDARD_ACTIONS,
      labels: {
        CONFIRM: '✕',
        CANCEL: '○',
        ACTION_X: '□',
        ACTION_Y: '△',
        NAV_PREV: 'L1',
        NAV_NEXT: 'R1',
        LT: 'L2',
        RT: 'R2',
        VIEW: 'Create',
        MENU: 'Options',
        RS: 'R3',
        DPAD: '方向键'
      }
    }
  };

  /**
   * 识别手柄类型：现阶段仅放行 Xbox / XInput / Standard 兼容 Xbox 控制器
   * 对明确识别为 Sony PlayStation (054c / DualSense / DualShock) 或 Nintendo (057e) 的手柄返回未适配标记
   */
  function detectControllerProfile(gamepad) {
    if (!gamepad) return null;
    const idStr = String(gamepad.id || '').toLowerCase();

    // 显式识别 PlayStation 手柄（预留，暂未启用）
    if (
      idStr.includes('054c') ||
      idStr.includes('dualshock') ||
      idStr.includes('dualsense') ||
      idStr.includes('playstation') ||
      idStr.includes('sony')
    ) {
      return CONTROLLER_PROFILES.playstation;
    }

    // 明确识别 Xbox / XInput / Microsoft (045e) 或标准映射手柄
    if (
      idStr.includes('xbox') ||
      idStr.includes('xinput') ||
      idStr.includes('045e') ||
      idStr.includes('microsoft') ||
      gamepad.mapping === 'standard'
    ) {
      return CONTROLLER_PROFILES.xbox;
    }

    return null;
  }

  /* ==========================================================================
   * 2. 游戏级按键图标 SVG 工厂（支持多 Profile 扩展）
   * ========================================================================== */
  const GamepadIcons = {
    render(action, profileId = 'xbox', size = 'md') {
      const sizeClass = `gp-badge--${size}`;
      if (profileId === 'xbox') {
        switch (action) {
          case 'CONFIRM':
            return `<span class="gp-badge gp-badge--circle gp-xbox-a ${sizeClass}" aria-hidden="true">A</span>`;
          case 'CANCEL':
            return `<span class="gp-badge gp-badge--circle gp-xbox-b ${sizeClass}" aria-hidden="true">B</span>`;
          case 'ACTION_X':
            return `<span class="gp-badge gp-badge--circle gp-xbox-x ${sizeClass}" aria-hidden="true">X</span>`;
          case 'ACTION_Y':
            return `<span class="gp-badge gp-badge--circle gp-xbox-y ${sizeClass}" aria-hidden="true">Y</span>`;
          case 'NAV_PREV':
            return `<span class="gp-badge gp-badge--bumper gp-xbox-lb ${sizeClass}" aria-hidden="true">LB</span>`;
          case 'NAV_NEXT':
            return `<span class="gp-badge gp-badge--bumper gp-xbox-rb ${sizeClass}" aria-hidden="true">RB</span>`;
          case 'LT':
            return `<span class="gp-badge gp-badge--trigger ${sizeClass}" aria-hidden="true">LT</span>`;
          case 'RT':
            return `<span class="gp-badge gp-badge--trigger ${sizeClass}" aria-hidden="true">RT</span>`;
          case 'MENU':
            return `<span class="gp-badge gp-badge--system ${sizeClass}" aria-hidden="true" title="Menu">
              <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <line x1="3" y1="4.5" x2="13" y2="4.5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11.5" x2="13" y2="11.5"/>
              </svg>
            </span>`;
          case 'VIEW':
            return `<span class="gp-badge gp-badge--system ${sizeClass}" aria-hidden="true" title="View">
              <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
                <rect x="2.5" y="2.5" width="7" height="7" rx="1"/><path d="M6.5 11.5v2h7v-7h-2"/>
              </svg>
            </span>`;
          case 'RS':
            return `<span class="gp-badge gp-badge--stick ${sizeClass}" aria-hidden="true">RS</span>`;
          case 'DPAD':
            return `<span class="gp-badge gp-badge--system ${sizeClass}" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
                <path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5V2z"/>
              </svg>
            </span>`;
          default:
            return '';
        }
      }
      // 未来 PlayStation 图标分支预留
      return `<span class="gp-badge ${sizeClass}" aria-hidden="true">${action}</span>`;
    }
  };

  /* ==========================================================================
   * 3. 可聚焦元素判定与 2D 空间导航算法
   * ========================================================================== */
  const FOCUSABLE_SELECTOR = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '.contact-card',
    '.blog-card',
    '.gallery-item',
    '.filter-tag',
    '.custom-select-trigger',
    '.custom-option',
    '.cdn-option-item',
    '.theme-swatch',
    '.toggle-switch',
    '.dropdown-item',
    '.nav-user-card',
    '.nav-task-item',
    '.nav-task-close',
    '.mobile-nav-task-item',
    '.notify-mark-read',
    '.nav-notice-action',
    '.notify-retry',
    '.live2d-menu-btn',
    '.blog-group-tab'
  ].join(', ');

  function isTextInputElement(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
    if (el.tagName === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(type);
    }
    return false;
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;

    // 博客搜索激活态下 #momentsCard 被强制折叠隐藏，不可聚焦
    if (document.body.classList.contains('search-active') && el.closest('#momentsCard')) {
      return false;
    }

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    // 排除正在执行移除动画的多任务项
    if (el.closest('.is-removing')) {
      return false;
    }

    // 允许：1) 视口下方被滚动动画暂设为 opacity: 0 的元素；2) 导航栏刚展开时处于入场过渡中的多任务项
    const opacityVal = parseFloat(style.opacity);
    const isEnteringTask = Boolean(
      el.closest('.bottom-nav.more-open .nav-task-item') ||
      el.closest('.bottom-nav.menu-open .mobile-nav-task-item')
    );
    if (opacityVal === 0 && !el.closest('.scroll-anim-item') && !isEnteringTask) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;

    // 排除隐藏的下拉框内部项
    const customOptions = el.closest('.custom-options');
    if (customOptions) {
      const wrapper = customOptions.closest('.custom-select-wrapper');
      if (wrapper && !wrapper.classList.contains('open')) return false;
    }
    // 排除未展开的导航下拉菜单项
    const moreDrop = el.closest('.more-dropdown');
    if (moreDrop && !moreDrop.classList.contains('show')) return false;
    const notifyDrop = el.closest('.notify-dropdown');
    if (notifyDrop && !notifyDrop.classList.contains('show')) return false;
    const mobileMenu = el.closest('.mobile-more-menu');
    if (mobileMenu) {
      const nav = document.querySelector('.bottom-nav');
      if (!nav || !nav.classList.contains('menu-open')) return false;
    }
    return true;
  }

  /**
   * 获取指定根容器（支持单个节点或节点数组）内所有可聚焦且可见的元素
   */
  function getFocusableElements(roots) {
    const rootList = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
    if (!rootList.length) return [];

    const seen = new Set();
    const result = [];

    for (const root of rootList) {
      const raw = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
      for (const el of raw) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (!isElementVisible(el)) continue;
        // 跳过 toggle-switch 内部隐藏的 checkbox，统一聚焦 .toggle-switch 容器
        if (el.tagName === 'INPUT' && el.closest('.toggle-switch')) continue;
        // 跳过被已关闭或未激活的父级 aria-hidden 包裹的元素
        const hiddenAncestor = el.closest('[aria-hidden="true"]');
        if (hiddenAncestor && !rootList.includes(hiddenAncestor)) continue;
        result.push(el);
      }
    }

    return result;
  }

  /**
   * 2D 空间方向查找：根据中心点坐标与方向向量挑选视觉上最自然的下一个焦点
   */
  function findNextSpatialTarget(currentEl, candidates, dir) {
    if (!candidates.length) return null;
    if (!currentEl || !candidates.includes(currentEl)) return candidates[0];

    const curRect = currentEl.getBoundingClientRect();
    const curCx = curRect.left + curRect.width / 2;
    const curCy = curRect.top + curRect.height / 2;

    let bestEl = null;
    let bestScore = Infinity;

    for (const el of candidates) {
      if (el === currentEl) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      const dx = cx - curCx;
      const dy = cy - curCy;

      let primary = 0;
      let secondary = 0;

      if (dir === 'up') {
        if (dy >= -4) continue;
        primary = -dy;
        secondary = Math.abs(dx);
      } else if (dir === 'down') {
        if (dy <= 4) continue;
        primary = dy;
        secondary = Math.abs(dx);
      } else if (dir === 'left') {
        if (dx >= -4) continue;
        primary = -dx;
        secondary = Math.abs(dy);
      } else if (dir === 'right') {
        if (dx <= 4) continue;
        primary = dx;
        secondary = Math.abs(dy);
      }

      // 优先选择主轴对齐度高且距离近的目标
      const score = primary + secondary * 2.4;
      if (score < bestScore) {
        bestScore = score;
        bestEl = el;
      }
    }

    return bestEl;
  }

  /* ==========================================================================
   * 4. 主控制器引擎 GamepadManager
   * ========================================================================== */
  const MAIN_NAV_PAGES = [
    { id: 'index', href: '/index.html', label: '缎金' },
    { id: 'blog', href: '/blog.html', label: '博客' },
    { id: 'zelynn', href: '/zelynn.html', label: '泽凌' }
  ];

  class GamepadManager {
    constructor() {
      this.activeGamepadIndex = null;
      this.profile = CONTROLLER_PROFILES.xbox;
      this.isGamepadMode = false;

      // 摇杆与按键状态
      this.deadzone = 0.24;
      this.stickNavThreshold = 0.52;
      this.rightStickScrollSpeed = 24;
      this.prevButtons = [];

      // 方向键/左摇杆连发状态机（主机标准手感）
      this.heldDir = null;
      this.dirRepeatAt = 0;
      this.repeatInitialDelay = 360;
      this.repeatInterval = 110;

      // 焦点管理与弹窗焦点栈
      this.currentFocusEl = null;
      this.focusStack = [];

      // HUD DOM 引用
      this.hudEl = null;
      this.lastHudSignature = '';
      this.rafId = null;

      this.init();
    }

    init() {
      this.createHud();
      this.bindGlobalEvents();
      this.startLoop();
    }

    bindGlobalEvents() {
      window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
      window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));

      // 键鼠/触屏操作时静默退出手柄视觉模式（不清除已连接手柄）
      const exitVisualMode = (e) => {
        if (!this.isGamepadMode) return;
        // 忽略手柄派发的合成事件
        if (e && e.isTrusted === false) return;
        this.setGamepadMode(false);
      };
      window.addEventListener('mousemove', exitVisualMode, { passive: true });
      window.addEventListener('mousedown', exitVisualMode, { passive: true });
      window.addEventListener('touchstart', exitVisualMode, { passive: true });
      window.addEventListener('wheel', exitVisualMode, { passive: true });

      // 监听 GlobalModal 生命周期事件
      window.addEventListener('satin-modal-open', (e) => this.onModalOpen(e.detail));
      window.addEventListener('satin-modal-close', (e) => this.onModalClose(e.detail));

      // 监听导航菜单状态变化
      window.addEventListener('satin-menu-state-changed', () => {
        if (this.isGamepadMode) {
          this.ensureValidFocus();
          this.refreshHud();
        }
      });

      window.addEventListener('modal-tasks-changed', () => {
        if (this.isGamepadMode && document.querySelector('.more-dropdown.show, .bottom-nav.menu-open')) {
          setTimeout(() => {
            this.ensureValidFocus();
            this.refreshHud(true);
          }, 80);
        }
      });

      // 监听 Viewer.js 打开/关闭（通过 body class 变化）
      const bodyObserver = new MutationObserver(() => {
        if (this.isGamepadMode) {
          this.refreshHud();
        }
      });
      if (document.body) {
        bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    }

    onGamepadConnected(e) {
      const gp = e.gamepad;
      const profile = detectControllerProfile(gp);

      if (!profile) {
        if (typeof showToast === 'function') {
          showToast(`🎮 检测到未识别控制器（当前仅支持 Xbox 手柄）`);
        }
        return;
      }

      if (!profile.supported) {
        if (typeof showToast === 'function') {
          showToast(`🎮 检测到 ${profile.name}，当前版本仅适配 Xbox 手柄（后续支持）`);
        }
        return;
      }

      this.activeGamepadIndex = gp.index;
      this.profile = profile;
      this.prevButtons = gp.buttons.map((b) => Boolean(b && b.pressed));
      this.syncBumperBadges();
      this.setGamepadMode(true);
      this.vibrate(40, 0.25, 0.15);

      if (typeof showToast === 'function') {
        showToast(`🎮 Xbox 游戏控制器已连接`);
      }
    }

    onGamepadDisconnected(e) {
      if (e.gamepad.index === this.activeGamepadIndex) {
        this.activeGamepadIndex = null;
        this.prevButtons = [];
        this.heldDir = null;
        this.setGamepadMode(false);
        if (typeof showToast === 'function') {
          showToast(`🔌 Xbox 游戏控制器已断开`);
        }
      }
    }

    setGamepadMode(active) {
      if (this.isGamepadMode === active) return;
      this.isGamepadMode = active;
      document.documentElement.classList.toggle('gamepad-active', active);
      document.documentElement.setAttribute('data-gamepad-profile', this.profile.id);

      if (active) {
        this.syncBumperBadges();
        this.decorateActiveModals();
        this.ensureValidFocus();
        this.refreshHud(true);
      } else {
        this.clearFocusHighlight();
      }
    }

    /* ========================================================================
     * 主轮询循环
     * ======================================================================== */
    startLoop() {
      const tick = () => {
        this.poll();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    poll() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = this.activeGamepadIndex !== null ? gamepads[this.activeGamepadIndex] : null;

      // 兼容页面刷新后手柄已处于连接状态（未触发新 gamepadconnected 事件）
      if (!gp || !gp.connected) {
        for (const candidate of gamepads) {
          if (candidate && candidate.connected) {
            const p = detectControllerProfile(candidate);
            if (p && p.supported) {
              this.activeGamepadIndex = candidate.index;
              this.profile = p;
              this.prevButtons = candidate.buttons.map((b) => Boolean(b && b.pressed));
              gp = candidate;
              break;
            }
          }
        }
      }

      if (!gp || !gp.connected) return;

      const now = performance.now();
      const map = this.profile.buttonMap;
      const pressed = gp.buttons.map((b) => Boolean(b && (b.pressed || b.value > 0.5)));

      const justPressed = (idx) => Boolean(pressed[idx] && !this.prevButtons[idx]);

      // 检测任意用户输入以唤醒手柄模式
      const lx = this.applyDeadzone(gp.axes[0] || 0);
      const ly = this.applyDeadzone(gp.axes[1] || 0);
      const ry = this.applyDeadzone(gp.axes[3] || 0);
      const anyButtonPressed = pressed.some((p, i) => p && !this.prevButtons[i]);

      if (!this.isGamepadMode && (anyButtonPressed || Math.abs(lx) > 0.4 || Math.abs(ly) > 0.4 || Math.abs(ry) > 0.4)) {
        this.setGamepadMode(true);
      }

      if (this.isGamepadMode) {
        // 1. 方向输入（十字键优先，其次左摇杆）
        const dir = this.resolveDirection(pressed, map, lx, ly);
        this.handleDirectionRepeat(dir, now);

        // 2. 右摇杆平滑滚动（智能识别顶层弹窗或主页面）
        if (Math.abs(ry) > 0) {
          this.scrollActiveContainer(ry * this.rightStickScrollSpeed);
        }

        // 3. 功能按键（严格边沿触发）
        if (justPressed(map.CONFIRM)) this.handleConfirm();
        if (justPressed(map.CANCEL)) this.handleBack();
        if (justPressed(map.NAV_PREV)) this.handleBumper(-1);
        if (justPressed(map.NAV_NEXT)) this.handleBumper(1);
        if (justPressed(map.ACTION_X)) this.handleActionX();
        if (justPressed(map.ACTION_Y)) this.handleActionY();
        if (justPressed(map.MENU)) this.handleMenuButton();
        if (justPressed(map.VIEW)) this.handleViewButton();
        if (justPressed(map.LT)) this.handleTrigger(-1);
        if (justPressed(map.RT)) this.handleTrigger(1);

        // 4. 动态刷新 HUD 上下文
        this.refreshHud();
      }

      this.prevButtons = pressed;
    }

    applyDeadzone(val) {
      if (Math.abs(val) < this.deadzone) return 0;
      const sign = Math.sign(val);
      return ((Math.abs(val) - this.deadzone) / (1 - this.deadzone)) * sign;
    }

    resolveDirection(pressed, map, lx, ly) {
      if (pressed[map.DPAD_UP]) return 'up';
      if (pressed[map.DPAD_DOWN]) return 'down';
      if (pressed[map.DPAD_LEFT]) return 'left';
      if (pressed[map.DPAD_RIGHT]) return 'right';

      if (Math.abs(lx) > this.stickNavThreshold || Math.abs(ly) > this.stickNavThreshold) {
        if (Math.abs(lx) > Math.abs(ly)) {
          return lx > 0 ? 'right' : 'left';
        }
        return ly > 0 ? 'down' : 'up';
      }
      return null;
    }

    handleDirectionRepeat(dir, now) {
      if (!dir) {
        this.heldDir = null;
        return;
      }
      if (dir !== this.heldDir) {
        this.heldDir = dir;
        this.dirRepeatAt = now + this.repeatInitialDelay;
        this.navigateDirection(dir);
      } else if (now >= this.dirRepeatAt) {
        this.dirRepeatAt = now + this.repeatInterval;
        this.navigateDirection(dir);
      }
    }

    /* ========================================================================
     * 上下文感知与焦点容器栈
     * ======================================================================== */
    getTopModalLayer() {
      const gm = document.querySelector('global-modal');
      if (!gm || !Array.isArray(gm.layers)) return null;
      const active = gm.layers.filter((l) => !l.isClosing && !l.isMinimized && l.modal && l.modal.isConnected);
      return active.length ? active[active.length - 1] : null;
    }

    getActiveScopeRoots() {
      // 1. 打开的自定义下拉菜单
      const openSelect = document.querySelector('.custom-select-wrapper.open');
      if (openSelect) return [openSelect];

      // 2. 顶层 GlobalModal 弹窗
      const topLayer = this.getTopModalLayer();
      if (topLayer) return [topLayer.modal];

      // 3. 桌面端展开的更多菜单（开启多任务时同时纳入顶部中央 #desktopTaskBar）
      const moreDrop = document.querySelector('.more-dropdown.show');
      if (moreDrop) {
        const roots = [moreDrop];
        const taskBar = document.getElementById('desktopTaskBar');
        const nav = document.querySelector('.bottom-nav');
        if (
          taskBar &&
          nav &&
          nav.classList.contains('more-open') &&
          taskBar.getAttribute('aria-hidden') !== 'true'
        ) {
          roots.push(taskBar);
        }
        return roots;
      }

      // 4. 桌面端展开的通知菜单
      const notifyDrop = document.querySelector('.notify-dropdown.show');
      if (notifyDrop) return [notifyDrop];

      // 5. 移动端展开菜单（仅聚焦当前激活分页，含多任务中心/更多/通知）
      const nav = document.querySelector('.bottom-nav.menu-open');
      if (nav) {
        const activeDot = nav.querySelector('.mobile-page-dot.active');
        const pageIdx = activeDot ? activeDot.dataset.page : '1';
        const pageSelectorMap = {
          '0': '.mobile-page-tasks',
          '1': '.mobile-page-more',
          '2': '.mobile-page-notify'
        };
        const activePage = nav.querySelector(pageSelectorMap[pageIdx] || '.mobile-more-menu');
        if (activePage) return [activePage];
      }

      // 6. 常规页面主体
      return [document.querySelector('main.page') || document.body];
    }

    ensureValidFocus() {
      const roots = this.getActiveScopeRoots();
      const candidates = getFocusableElements(roots);
      if (!candidates.length) {
        this.clearFocusHighlight();
        return;
      }
      if (this.currentFocusEl && candidates.includes(this.currentFocusEl)) {
        this.applyFocus(this.currentFocusEl, false);
        return;
      }
      // 弹窗场景下优先聚焦主操作按钮（如 #modalConfirm 或首个可交互项）
      const primaryRoot = roots[0];
      const preferred =
        (primaryRoot && primaryRoot.querySelector('#modalConfirm')) ||
        (primaryRoot && primaryRoot.querySelector('.cdn-option-item.active')) ||
        candidates[0];
      this.applyFocus(preferred, false);
    }

    navigateDirection(dir) {
      // 图片查看器开启时，左右键直接切图
      if (document.body.classList.contains('viewer-open')) {
        if (dir === 'left') this.triggerViewerNav('prev');
        if (dir === 'right') this.triggerViewerNav('next');
        return;
      }

      // 分段控制器获得焦点时，左右方向键直接切换选项
      if (this.currentFocusEl && (dir === 'left' || dir === 'right')) {
        const seg = this.currentFocusEl.closest('.segmented-control');
        if (seg) {
          const btns = Array.from(seg.querySelectorAll('button'));
          const idx = btns.indexOf(this.currentFocusEl);
          if (idx !== -1) {
            const nextIdx = dir === 'right' ? Math.min(btns.length - 1, idx + 1) : Math.max(0, idx - 1);
            if (nextIdx !== idx) {
              this.applyFocus(btns[nextIdx], true);
              btns[nextIdx].click();
              this.vibrate(14, 0.1, 0.08);
              return;
            }
          }
        }
      }

      const roots = this.getActiveScopeRoots();
      const candidates = getFocusableElements(roots);
      if (!candidates.length) return;

      if (!this.currentFocusEl || !candidates.includes(this.currentFocusEl)) {
        this.applyFocus(candidates[0], true);
        return;
      }

      const next = findNextSpatialTarget(this.currentFocusEl, candidates, dir);
      if (next) {
        this.applyFocus(next, true);
        this.vibrate(12, 0.08, 0.05);
      } else if (dir === 'up' || dir === 'down') {
        // 到达边缘时允许轻微滚动，使视口外元素进入可聚焦视野
        this.scrollActiveContainer(dir === 'down' ? 180 : -180);
      }
    }

    applyFocus(el, shouldScroll = true) {
      if (!el || !el.isConnected) return;
      this.clearFocusHighlight();
      this.currentFocusEl = el;
      el.classList.add('gamepad-focus');

      if (isTextInputElement(el)) {
        // 文本输入框/搜索框仅显示手柄高亮框，不主动触发原生 focus（防止博客搜索栏直接展开）
        if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === 'function') {
          try { document.activeElement.blur(); } catch (err) {}
        }
      } else if (typeof el.focus === 'function') {
        try {
          el.focus({ preventScroll: true });
        } catch (err) {}
      }

      if (shouldScroll) {
        const isInOverlay = Boolean(
          el.closest('.modal, .more-dropdown, .notify-dropdown, .mobile-more-menu, .custom-options, .nav-task-bar')
        );
        el.scrollIntoView({
          behavior: 'smooth',
          block: isInOverlay ? 'nearest' : 'center',
          inline: 'nearest'
        });
      }
    }

    clearFocusHighlight() {
      if (this.currentFocusEl) {
        this.currentFocusEl.classList.remove('gamepad-focus');
      }
      document.querySelectorAll('.gamepad-focus').forEach((node) => {
        node.classList.remove('gamepad-focus');
      });
    }

    /* ========================================================================
     * 按键动作处理：A 确认 / B 取消退出 / LB&RB 导航 / X&Y / Menu&View / 滚动
     * ======================================================================== */
    handleConfirm() {
      // 图片查看器中按 A 切换 1:1 缩放
      if (document.body.classList.contains('viewer-open')) {
        const oneToOne = document.querySelector('.viewer-one-to-one');
        if (oneToOne) oneToOne.click();
        this.vibrate(20, 0.18, 0.1);
        return;
      }

      this.ensureValidFocus();
      const el = this.currentFocusEl;
      if (!el) return;

      this.vibrate(22, 0.2, 0.12);

      // 特殊控件：toggle-switch
      if (el.classList.contains('toggle-switch')) {
        const input = el.querySelector('input[type="checkbox"]');
        if (input) {
          input.checked = !input.checked;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }

      // 特殊控件：画廊图片包裹层
      if (el.classList.contains('gallery-item')) {
        const img = el.querySelector('img');
        if (img) {
          img.click();
          return;
        }
      }

      // 文本输入框 / 博客搜索框：按 A 键后才真正激活输入与搜索模式
      if (isTextInputElement(el)) {
        el.focus();
        if (el.id === 'blogSearchInput') {
          el.click();
        }
        this.refreshHud(true);
        return;
      }

      el.click();

      // 下拉框展开后自动把焦点切入选项列表
      setTimeout(() => {
        if (this.isGamepadMode) {
          this.ensureValidFocus();
          this.refreshHud(true);
        }
      }, 60);
    }

    handleBack() {
      this.vibrate(26, 0.18, 0.15);

      // 1. 关闭已展开的自定义下拉框
      const openSelect = document.querySelector('.custom-select-wrapper.open');
      if (openSelect) {
        openSelect.classList.remove('open');
        const trigger = openSelect.querySelector('.custom-select-trigger');
        if (trigger) this.applyFocus(trigger, false);
        this.refreshHud(true);
        return;
      }

      // 2. 关闭自定义右键菜单 (CRCMenu)
      const crcMenu = document.querySelector('custom-right-click-menu');
      if (crcMenu && crcMenu.isMenuVisible && typeof crcMenu.hideMenu === 'function') {
        crcMenu.hideMenu();
        return;
      }

      // 3. 关闭 Live2D 悬浮菜单
      const live2dMenu = document.querySelector('.live2d-menu.show');
      if (live2dMenu) {
        live2dMenu.classList.remove('show');
        return;
      }

      // 4. 退出 Viewer.js 图片预览
      if (document.body.classList.contains('viewer-open')) {
        const gm = document.querySelector('global-modal');
        if (gm && gm.activeImageViewer && gm.activeImageViewer.viewer) {
          gm.activeImageViewer.viewer.hide();
          return;
        }
        const closeBtn = document.querySelector('.viewer-container .viewer-close');
        if (closeBtn) {
          closeBtn.click();
          return;
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }

      // 5. 关闭 GlobalModal 顶层弹窗（若为全屏网页弹窗则优先退出全屏）
      const gm = document.querySelector('global-modal');
      if (gm && typeof gm.handleGamepadBack === 'function' && gm.handleGamepadBack()) {
        return;
      }

      // 6. 关闭底部导航栏展开的下拉菜单（更多 / 通知 / 移动端菜单）
      const moreDrop = document.querySelector('.more-dropdown.show');
      if (moreDrop && typeof window.closeMoreMenu === 'function') {
        window.closeMoreMenu();
        this.ensureValidFocus();
        this.refreshHud(true);
        return;
      }
      const notifyDrop = document.querySelector('.notify-dropdown.show');
      if (notifyDrop && typeof window.closeNotifyMenu === 'function') {
        window.closeNotifyMenu();
        this.ensureValidFocus();
        this.refreshHud(true);
        return;
      }
      const bottomNav = document.querySelector('.bottom-nav.menu-open');
      if (bottomNav && typeof window.closeMobileMoreMenu === 'function') {
        window.closeMobileMoreMenu();
        this.ensureValidFocus();
        this.refreshHud(true);
        return;
      }

      // 6.5 若当前有文本输入框处于原生编辑焦点（非博客搜索激活态），按 B 先退出输入
      if (
        document.activeElement &&
        isTextInputElement(document.activeElement) &&
        !document.body.classList.contains('search-active')
      ) {
        document.activeElement.blur();
        this.refreshHud(true);
        return;
      }

      // 7. 博客页特殊返回逻辑（文章正文返回列表 / 取消搜索）
      if (document.body.id === 'blog-page') {
        const postView = document.getElementById('postView');
        const backBtn = document.getElementById('backToList');
        if (postView && window.getComputedStyle(postView).display !== 'none' && backBtn) {
          backBtn.click();
          setTimeout(() => this.ensureValidFocus(), 350);
          return;
        }
        if (document.body.classList.contains('search-active')) {
          const cancelSearch = document.getElementById('searchCancelBtn');
          if (cancelSearch) {
            cancelSearch.click();
            const searchInput = document.getElementById('blogSearchInput');
            setTimeout(() => {
              if (searchInput && searchInput.isConnected) {
                this.applyFocus(searchInput, false);
              }
              this.refreshHud(true);
            }, 80);
            return;
          }
        }
      }

      // 8. 二级子页面返回上一页或首页
      if (window.location.pathname.includes('/pages/')) {
        if (window.history.length > 1) {
          window.history.back();
        } else if (typeof window.navigateTo === 'function') {
          window.navigateTo('/index.html');
        }
      }
    }

    handleBumper(delta) {
      this.flashBumperHint(delta < 0 ? 'lb' : 'rb');
      this.vibrate(24, 0.16, 0.12);

      // 上下文 1：图片查看器中切换上一张/下一张
      if (document.body.classList.contains('viewer-open')) {
        this.triggerViewerNav(delta < 0 ? 'prev' : 'next');
        return;
      }

      // 上下文 2：多文章弹窗切换顶部标签页
      const topLayer = this.getTopModalLayer();
      if (topLayer && topLayer.modal) {
        const tabs = Array.from(topLayer.modal.querySelectorAll('.blog-group-tab'));
        if (tabs.length > 1) {
          const curIdx = tabs.findIndex((t) => t.classList.contains('active'));
          const nextIdx = (curIdx + delta + tabs.length) % tabs.length;
          tabs[nextIdx].click();
          return;
        }
        // 弹窗打开但无标签页时，禁止穿透切换底层页面
        return;
      }

      // 上下文 2.5：移动端底部菜单展开时，LB / RB 切换多任务 / 更多 / 通知页
      const mobileNav = document.querySelector('.bottom-nav.menu-open');
      if (mobileNav) {
        const dots = Array.from(mobileNav.querySelectorAll('.mobile-page-dot')).filter(isElementVisible);
        if (dots.length > 1) {
          const curIdx = dots.findIndex((d) => d.classList.contains('active'));
          const nextIdx = (curIdx + delta + dots.length) % dots.length;
          dots[nextIdx].click();
          setTimeout(() => {
            this.ensureValidFocus();
            this.refreshHud(true);
          }, 120);
          return;
        }
      }

      // 上下文 3：切换底部主导航栏（缎金 / 博客 / 泽凌）
      const navBar = document.querySelector('navigate-bar');
      const currentPath = navBar && typeof navBar.getCurrentPath === 'function'
        ? navBar.getCurrentPath()
        : (document.body.id || '').replace('-page', '') || 'index';

      let curIdx = MAIN_NAV_PAGES.findIndex((p) => p.id === currentPath);
      if (curIdx === -1) {
        curIdx = delta > 0 ? -1 : MAIN_NAV_PAGES.length;
      }
      const nextIdx = (curIdx + delta + MAIN_NAV_PAGES.length) % MAIN_NAV_PAGES.length;
      const target = MAIN_NAV_PAGES[nextIdx];

      if (typeof window.navigateTo === 'function') {
        window.navigateTo(target.href);
      } else {
        window.location.href = target.href;
      }
    }

    handleActionX() {
      // 若当前焦点位于多任务项上，按 X 直接关闭该后台任务
      if (this.currentFocusEl && this.currentFocusEl.isConnected) {
        const taskItem = this.currentFocusEl.closest('.nav-task-item, .mobile-nav-task-item');
        if (taskItem) {
          const closeBtn = taskItem.querySelector('.nav-task-close');
          if (closeBtn) {
            closeBtn.click();
            this.vibrate(22, 0.16, 0.12);
            setTimeout(() => {
              this.ensureValidFocus();
              this.refreshHud(true);
            }, 120);
            return;
          }
        }
      }

      const topLayer = this.getTopModalLayer();
      if (topLayer && topLayer.modal) {
        const zoomBtn = topLayer.modal.querySelector('#docZoomBtn');
        if (zoomBtn) {
          zoomBtn.click();
          this.vibrate(20, 0.15, 0.1);
          return;
        }
      }

      // 常规页面：对当前焦点元素呼出自定义右键菜单
      if (this.currentFocusEl && this.currentFocusEl.isConnected) {
        const rect = this.currentFocusEl.getBoundingClientRect();
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          view: window
        });
        this.currentFocusEl.dispatchEvent(event);
        this.vibrate(18, 0.14, 0.08);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    // Y 键：快捷打开 / 关闭「网站设置」弹窗
    handleActionY() {
      const topLayer = this.getTopModalLayer();
      if (topLayer && topLayer.modal && topLayer.modal.classList.contains('settings-modal')) {
        topLayer.close();
        this.vibrate(22, 0.15, 0.1);
        return;
      }
      if (topLayer) return;
      if (typeof window.openSettingsModal === 'function') {
        window.openSettingsModal(null);
        this.vibrate(22, 0.18, 0.12);
      }
    }

    // Start (Menu, index 9)：打开 / 关闭「更多」菜单（含多任务栏）
    handleMenuButton() {
      if (this.getTopModalLayer()) return;
      if (typeof window.toggleMoreMenu === 'function') {
        window.toggleMoreMenu();
        this.vibrate(20, 0.15, 0.1);
        setTimeout(() => {
          this.ensureValidFocus();
          this.refreshHud(true);
        }, 80);
      }
    }

    // Select (View, index 8)：打开 / 关闭「通知中心」
    handleViewButton() {
      if (this.getTopModalLayer()) return;
      if (typeof window.toggleNotifyMenu === 'function') {
        window.toggleNotifyMenu();
        this.vibrate(20, 0.15, 0.1);
        setTimeout(() => {
          this.ensureValidFocus();
          this.refreshHud(true);
        }, 80);
      }
    }

    handleTrigger(dir) {
      if (document.body.classList.contains('viewer-open')) {
        const btn = document.querySelector(dir > 0 ? '.viewer-zoom-in' : '.viewer-zoom-out');
        if (btn) btn.click();
        return;
      }
      this.scrollActiveContainer(dir * Math.round(window.innerHeight * 0.45), true);
    }

    scrollActiveContainer(deltaY, smooth = false) {
      const topLayer = this.getTopModalLayer();
      let scrollTarget = null;
      if (topLayer && topLayer.modal) {
        scrollTarget =
          topLayer.modal.querySelector('.settings-modal-body') ||
          topLayer.modal.querySelector('.blog-modal-body') ||
          topLayer.modal.querySelector('.modal-content-wrapper') ||
          topLayer.modal;
      }
      if (scrollTarget && scrollTarget.scrollHeight > scrollTarget.clientHeight + 2) {
        scrollTarget.scrollBy({ top: deltaY, behavior: smooth ? 'smooth' : 'auto' });
      } else {
        window.scrollBy({ top: deltaY, behavior: smooth ? 'smooth' : 'auto' });
      }
    }

    triggerViewerNav(dir) {
      const btn = document.querySelector(dir === 'prev' ? '.viewer-prev' : '.viewer-next');
      if (btn) btn.click();
    }

    /* ========================================================================
     * 弹窗焦点栈与弹窗内 Xbox 按键提示 UI 注入
     * ======================================================================== */
    onModalOpen(detail) {
      const modal = detail && detail.modal;
      if (!modal) return;

      // 无论当前是否处于手柄模式，预先注入提示 DOM（CSS 仅在 html.gamepad-active 下显示）
      this.decorateModal(modal);

      if (this.isGamepadMode) {
        this.focusStack.push(this.currentFocusEl);
        setTimeout(() => {
          this.ensureValidFocus();
          this.refreshHud(true);
        }, 80);
      }
    }

    onModalClose() {
      if (!this.isGamepadMode) return;
      const prev = this.focusStack.pop();
      setTimeout(() => {
        if (prev && prev.isConnected && isElementVisible(prev)) {
          this.applyFocus(prev, false);
        } else {
          this.ensureValidFocus();
        }
        this.refreshHud(true);
      }, 120);
    }

    decorateActiveModals() {
      document.querySelectorAll('global-modal .modal').forEach((m) => this.decorateModal(m));
    }

    /**
     * 为弹窗内确认/取消/关闭按钮挂载 Xbox 按键徽章：
     * - 文字按钮：前置内联徽章
     * - 大型弹窗纯图标关闭按钮（设置/网页/博客浮窗）：右下角角标（不挤压原有 X SVG）
     * - 纯展示无按钮弹窗（如微信二维码）：底部注入 [B] 关闭提示栏
     */
    decorateModal(modal) {
      if (!modal || modal.dataset.gpDecorated === 'true') return;
      modal.dataset.gpDecorated = 'true';

      const attachInlineBadge = (selector, action) => {
        const el = modal.querySelector(selector);
        if (!el || el.querySelector('.gamepad-btn-hint')) return false;
        const span = document.createElement('span');
        span.className = 'gamepad-btn-hint';
        span.innerHTML = GamepadIcons.render(action, this.profile.id, 'sm');
        el.prepend(span);
        return true;
      };

      const attachCornerBadge = (selector, action) => {
        const el = modal.querySelector(selector);
        if (!el || el.querySelector('.gamepad-btn-hint')) return false;
        el.classList.add('has-gamepad-corner-badge');
        const span = document.createElement('span');
        span.className = 'gamepad-btn-hint gamepad-btn-hint--corner';
        span.innerHTML = GamepadIcons.render(action, this.profile.id, 'xs');
        el.appendChild(span);
        return true;
      };

      const hasConfirm = attachInlineBadge('#modalConfirm', 'CONFIRM');
      const hasInlineCancel =
        attachInlineBadge('#modalCancel', 'CANCEL') ||
        attachInlineBadge('#modalClose', 'CANCEL') ||
        attachInlineBadge('#modalCdnClose', 'CANCEL');
      const hasCornerClose =
        attachCornerBadge('#modalSettingsCloseBtn', 'CANCEL') ||
        attachCornerBadge('#docCloseBtn', 'CANCEL') ||
        attachCornerBadge('#blogModalCloseBtn', 'CANCEL');

      // 如微信二维码等无底部操作按钮的纯展示弹窗，补充一条仅手柄模式可见的 [B] 关闭提示栏
      if (!hasConfirm && !hasInlineCancel && !hasCornerClose && !modal.querySelector('.gamepad-modal-footer-hint')) {
        const footerHint = document.createElement('div');
        footerHint.className = 'gamepad-modal-footer-hint';
        footerHint.innerHTML = `${GamepadIcons.render('CANCEL', this.profile.id, 'sm')}<span>关闭</span>`;
        const wrapper = modal.querySelector('.modal-content-wrapper') || modal;
        wrapper.appendChild(footerHint);
      }
    }

    /* ========================================================================
     * 导航栏 LB/RB 提示与全局动态游戏 HUD
     * ======================================================================== */
    syncBumperBadges() {
      document.querySelectorAll('.gamepad-bumper-hint[data-bumper="lb"]').forEach((el) => {
        el.innerHTML = GamepadIcons.render('NAV_PREV', this.profile.id, 'sm');
      });
      document.querySelectorAll('.gamepad-bumper-hint[data-bumper="rb"]').forEach((el) => {
        el.innerHTML = GamepadIcons.render('NAV_NEXT', this.profile.id, 'sm');
      });
    }

    flashBumperHint(side) {
      document.querySelectorAll(`.gamepad-bumper-hint[data-bumper="${side}"]`).forEach((el) => {
        el.classList.remove('is-pressed');
        void el.offsetWidth;
        el.classList.add('is-pressed');
        setTimeout(() => el.classList.remove('is-pressed'), 180);
      });
    }

    createHud() {
      if (document.getElementById('gamepadHud')) {
        this.hudEl = document.getElementById('gamepadHud');
        return;
      }
      const hud = document.createElement('div');
      hud.id = 'gamepadHud';
      hud.className = 'gamepad-hud';
      hud.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hud);
      this.hudEl = hud;
    }

    getContextHints() {
      // 1. 图片预览
      if (document.body.classList.contains('viewer-open')) {
        return [
          { action: 'NAV_PREV', label: '上一张' },
          { action: 'NAV_NEXT', label: '下一张' },
          { action: 'CONFIRM', label: '原图缩放' },
          { action: 'CANCEL', label: '退出预览' }
        ];
      }

      // 2. 下拉选择框展开
      if (document.querySelector('.custom-select-wrapper.open')) {
        return [
          { action: 'DPAD', label: '选择' },
          { action: 'CONFIRM', label: '确认' },
          { action: 'CANCEL', label: '取消' }
        ];
      }

      // 3. 顶层 GlobalModal 弹窗
      const topLayer = this.getTopModalLayer();
      if (topLayer && topLayer.modal) {
        const m = topLayer.modal;
        if (m.classList.contains('ios-alert')) {
          return [
            { action: 'CONFIRM', label: '确认' },
            { action: 'CANCEL', label: '取消' }
          ];
        }
        if (m.classList.contains('blog-modal') && m.classList.contains('has-group-tabs')) {
          return [
            { action: 'NAV_PREV', label: '切标签' },
            { action: 'RS', label: '滚动' },
            { action: 'CANCEL', label: '关闭弹窗' }
          ];
        }
        if (m.classList.contains('web-modal')) {
          const isFull = m.classList.contains('fullscreen-mode');
          return [
            { action: 'ACTION_X', label: isFull ? '退出全屏' : '全屏' },
            { action: 'RS', label: '滚动' },
            { action: 'CANCEL', label: isFull ? '退出全屏' : '关闭弹窗' }
          ];
        }
        return [
          { action: 'CONFIRM', label: '选择' },
          { action: 'RS', label: '滚动' },
          { action: 'CANCEL', label: '关闭弹窗' }
        ];
      }

      // 4. 导航栏下拉菜单展开（区分焦点是否在多任务项上）
      if (
        document.querySelector('.more-dropdown.show') ||
        document.querySelector('.notify-dropdown.show') ||
        document.querySelector('.bottom-nav.menu-open')
      ) {
        const onTaskItem = Boolean(
          this.currentFocusEl && this.currentFocusEl.closest('.nav-task-item, .mobile-nav-task-item')
        );
        if (onTaskItem) {
          return [
            { action: 'CONFIRM', label: '恢复任务' },
            { action: 'ACTION_X', label: '关闭任务' },
            { action: 'CANCEL', label: '关闭菜单' }
          ];
        }
        return [
          { action: 'DPAD', label: '选择' },
          { action: 'CONFIRM', label: '打开' },
          { action: 'CANCEL', label: '关闭菜单' }
        ];
      }

      // 5. 博客正文阅读态
      if (document.body.id === 'blog-page') {
        const postView = document.getElementById('postView');
        if (postView && window.getComputedStyle(postView).display !== 'none') {
          return [
            { action: 'RS', label: '滚动阅读' },
            { action: 'CANCEL', label: '返回列表' },
            { action: 'MENU', label: '更多' }
          ];
        }
      }

      // 6. 常规页面态（Select 通知 / Start 更多 / Y 设置）
      return [
        { action: 'CONFIRM', label: '确认' },
        { action: 'NAV_PREV', label: '切页' },
        { action: 'NAV_NEXT', label: '' },
        { action: 'RS', label: '滚动' },
        { action: 'VIEW', label: '通知' },
        { action: 'MENU', label: '更多' }
      ];
    }

    refreshHud(force = false) {
      if (!this.hudEl) return;
      const hints = this.getContextHints();
      const sig = `${this.profile.id}:${hints.map((h) => `${h.action}=${h.label}`).join('|')}`;
      if (!force && sig === this.lastHudSignature) return;
      this.lastHudSignature = sig;

      const html = hints
        .map((item) => {
          const icon = GamepadIcons.render(item.action, this.profile.id, 'sm');
          const text = item.label ? `<span class="gamepad-hud-label">${item.label}</span>` : '';
          return `<span class="gamepad-hud-item">${icon}${text}</span>`;
        })
        .join('');

      this.hudEl.innerHTML = html;
    }

    onPageNavigated() {
      this.focusStack = [];
      this.syncBumperBadges();
      if (this.isGamepadMode) {
        setTimeout(() => {
          this.ensureValidFocus();
          this.refreshHud(true);
        }, 120);
      }
    }

    vibrate(duration = 20, weak = 0.15, strong = 0.1) {
      try {
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = this.activeGamepadIndex !== null ? gps[this.activeGamepadIndex] : null;
        if (gp && gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
          gp.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration,
            weakMagnitude: weak,
            strongMagnitude: strong
          }).catch(() => {});
        }
      } catch (err) {}
    }
  }

  function bootstrapGamepad() {
    if (!window.SatinGamepad) {
      window.SatinGamepad = new GamepadManager();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapGamepad, { once: true });
  } else {
    bootstrapGamepad();
  }
})();
