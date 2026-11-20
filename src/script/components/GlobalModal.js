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

class GlobalModal extends HTMLElement {
  constructor() {
    super();
    // 弹窗图层栈：统一管理所有叠加图层
    this.layers = [];
    // 存储触发动画的源元素
    this.pendingTrigger = null;

    // 滚动锁定状态
    this.isScrollLocked = false;

    // 最小化后的多任务队列（最多保留 3 个任务）
    this.minimizedTasks = [];
    this.maxMinimizedTasks = 3;
    this.taskCounter = 0;

    // 后台图片组（内部始终保持图片组结构，按最近打开时间顺序排列）
    this.imageGroupItems = [];
    this.activeImageViewer = null;
    this._lastDisplayedTaskIds = [];
  }

  connectedCallback() {
    this.innerHTML = '';
    this.bindEvents();
  }

  renderStructure() {}

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      // 按 Escape 键时，如果图片查看器正在显示则跳过；如果最顶层弹窗正处于全屏模式，优先退出全屏；否则关闭弹窗
      if (e.key === 'Escape') {
        if (document.body && document.body.classList.contains('viewer-open')) return;
        const activeLayers = this.layers.filter(l => !l.isClosing);
        if (activeLayers.length === 0) return;
        const topLayer = activeLayers[activeLayers.length - 1];
        if (topLayer.modal && topLayer.modal.classList.contains('fullscreen-mode')) {
          const zoomBtn = topLayer.modal.querySelector('#docZoomBtn');
          if (zoomBtn) {
            zoomBtn.click();
            return;
          }
        }
        topLayer.close();
      }
    });
  }

  // === 内部辅助：锁定/解锁页面滚动 ===
  _lockScroll() {
    // 避免重复锁定
    if (this.isScrollLocked) return;

    // 计算滚动条宽度 (窗口总宽 - 视口宽)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // 补偿页面抖动：给 body 添加右内边距
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.documentElement.style.setProperty('--scrollbar-compensate', `${scrollbarWidth}px`);
    }
    
    // 同时锁定 html 和 body
    // 只锁定 body 在部分浏览器/CSS重置下无效
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    
    // 移动端防止滚动穿透 (Overscroll Behavior)
    document.body.style.overscrollBehavior = 'none';

    this.isScrollLocked = true;
  }

  _unlockScroll() {
    if (!this.isScrollLocked) return;

    // 如果当前有 Viewer 仍然处于打开状态，保留锁定与滚动条补偿
    const isViewerOpen = document.body && document.body.classList.contains('viewer-open');
    if (!isViewerOpen) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.removeProperty('--scrollbar-compensate');
    }
    
    this.isScrollLocked = false;
  }

  // === 核心接口：设置触发源 ===
  // 使用方法：document.getElementById('globalModal').with(this).email()
  with(element) {
    this.pendingTrigger = element;
    // 防止链式调用异常中断导致触发源残留到下一次无关弹窗
    setTimeout(() => {
      if (this.pendingTrigger === element) {
        this.pendingTrigger = null;
      }
    }, 0);
    return this; // 返回 this 实现链式调用
  }

  // ==========================================
  // 统一底层引擎：开启独立弹窗图层
  // ==========================================
  open({
    className = 'modal',
    content = '',
    onMount = null,
    minimizable = false,
    taskMeta = null,
    startMinimized = false,
    skipMerge = false,
    skipRebalance = false,
    insertIndex = -1
  }) {
    const multitaskEnabled = typeof window.isMultitaskEnabled === 'function' ? window.isMultitaskEnabled() : true;
    if (startMinimized && !multitaskEnabled) {
      this.showToast('请前往设置中开启多任务管理');
      return null;
    }

    const taskKey = taskMeta && taskMeta.key ? String(taskMeta.key) : null;
    const targetType = (taskMeta && taskMeta.type) || 'modal';
    if (startMinimized && taskKey) {
      const existing = this._findExistingMinimizedTask(targetType, taskKey);
      if (existing) {
        existing.evictedOnStart = false;
        existing.mergedIntoGroup = false;
        existing.lastActiveAt = Date.now();
        if (existing.taskType !== 'blog-group') {
          if (taskMeta.title) existing.taskTitle = taskMeta.title;
          if (taskMeta.subtitle !== undefined) existing.taskSubtitle = taskMeta.subtitle;
        }
        if (typeof existing._onUpdateTask === 'function') {
          existing._onUpdateTask(taskMeta);
        }
        this._notifyTasksChanged();
        return existing;
      }
    }

    let evictedOnStart = false;
    let mergedIntoGroup = false;
    let mergeReplacedIds = [];
    if (startMinimized && !skipMerge && this.minimizedTasks.length >= this.maxMinimizedTasks) {
      const incomingStates = (targetType === 'blog' || targetType === 'blog-group')
        ? this._normalizeBlogStates(taskMeta)
        : null;
      const mergeRes = this._tryMergeBlogsForIncoming(targetType, incomingStates);
      if (mergeRes.handled) {
        mergedIntoGroup = true;
        mergeReplacedIds = mergeRes.replacedIds || [];
        if (mergeRes.absorbed && mergeRes.groupLayer) {
          mergeRes.groupLayer.evictedOnStart = false;
          mergeRes.groupLayer.mergedIntoGroup = true;
          this._notifyTasksChanged(mergeReplacedIds);
          return mergeRes.groupLayer;
        }
      } else {
        while (this.minimizedTasks.length >= this.maxMinimizedTasks) {
          this._evictOneTaskForSpace();
          evictedOnStart = true;
        }
        if (evictedOnStart) {
          this.showToast(`多任务最多保留 ${this.maxMinimizedTasks} 个，已自动关闭最早的任务`);
        }
      }
    }

    const trigger = startMinimized ? null : this.pendingTrigger;
    if (!startMinimized) this.pendingTrigger = null; // 消费触发源

    // 计算当前层级 z-index，保证新弹窗始终覆盖在旧弹窗上方
    const baseZ = 9980 + this.layers.length * 10;
    const taskId = `modal-task-${++this.taskCounter}`;

    // 1. 构建独立图层 DOM
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.zIndex = baseZ;

    const modal = document.createElement('div');
    modal.className = className;
    modal.style.zIndex = baseZ + 1;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'modal-content-wrapper';
    if (typeof content === 'string') {
      contentWrapper.innerHTML = content;
    } else if (content instanceof Node) {
      contentWrapper.appendChild(content);
    }
    modal.appendChild(contentWrapper);

    this.appendChild(overlay);
    this.appendChild(modal);

    let cleanupTimer = null;
    let minimizeTimer = null;
    let audioInstance = null;
    let destroyCallback = null;
    let hasBeenMinimized = false;

    // 2. 清理状态并从 DOM 中移除图层
    const destroyLayer = () => {
      clearTimeout(cleanupTimer);
      clearTimeout(minimizeTimer);
      if (typeof destroyCallback === 'function') {
        try { destroyCallback(); } catch (e) {}
        destroyCallback = null;
      }
      overlay.remove();
      modal.remove();
      this.layers = this.layers.filter(l => l !== layer);
      this.minimizedTasks = this.minimizedTasks.filter(l => l !== layer);
      // 当所有可见弹窗全部关闭后，恢复页面滚动
      if (this.layers.length === 0) {
        this._unlockScroll();
      }
      if (!layer._skipNotifyOnDestroy) {
        const rebalanceReplacedIds = layer._skipRebalanceOnDestroy ? [] : this._rebalanceBlogGroups();
        this._notifyTasksChanged(rebalanceReplacedIds);
      }
    };

    // 3. 统一动画核心：关闭
    const closeLayer = (closeOpts = {}) => {
      const { immediateUnlock = false } = closeOpts || {};
      // 避免重复触发退出动画
      if (layer.isClosing) return;
      layer.isClosing = true;

      clearTimeout(minimizeTimer);

      if (audioInstance) {
        audioInstance.pause();
        audioInstance = null;
      }

      // 清除可能存在的旧定时器
      if (cleanupTimer) clearTimeout(cleanupTimer);

      // 若本身已处于最小化后台状态，直接销毁并释放内存
      if (layer.isMinimized) {
        this.minimizedTasks = this.minimizedTasks.filter(l => l !== layer);
        destroyLayer();
        return;
      }

      if (immediateUnlock) {
        this.layers = this.layers.filter(l => l !== layer);
        this.minimizedTasks = this.minimizedTasks.filter(l => l !== layer);
        if (this.layers.length === 0) {
          this._unlockScroll();
        }
        this._notifyTasksChanged();
        overlay.style.pointerEvents = 'none';
        modal.style.pointerEvents = 'none';
        overlay.classList.remove('show');
        modal.classList.remove('show');
        cleanupTimer = setTimeout(destroyLayer, 350);
        return;
      }

      // 如果没有触发源、触发源已脱离 DOM 或曾被最小化过，降级为默认关闭
      if (!trigger || !trigger.isConnected || hasBeenMinimized) {
        if (trigger && trigger.classList.contains('hero-hidden')) {
          trigger.style.opacity = '';
          trigger.classList.remove('hero-hidden');
        }
        overlay.classList.remove('show');
        modal.classList.remove('show');
        
        cleanupTimer = setTimeout(destroyLayer, 350);
        return;
      }

      // 执行反向 Hero 动画
      const modalRect = modal.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const deltaX = (triggerRect.left + triggerRect.width / 2) - (modalRect.left + modalRect.width / 2);
      const deltaY = (triggerRect.top + triggerRect.height / 2) - (modalRect.top + modalRect.height / 2);
      const scaleX = triggerRect.width / modalRect.width;
      const scaleY = triggerRect.height / modalRect.height;

      contentWrapper.style.opacity = '0';
      contentWrapper.style.transition = 'opacity 0.2s ease';
      modal.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease';
      modal.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scaleX}, ${scaleY})`;
      modal.style.opacity = '0';
      overlay.classList.remove('show');

      cleanupTimer = setTimeout(() => {
        trigger.style.opacity = '';
        trigger.classList.remove('hero-hidden');
        destroyLayer();
      }, 400);
    };

    // 4. 最小化至多任务栏（保留 DOM 与 iframe 内存不卸载）
    const minimizeLayer = () => {
      if (!layer.minimizable || layer.isClosing || layer.isMinimized) return false;

      const multitaskEnabled = typeof window.isMultitaskEnabled === 'function' ? window.isMultitaskEnabled() : true;
      if (!multitaskEnabled) {
        this.showToast('请前往设置中开启多任务管理');
        return false;
      }

      if (typeof layer._onMinimize === 'function') {
        layer._onMinimize();
      }

      clearTimeout(minimizeTimer);
      clearTimeout(cleanupTimer);

      if (trigger && trigger.classList.contains('hero-hidden')) {
        trigger.style.opacity = '';
        trigger.classList.remove('hero-hidden');
      }
      hasBeenMinimized = true;

      modal.classList.remove('hero-animating');
      modal.style.transition = '';
      modal.style.transform = '';
      modal.style.transformOrigin = '';
      contentWrapper.style.transition = '';
      contentWrapper.style.opacity = '1';

      this.layers = this.layers.filter(l => l !== layer);

      let localMergeReplacedIds = [];
      if (!this.minimizedTasks.includes(layer)) {
        if (this.minimizedTasks.length >= this.maxMinimizedTasks) {
          const incomingStates = typeof layer._getBlogStates === 'function' ? layer._getBlogStates() : null;
          const mergeRes = this._tryMergeBlogsForIncoming(layer.taskType, incomingStates);
          if (mergeRes.handled) {
            localMergeReplacedIds = mergeRes.replacedIds || [];
            if (mergeRes.absorbed) {
              if (this.layers.length === 0) this._unlockScroll();
              layer._skipRebalanceOnDestroy = true;
              layer._skipNotifyOnDestroy = true;
              layer.isClosing = true;
              overlay.classList.remove('show');
              modal.classList.remove('show');
              setTimeout(destroyLayer, 200);
              this._notifyTasksChanged(localMergeReplacedIds);
              return true;
            }
          } else {
            while (this.minimizedTasks.length >= this.maxMinimizedTasks) {
              this._evictOneTaskForSpace();
              this.showToast(`多任务最多保留 ${this.maxMinimizedTasks} 个，已自动关闭最早的任务`);
            }
          }
        }
        this.minimizedTasks.push(layer);
      }

      layer.isMinimized = true;
      layer.lastActiveAt = Date.now();

      if (this.layers.length === 0) this._unlockScroll();

      const rebalanceReplacedIds = this._rebalanceBlogGroups();
      if (!this.minimizedTasks.includes(layer) || layer.isClosing) {
        this._notifyTasksChanged([...localMergeReplacedIds, ...rebalanceReplacedIds]);
        return true;
      }

      overlay.classList.remove('show');
      modal.classList.remove('show');
      modal.classList.add('is-minimized');
      modal.setAttribute('aria-hidden', 'true');
      modal.inert = true;

      minimizeTimer = setTimeout(() => {
        if (layer.isMinimized && !layer.isClosing) {
          modal.classList.add('is-minimized-settled');
          overlay.classList.add('is-minimized-settled');
        }
      }, 380);

      this._notifyTasksChanged([...localMergeReplacedIds, ...rebalanceReplacedIds]);
      return true;
    };

    // 5. 从多任务栏恢复显示
    const restoreLayer = () => {
      if (layer.isClosing || !layer.isMinimized) return false;

      clearTimeout(minimizeTimer);
      clearTimeout(cleanupTimer);
      hasBeenMinimized = true;
      this.minimizedTasks = this.minimizedTasks.filter(l => l !== layer);

      const nextZ = 9980 + this.layers.length * 10;
      overlay.style.zIndex = nextZ;
      modal.style.zIndex = nextZ + 1;
      this.layers.push(layer);
      layer.isMinimized = false;
      layer.lastActiveAt = Date.now();
      this._lockScroll();

      modal.inert = false;
      modal.removeAttribute('aria-hidden');
      modal.classList.remove('is-minimized-settled');
      overlay.classList.remove('is-minimized-settled');

      void modal.offsetHeight;
      if (typeof layer._onRestore === 'function') {
        layer._onRestore();
      }
      modal.classList.remove('is-minimized');
      modal.classList.add('show');
      overlay.classList.add('show');

      this._notifyTasksChanged();
      return true;
    };

    const forceDestroyLayer = () => {
      layer.isClosing = true;
      if (audioInstance) {
        audioInstance.pause();
        audioInstance = null;
      }
      if (trigger && trigger.classList.contains('hero-hidden')) {
        trigger.style.opacity = '';
        trigger.classList.remove('hero-hidden');
      }
      destroyLayer();
    };

    overlay.addEventListener('click', closeLayer);

    const layer = {
      taskId,
      taskKey,
      minimizable: Boolean(minimizable),
      isMinimized: Boolean(startMinimized),
      isClosing: false,
      evictedOnStart,
      mergedIntoGroup,
      taskType: targetType,
      taskTitle: (taskMeta && taskMeta.title) || '后台窗口',
      taskSubtitle: (taskMeta && taskMeta.subtitle) || '',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      overlay,
      modal,
      content: contentWrapper,
      close: closeLayer,
      minimize: minimizeLayer,
      restore: restoreLayer,
      _forceDestroy: forceDestroyLayer,
      setAudio: (audio) => { audioInstance = audio; },
      onDestroy: (fn) => { destroyCallback = fn; },
      _onUpdateTask: null,
      _onMinimize: null,
      _onRestore: null,
      _getBlogStates: null,
      _skipRebalanceOnDestroy: false,
      _skipNotifyOnDestroy: false
    };

    if (startMinimized) {
      hasBeenMinimized = true;
      modal.classList.add('is-minimized', 'is-minimized-settled');
      overlay.classList.add('is-minimized-settled');
      modal.setAttribute('aria-hidden', 'true');
      modal.inert = true;
      if (insertIndex >= 0 && insertIndex <= this.minimizedTasks.length) {
        this.minimizedTasks.splice(insertIndex, 0, layer);
      } else {
        this.minimizedTasks.push(layer);
      }
      const rebalanceReplacedIds = skipRebalance ? [] : this._rebalanceBlogGroups();
      this._notifyTasksChanged([...mergeReplacedIds, ...rebalanceReplacedIds]);
    } else {
      this.layers.push(layer);
      
      // 锁定页面滚动
      this._lockScroll();

      // 4. 统一动画核心：显示
      // 如果没有触发源，降级为默认缩放淡入动画
      if (!trigger) {
        void modal.offsetHeight; // 强制回流，确保初始未激活状态(scale 0.9, opacity 0)被浏览器记录
        requestAnimationFrame(() => {
          overlay.classList.add('show');
          modal.classList.add('show');
        });
      } else {
        // 准备 Hero 动画
        // 记录源元素位置 (First)
        const triggerRect = trigger.getBoundingClientRect();
        
        // 临时隐藏源元素 (占位)
        trigger.style.opacity = '0';
        trigger.classList.add('hero-hidden'); // 标记类，防止冲突

        // 准备模态框状态
        overlay.classList.add('show');
        modal.classList.add('hero-animating', 'show'); // 添加动画控制类
        
        // 为了计算 Final 状态，先让模态框渲染但不可见
        modal.style.visibility = 'hidden';
        modal.style.display = 'block';

        // 获取模态框最终位置 (Last)
        const modalRect = modal.getBoundingClientRect();
        
        // 计算 Invert (差值)
        const deltaX = (triggerRect.left + triggerRect.width / 2) - (modalRect.left + modalRect.width / 2);
        const deltaY = (triggerRect.top + triggerRect.height / 2) - (modalRect.top + modalRect.height / 2);
        const scaleX = triggerRect.width / modalRect.width;
        const scaleY = triggerRect.height / modalRect.height;

        // 应用初始状态 (Start at Trigger position)
        modal.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scaleX}, ${scaleY})`;
        modal.style.transformOrigin = 'center center'; // 确保缩放中心正确
        modal.style.opacity = '1'; // 确保可见（背景色过渡）
        
        // 内容先透明，防止拉伸变形太难看
        contentWrapper.style.opacity = '0';
        contentWrapper.style.transition = 'none';

        // Play (执行动画)
        modal.style.visibility = 'visible';

        // 强制重绘
        void modal.offsetHeight;

        // 切换到动画状态
        requestAnimationFrame(() => {
          // 恢复 CSS 定义的 transition
          modal.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease, border-radius 0.4s ease';
          contentWrapper.style.transition = 'opacity 0.3s ease 0.15s'; // 内容稍微延迟显示

          // 移动到最终位置
          modal.style.transform = 'translate(-50%, -50%) scale(1)';
          modal.style.opacity = '1';
          contentWrapper.style.opacity = '1';

          // 动画完成后清除内联样式与动画标记类，使弹窗完全由 CSS 响应控制
          setTimeout(() => {
            if (!layer.isClosing) {
              modal.classList.remove('hero-animating');
              modal.style.transition = '';
              modal.style.transform = '';
              modal.style.transformOrigin = '';
              contentWrapper.style.transition = '';
            }
          }, 550);
        });
      }
    }

    if (typeof onMount === 'function') {
      onMount(layer);
    }

    return layer;
  }

  // 关闭当前最顶层未处于关闭中的弹窗
  close() {
    const activeLayer = [...this.layers].reverse().find(l => !l.isClosing);
    if (activeLayer) {
      activeLayer.close();
    }
  }

  // 关闭所有已打开的弹窗图层（默认保留已最小化任务）
  closeAll(options = {}) {
    const { includeMinimized = false } = options;
    [...this.layers].reverse().forEach(l => {
      if (!l.isClosing) l.close();
    });
    if (this.activeImageViewer && this.activeImageViewer.viewer) {
      try { this.activeImageViewer.viewer.hide(true); } catch (e) {}
    }
    if (includeMinimized) this.closeAllTasks();
  }

  _notifyTasksChanged(replacedTaskIds = [], closedTaskId = null) {
    const tasks = this.getTasks();
    const currentIds = tasks.map(t => t.taskId);
    const currentIdSet = new Set(currentIds);
    const autoReplaced = (this._lastDisplayedTaskIds || []).filter(
      id => !currentIdSet.has(id) && id !== closedTaskId && (id === 'image-group-slot' || id.startsWith('image-item-'))
    );
    const mergedReplacedIds = Array.from(new Set([
      ...(Array.isArray(replacedTaskIds) ? replacedTaskIds : []),
      ...autoReplaced
    ]));
    this._lastDisplayedTaskIds = currentIds;

    window.dispatchEvent(new CustomEvent('modal-tasks-changed', {
      detail: {
        tasks,
        replacedTaskIds: mergedReplacedIds
      }
    }));
  }

  getTasks() {
    const maxTasks = this.maxMinimizedTasks;
    const activeSlots = this.minimizedTasks.filter(l => !l.isClosing);
    const nonImageCount = activeSlots.filter(l => l.taskType !== 'image-group').length;
    const availableForImages = Math.max(0, maxTasks - nonImageCount);
    const result = [];

    activeSlots.forEach(slot => {
      if (slot.taskType !== 'image-group') {
        result.push({
          taskId: slot.taskId,
          type: slot.taskType,
          title: slot.taskTitle,
          subtitle: slot.taskSubtitle,
          lastActiveAt: slot.lastActiveAt
        });
        return;
      }

      const items = this.imageGroupItems;
      if (items.length === 0) return;

      if (items.length <= availableForImages) {
        items.forEach(item => {
          result.push({
            taskId: `image-item-${item.id}`,
            type: 'image',
            title: item.title,
            subtitle: item.width && item.height ? `图片 · ${item.width} × ${item.height}` : '图片预览',
            lastActiveAt: item.lastActiveAt
          });
        });
      } else if (availableForImages > 0) {
        result.push({
          taskId: slot.taskId,
          type: 'image-group',
          title: `图片组 (${items.length})`,
          subtitle: items.map(it => it.title).join(' · '),
          lastActiveAt: slot.lastActiveAt
        });

        const extraSlots = availableForImages - 1;
        if (extraSlots > 0) {
          const recentItems = items.slice(-extraSlots);
          recentItems.forEach(item => {
            result.push({
              taskId: `image-item-${item.id}`,
              type: 'image',
              title: item.title,
              subtitle: item.width && item.height ? `图片 · ${item.width} × ${item.height}` : '图片预览',
              lastActiveAt: item.lastActiveAt
            });
          });
        }
      }
    });

    return result.slice(0, maxTasks);
  }

  restoreTask(taskId) {
    if (taskId === 'image-group-slot') {
      return this._restoreImageGroup('group', null);
    }
    if (typeof taskId === 'string' && taskId.startsWith('image-item-')) {
      const itemId = taskId.slice('image-item-'.length);
      return this._restoreImageGroup('single', itemId);
    }
    const target = this.minimizedTasks.find(l => l.taskId === taskId && !l.isClosing);
    return target ? target.restore() : false;
  }

  closeTask(taskId) {
    if (taskId === 'image-group-slot') {
      const slot = this.minimizedTasks.find(l => l.taskType === 'image-group');
      this.imageGroupItems = [];
      if (slot) {
        this.minimizedTasks = this.minimizedTasks.filter(l => l !== slot);
      }
      const rebalanceIds = this._rebalanceBlogGroups();
      this._notifyTasksChanged(rebalanceIds, taskId);
      return true;
    }
    if (typeof taskId === 'string' && taskId.startsWith('image-item-')) {
      const itemId = taskId.slice('image-item-'.length);
      const prevLen = this.imageGroupItems.length;
      this.imageGroupItems = this.imageGroupItems.filter(it => it.id !== itemId);
      if (this.imageGroupItems.length === prevLen) return false;
      if (this.imageGroupItems.length === 0) {
        this.minimizedTasks = this.minimizedTasks.filter(l => l.taskType !== 'image-group');
      }
      const rebalanceIds = this._rebalanceBlogGroups();
      this._notifyTasksChanged(rebalanceIds, taskId);
      return true;
    }
    const target = this.minimizedTasks.find(l => l.taskId === taskId);
    if (target) {
      target.close();
      return true;
    }
    return false;
  }

  closeAllTasks() {
    if (this.activeImageViewer && this.activeImageViewer.viewer) {
      try { this.activeImageViewer.viewer.hide(true); } catch (e) {}
    }
    this.imageGroupItems = [];
    if (this.minimizedTasks.length === 0) {
      this._notifyTasksChanged();
      return;
    }
    [...this.minimizedTasks].forEach(l => {
      l._skipRebalanceOnDestroy = true;
      l._skipNotifyOnDestroy = true;
      l._forceDestroy();
    });
    this.minimizedTasks = [];
    this._notifyTasksChanged();
  }

  // ==========================================
  // iOS 风格跳转提示
  // ==========================================
  alert(message, url, appUrl = null) {
    this.open({
      className: 'modal ios-alert',
      // 渲染内容
      content: `
        <p>${message}</p>
        <div class="actions">
          <button class="cancel" id="modalCancel">取消</button>
          <button class="confirm" id="modalConfirm">确定</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        // 绑定按钮事件
        modal.querySelector('#modalCancel').onclick = close;
        modal.querySelector('#modalConfirm').onclick = () => {
          // 存储跳转逻辑
          if (this.isMobileDevice() && appUrl) {
            this.tryOpenApp(url, appUrl, close);
          } else {
            window.open(url, "_blank");
            close();
          }
        };
      }
    });
  }

  // ==========================================
  // 通用确认操作
  // ==========================================
  confirmAction(message, onConfirm, confirmBtnText = '确认') {
    this.open({
      className: 'modal ios-alert',
      // 使用 pre-line 保留换行符，并设置危险操作的红色按钮
      content: `
        <p style="white-space: pre-line;">${message}</p>
        <div class="actions">
          <button class="cancel" id="modalCancel">取消</button>
          <button class="confirm" id="modalConfirm" style="color: #ff3b30; font-weight: 600;">${confirmBtnText}</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        // 绑定按钮事件
        modal.querySelector('#modalCancel').onclick = close;
        modal.querySelector('#modalConfirm').onclick = () => {
          if (onConfirm) onConfirm();
          close();
        };
      }
    });
  }

  // ==========================================
  // 微信二维码
  // ==========================================
  wechat() {
    this.open({
      className: 'modal wechat-qr',
      content: `
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https://u.wechat.com/MASBAq1qageU9c51LoYg2-Q?s=2" alt="WeChat QR">
        <p>微信扫码加我</p>
      `
    });
  }

  // ==========================================
  // 邮箱列表
  // ==========================================
  email() {
    this.open({
      className: 'modal', // 使用默认样式
      // 注意：这里复用了 style.css 中的 .email-list 样式
      content: `
        <p style="margin-bottom:12px; font-weight:600;">邮箱地址</p>
        <div class="email-list">
          ${this.renderEmailItem('zelynn@satinau.cn')}
          ${this.renderEmailItem('contact@satinau.cn')}
        </div>
        <div class="actions" style="margin-top:16px;">
          <button class="cancel" id="modalClose" style="width:100%">关闭</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        // 绑定关闭按钮
        modal.querySelector('#modalClose').onclick = close;
        
        // 绑定复制按钮事件 (使用事件委托或直接绑定)
        modal.querySelectorAll('.copy-btn').forEach(btn => {
          btn.onclick = (e) => this.copyToClipboard(e.target.dataset.email);
        });
      }
    });
  }

  renderEmailItem(email) {
    return `
      <div class="email-item">
        <span>${email}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <a href="mailto:${email}" style="font-size: 14px; text-decoration: none; color: inherit; opacity: 0.8;">打开</a>
          <button class="copy-btn" data-email="${email}">复制</button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // 通用网页/Iframe 弹窗
  // ==========================================
  openWeb(url, languageSelector = null, customTitle = null) {
    const languageSelectorMarkup = languageSelector
      ? `
        <div class="web-modal-language">
          <div class="custom-select-wrapper" id="webModalLanguageSelect">
            <div class="custom-select-trigger" tabindex="0">
              <span class="selected-value"></span>
              <div class="arrow"></div>
            </div>
            <div class="custom-options">
              ${languageSelector.options.map(option => `
                <div class="custom-option${option.value === languageSelector.defaultValue ? ' selected' : ''}" data-value="${option.value}">${option.label}</div>
              `).join('')}
            </div>
          </div>
        </div>
      `
      : '';

    const initialUrl = new URL(url, window.location.href);
    const deriveTaskTitle = (urlObj, explicitTitle = null) => {
      if (explicitTitle && String(explicitTitle).trim()) return String(explicitTitle).trim();
      const pathMap = {
        '/pages/help/agreement.html': '用户协议',
        '/pages/help/privacy.html': '隐私政策',
        '/pages/help/compatibility.html': '兼容性报告'
      };
      const cleanPath = (urlObj.pathname || '').replace(/\/+$/, '');
      if (urlObj.origin === window.location.origin) {
        if (pathMap[cleanPath]) return pathMap[cleanPath];
        const parts = cleanPath.split('/').filter(Boolean);
        const last = parts.pop() || '';
        const name = last.replace(/\.html?$/i, '');
        if (name && name.toLowerCase() !== 'index') {
          try { return decodeURIComponent(name); } catch (e) { return name; }
        }
        if (parts.length > 0) {
          try { return decodeURIComponent(parts.pop()); } catch (e) { return parts.pop(); }
        }
        return '网页窗口';
      }
      return urlObj.hostname || '网页窗口';
    };
    const getTaskSubtitle = (urlObj) => urlObj.origin === window.location.origin
      ? urlObj.pathname + urlObj.search
      : urlObj.hostname + urlObj.pathname;

    this.open({
      className: 'modal web-modal',
      minimizable: true,
      taskMeta: {
        type: 'web',
        title: deriveTaskTitle(initialUrl, customTitle),
        subtitle: getTaskSubtitle(initialUrl)
      },
      // 渲染内容
      content: `
        <div class="web-modal-titlebar">
          ${languageSelectorMarkup}
          <button id="webModalAddress" class="web-modal-address" type="button" aria-label="复制网页地址"></button>
          <div class="web-modal-actions">
            <button id="docMinimizeBtn" class="web-modal-action web-modal-minimize" type="button" title="最小化 / Minimize" aria-label="最小化">
              <svg viewBox="0 0 24 24"><path d="M5 11h14v2H5z"/></svg>
            </button>
            <button id="docZoomBtn" class="web-modal-action" type="button" title="全屏查看 / Fullscreen" aria-label="全屏查看">
              <svg id="icon-expand" viewBox="0 0 24 24"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/></svg>
              <svg id="icon-compress" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5z"/></svg>
            </button>
            <button id="docCloseBtn" class="web-modal-action web-modal-close" type="button" title="关闭 / Close" aria-label="关闭">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
        <div class="doc-container">
          <div class="loading-overlay show" id="webLoadingOverlay">
            <div class="spinner"></div>
          </div>
          <iframe id="webFrame" src="${url}" title="Web Content" allowfullscreen></iframe>
        </div>
      `,
      onMount: (layer) => {
        const { modal, close } = layer;
        // 绑定事件
        const minimizeBtn = modal.querySelector('#docMinimizeBtn');
        const zoomBtn = modal.querySelector('#docZoomBtn');
        const closeBtn = modal.querySelector('#docCloseBtn');
        const addressBtn = modal.querySelector('#webModalAddress');
        const webFrame = modal.querySelector('#webFrame');
        const loadingOverlay = modal.querySelector('#webLoadingOverlay');
        let pageUrl = initialUrl;

        const updateAddress = () => {
          addressBtn.textContent = pageUrl.href;
          addressBtn.title = `点击复制：${pageUrl.href}`;
          layer.taskSubtitle = getTaskSubtitle(pageUrl);
          if (!customTitle) layer.taskTitle = deriveTaskTitle(pageUrl, null);
          if (layer.isMinimized) this._notifyTasksChanged();
        };
        updateAddress();

        addressBtn.onclick = () => this.copyToClipboard(pageUrl.href);
        if (minimizeBtn) minimizeBtn.onclick = () => layer.minimize();

        const languageWrapper = modal.querySelector('#webModalLanguageSelect');
        if (languageWrapper && typeof initCustomSelect === 'function') {
          initCustomSelect(languageWrapper, null, (language) => {
            const option = languageSelector.options.find(item => item.value === language);
            webFrame.src = option.url;
            pageUrl = new URL(option.url, window.location.href);
            updateAddress();
          }, languageSelector.defaultValue);
        }

        // 监听 iframe 加载完成
        if (webFrame && loadingOverlay) {
          webFrame.addEventListener('load', () => {
            loadingOverlay.classList.remove('show');
            setTimeout(() => loadingOverlay.remove(), 300);
            if (!customTitle) {
              try {
                const docTitle = webFrame.contentDocument && webFrame.contentDocument.title;
                if (docTitle && docTitle.trim()) {
                  layer.taskTitle = docTitle.trim();
                  if (layer.isMinimized) this._notifyTasksChanged();
                }
              } catch (e) {}
            }
          });
        }

        // 关闭逻辑：直接优雅关闭，无需延时割裂动画
        closeBtn.onclick = () => {
          close();
        };

        // 全屏/最大化切换逻辑（防抖与平滑过渡）
        let isResizing = false;
        zoomBtn.onclick = () => {
          if (isResizing) return;
          isResizing = true;

          // 清理任何残留的内联动画样式，确保由 CSS 接管平滑尺寸过渡
          modal.classList.remove('hero-animating');
          modal.style.transition = '';
          modal.style.transform = '';

          modal.classList.add('is-resizing');
          const isFullscreen = modal.classList.toggle('fullscreen-mode');
          zoomBtn.title = isFullscreen ? "退出全屏 / Exit Fullscreen" : "全屏查看 / Fullscreen";
          zoomBtn.setAttribute('aria-label', isFullscreen ? '退出全屏' : '全屏查看');

          setTimeout(() => {
            modal.classList.remove('is-resizing');
            isResizing = false;
          }, 450);
        };
      }
    });
  }

  // ==========================================
  // 网站设置大型浮窗
  // ==========================================
  showSettings(anchorId = null) {
    // 检查当前是否已打开设置弹窗，若已存在则直接滚动到目标锚点，避免新建图层
    const existingLayer = this.layers.find(l => !l.isClosing && l.modal.classList.contains('settings-modal'));
    if (existingLayer) {
      this.pendingTrigger = null;
      if (anchorId) {
        const target = existingLayer.modal.querySelector(`#${anchorId}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.transition = 'box-shadow 0.3s ease';
          target.style.boxShadow = '0 0 0 2px var(--primary-color)';
          setTimeout(() => { target.style.boxShadow = ''; }, 1500);
        }
      }
      return;
    }

    this.open({
      className: 'modal settings-modal',
      onMount: (layer) => {
        const context = {
          modal: layer.modal,
          content: layer.content,
          close: layer.close,
          show: () => {
            layer.modal.classList.add('show');
          },
          querySelector: (s) => layer.modal.querySelector(s),
          querySelectorAll: (s) => layer.modal.querySelectorAll(s),
          openWeb: (...args) => this.openWeb(...args),
          showToast: (msg) => this.showToast(msg),
          confirmAction: (msg, onConfirm, text) => this.confirmAction(msg, onConfirm, text),
          with: (el) => this.with(el)
        };

        const mount = () => {
          window.mountSettingsToModal(context, anchorId);
        };

        if (typeof window.mountSettingsToModal === 'function') {
          mount();
          return;
        }

        const scriptId = 'settings-modal-script';
        let script = document.getElementById(scriptId);
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.src = '/src/script/components/SettingsModal.js';
          script.onload = mount;
          script.onerror = () => {
            layer.content.innerHTML = `<p style="padding:20px;">设置组件加载失败，请检查网络</p>`;
            setTimeout(layer.close, 2000);
          };
          document.head.appendChild(script);
        } else {
          script.addEventListener('load', mount, { once: true });
        }
      }
    });
  }

  // ==========================================
  // 壁纸弹窗
  // ==========================================
  showWallpaper() {
    this.open({
      className: 'modal ios-alert',
      content: `
        <div style="padding: 10px 0;">
          <h2 style="margin: 0 0 10px; font-size: 20px; opacity: 1">壁纸</h2>
          <p style="font-size: 15px; color: var(--word-color); opacity: 0.8; margin-bottom: 0;">敬请期待</p>
        </div>
        <div class="actions">
          <button class="cancel" id="modalClose">关闭</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        modal.querySelector('#modalClose').onclick = close;
      }
    });
  }

  // ==========================================
  // 装扮弹窗
  // ==========================================
  showDecoration() {
    this.open({
      className: 'modal ios-alert',
      content: `
        <div style="padding: 10px 0;">
          <h2 style="margin: 0 0 15px; font-size: 20px; opacity: 1">装扮</h2>
          <a href="https://club.vip.qq.com/openKuikly/vas_gxh_dress_detail?open_kuikly_info=%7B%22bundle_name%22%3A%22vas_gxh_dress_detail%22%7D&qqmc_config=vas_kuikly_config&page_name=vas_gxh_dress_detail&from=share&kr_turbo_display=2_2144217&app_id=2&item_id=2144217" target="_blank" style="display: block; margin-bottom: 10px;">
            <img src="/public/qqbubble.png" alt="QQ气泡" style="width: 100%; border-radius: var(--border-radius-md); box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: transform 0.2s ease; background: light-dark(#f5f5f5, #111);" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
          </a>
          <p style="font-size: 15px; color: var(--word-color); opacity: 0.8; margin: 0;">敬请期待</p>
        </div>
        <div class="actions">
          <button class="cancel" id="modalClose">关闭</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        modal.querySelector('#modalClose').onclick = close;
      }
    });
  }

  // ==========================================
  // 整点报时
  // ==========================================
  showChime(hour) {
    // 格式化时间显示
    const displayHour = hour < 10 ? `0${hour}` : hour;

    this.open({
      className: 'modal ios-alert chime-modal',
      content: `
        <div style="padding: 10px 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">🕰️</div>
          <h2 style="margin: 0 0 10px; font-size: 24px;">整点报时</h2>
          <p style="font-size: 18px; font-weight: bold; color: var(--primary-color);">
            现在是 ${displayHour}:00
          </p>
          <p style="font-size: 14px; opacity: 0.7; margin-top:10px;">Westminster Quarters</p>
        </div>
        <div class="actions">
          <button class="cancel" id="modalClose">关闭</button>
        </div>
      `,
      onMount: ({ modal, close, setAudio }) => {
        // 绑定关闭按钮
        modal.querySelector('#modalClose').onclick = close;
        
        // 初始化音频
        try {
          const audio = new Audio('/public/Westminster.ogg');
          setAudio(audio);
          audio.addEventListener('ended', close);
          audio.play().catch(e => {
            console.warn("自动播放被浏览器拦截，用户需先与页面交互:", e);
            this.showToast("未能播放报时音效（需先点击页面）");
          });
        } catch (err) {
          console.error("音频加载失败", err);
        }
      }
    });
  }

  // ==========================================
  // CDN 线路优选与选择弹窗
  // ==========================================
  showCdnSelector() {
    const currentMode = localStorage.getItem('setting_cdn_source') || 'auto';

    const getBadgeHtml = (latency) => {
      if (latency === null) return `<span class="cdn-latency-badge">测速中...</span>`;
      if (latency <= 0) return `<span class="cdn-latency-badge slow">超时</span>`;
      const level = latency < 120 ? 'fast' : (latency < 280 ? 'medium' : 'slow');
      return `<span class="cdn-latency-badge ${level}">${latency} ms</span>`;
    };

    const getAutoCurrentText = () => {
      const picked = localStorage.getItem('setting_cdn_auto_picked') || 'cf';
      return picked === 'eo' ? '线路二' : '线路一';
    };

    this.open({
      className: 'modal cdn-modal',
      content: `
        <div class="cdn-modal-title">静态资源线路</div>
        <p class="cdn-modal-desc">测速并选择图片与资源下载源，下次加载或刷新时生效</p>

        <div class="cdn-option-list">
          <div class="cdn-option-item ${currentMode === 'auto' ? 'active' : ''}" data-value="auto">
            <span class="cdn-option-name">自动</span>
            <div id="cdnPingAuto"><span class="cdn-current-badge">${getAutoCurrentText()}</span></div>
          </div>

          <div class="cdn-option-item ${currentMode === 'cf' ? 'active' : ''}" data-value="cf">
            <span class="cdn-option-name">线路一 (Cloudflare)</span>
            <div id="cdnPingCf">${getBadgeHtml(window.cdnLatencies.cf)}</div>
          </div>

          <div class="cdn-option-item ${currentMode === 'eo' ? 'active' : ''}" data-value="eo">
            <span class="cdn-option-name">线路二 (EdgeOne)</span>
            <div id="cdnPingEo">${getBadgeHtml(window.cdnLatencies.eo)}</div>
          </div>
        </div>

        <div class="actions">
          <button class="cancel" id="modalCdnClose" style="width:100%;">关闭</button>
        </div>
      `,
      onMount: ({ modal, close }) => {
        modal.querySelector('#modalCdnClose').onclick = close;

        // 监听测速结果更新，刷新弹窗内的延迟数据显示与自动优选结果
        const updatePings = () => {
          const autoBadge = modal.querySelector('#cdnPingAuto');
          const cfBadge = modal.querySelector('#cdnPingCf');
          const eoBadge = modal.querySelector('#cdnPingEo');
          if (autoBadge) autoBadge.innerHTML = `<span class="cdn-current-badge">${getAutoCurrentText()}</span>`;
          if (cfBadge) cfBadge.innerHTML = getBadgeHtml(window.cdnLatencies.cf);
          if (eoBadge) eoBadge.innerHTML = getBadgeHtml(window.cdnLatencies.eo);
        };

        window.addEventListener('cdn-ping-updated', updatePings);
        if (typeof window.detectCdnLatencies === 'function') {
          window.detectCdnLatencies();
        }

        // 绑定点击切换逻辑
        modal.querySelectorAll('.cdn-option-item').forEach(item => {
          item.onclick = () => {
            const val = item.dataset.value;
            localStorage.setItem('setting_cdn_source', val);

            const nameMap = {
              'auto': '自动优选',
              'cf': '线路一 (Cloudflare)',
              'eo': '线路二 (EdgeOne)'
            };

            this.showToast(`已切换为：${nameMap[val]}，即将刷新应用...`);
            close();
            setTimeout(() => location.reload(), 800);
          };
        });
      }
    });
  }

  // ==========================================
  // 分享文章卡片
  // ==========================================
  async share(title, excerpt, url, date) {
    // 1. 显示加载中
    const layer = this.open({
      className: 'modal share-modal',
      content: `
        <div class="share-loading-state">
          <div class="ai-loading-spinner"></div>
          <p style="margin: 0; font-size: 14px; color: var(--word-color);">正在生成分享卡片...</p>
        </div>
      `
    });

    // 2. 创建用于生成的 DOM 结构（保留原有图片内容结构）
    const oldContainer = document.getElementById('share-card-container');
    if (oldContainer) oldContainer.remove();

    const container = document.createElement('div');
    container.id = 'share-card-container';

    const safeTitle = (title || '未命名文章').trim();
    const safeDate = (date || '').trim();
    const rawExcerpt = (excerpt || '').replace(/\s+/g, ' ').trim();
    const cleanExcerpt = rawExcerpt.length > 120
      ? rawExcerpt.substring(0, 120) + '...'
      : (rawExcerpt ? rawExcerpt + '...' : safeTitle);

    const fullUrl = url && url.startsWith('http') ? url : window.location.origin + (url || window.location.pathname);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullUrl)}`;

    container.innerHTML = `
      <div class="share-card-title"></div>
      <div class="share-card-date"></div>
      <div class="share-card-excerpt"></div>
      <div class="share-card-footer">
        <div class="share-info">
          <span class="share-site-name">缎金SatinAu</span>
          <span class="share-site-url">satinau.cn</span>
        </div>
        <div class="share-qr">
          <img crossOrigin="anonymous" alt="QR">
        </div>
      </div>
    `;

    container.querySelector('.share-card-title').textContent = safeTitle;
    container.querySelector('.share-card-date').textContent = safeDate;
    container.querySelector('.share-card-excerpt').textContent = cleanExcerpt;
    document.body.appendChild(container);

    try {
      // 3. 等待二维码图片加载完成（加入超时保护防止卡死）
      const qrImg = container.querySelector('.share-qr img');
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 4000);
        qrImg.onload = () => { clearTimeout(timer); resolve(); };
        qrImg.onerror = () => { clearTimeout(timer); resolve(); };
        qrImg.src = qrUrl;
        if (qrImg.complete && qrImg.naturalWidth > 0) {
          clearTimeout(timer);
          resolve();
        }
      });

      // 4. 使用 html2canvas 生成高清图片（锁定 375px 宽度并归零滚动偏移，避免页面滚动导致裁切或尺寸异常）
      if (!window.html2canvas) throw new Error("组件未加载");

      const canvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        width: 375,
        windowWidth: 375,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        backgroundColor: '#ffffff'
      });

      // 转换为 Blob URL，使自定义右键菜单和浏览器原生菜单均可识别、新标签页打开并下载
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const imgUrl = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');

      if (blob && typeof layer.onDestroy === 'function') {
        layer.onDestroy(() => URL.revokeObjectURL(imgUrl));
      }

      // 预解码生成的图片，确保插入弹窗时尺寸一步到位
      await new Promise((resolve) => {
        const preImg = new Image();
        preImg.onload = resolve;
        preImg.onerror = resolve;
        preImg.src = imgUrl;
      });

      if (layer.isClosing) return;

      const fileSafeTitle = safeTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50) || '文章分享';
      const downloadFileName = `缎金SatinAu-${fileSafeTitle}.png`;

      // 5. 更新弹窗内容
      layer.content.innerHTML = `
        <img src="${imgUrl}" class="generated-share-img" alt="Share Card" data-download-name="${downloadFileName}">
        <p class="share-tip-text">右键或长按图片可保存，也可使用下方按钮</p>
        <div class="share-actions">
          <button id="shareDownloadImg" class="primary-btn" type="button">保存图片</button>
          <button id="shareCopyLink" class="secondary-btn" type="button">复制链接</button>
          <button id="shareClose" class="cancel-btn" type="button">关闭</button>
        </div>
      `;

      // 绑定按钮事件
      layer.modal.querySelector('#shareClose').onclick = layer.close;
      layer.modal.querySelector('#shareCopyLink').onclick = () => {
        this.copyToClipboard(fullUrl);
      };
      layer.modal.querySelector('#shareDownloadImg').onclick = () => {
        const a = document.createElement('a');
        a.href = imgUrl;
        a.download = downloadFileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showToast('💾 已开始下载分享卡片');
      };

    } catch (err) {
      console.error("生成分享图失败:", err);
      if (!layer.isClosing) {
        layer.content.innerHTML = `<p style="padding:20px; margin:0;">生成失败，请刷新重试</p>`;
        setTimeout(layer.close, 2000);
      }
    } finally {
      // 清理临时 DOM
      container.remove();
    }
  }

  // === 辅助逻辑 ===
  
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  tryOpenApp(webUrl, appUrl, closeCallback = null) {
    // 尝试打开APP
    this.showToast("尝试打开APP...");
    window.location.href = appUrl;
    
    // 2秒后如果没反应则跳转网页
    setTimeout(() => {
      window.open(webUrl, "_blank");
      if (typeof closeCallback === 'function') {
        closeCallback();
      } else {
        this.close();
      }
    }, 2000);
  }

  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast("📋 已复制: " + text);
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      this.showToast("📋 已复制: " + text);
    } catch (err) {
      alert("复制失败，请手动复制");
    }
    document.body.removeChild(input);
  }

  _getOffsetTopWithin(el, ancestor) {
    let top = 0;
    let cur = el;
    while (cur && cur !== ancestor) {
      top += cur.offsetTop;
      const parent = cur.offsetParent;
      if (!parent || (parent !== ancestor && !ancestor.contains(parent))) {
        break;
      }
      cur = parent;
    }
    return top;
  }

  _savePendingBlogProgress(post, progress) {
    if (!post || !progress) return;
    const payload = {
      title: post.title || '',
      file: post.file || '',
      progress,
      ts: Date.now()
    };
    window.__pendingBlogReadingProgress = payload;
    try {
      sessionStorage.setItem('blog_pending_reading_progress', JSON.stringify(payload));
    } catch (e) {}
  }

  // ==========================================
  // 博客文章弹窗（用于多任务中心打开 / 最小化暂存）
  // ==========================================
  _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async _ensureMarkedLoaded() {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked;
    }
    if (this._markedLoadPromise) {
      return this._markedLoadPromise;
    }
    this._markedLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="marked"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.marked), { once: true });
        existing.addEventListener('error', () => {
          this._markedLoadPromise = null;
          reject(new Error('marked load failed'));
        }, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/18.1.0/lib/marked.umd.min.js';
      script.onload = () => resolve(window.marked);
      script.onerror = () => {
        this._markedLoadPromise = null;
        reject(new Error('marked load failed'));
      };
      document.head.appendChild(script);
    });
    return this._markedLoadPromise;
  }

  async _fetchBlogMarkdown(file) {
    const blogFetch = typeof window.fetchCdn === 'function' ? window.fetchCdn : fetch;
    const postUrl = typeof window.fetchCdn === 'function'
      ? `/blog/${file}`
      : `${typeof window.getCdnBaseUrl === 'function' ? window.getCdnBaseUrl() : 'https://cdn-cf.satinau.cn'}/blog/${file}`;
    const res = await blogFetch(postUrl);
    if (!res.ok) throw new Error('文章加载失败');
    return res.text();
  }

  _normalizeBlogStates(input) {
    const list = Array.isArray(input) ? input : (input ? [input] : []);
    return list
      .filter(it => it && it.title)
      .map(it => ({
        key: String(it.key || it.file || it.title),
        title: it.title,
        date: it.date || '',
        file: it.file || '',
        cover: it.cover || null,
        markdown: typeof it.markdown === 'string' && it.markdown.length > 0 ? it.markdown : null,
        readingProgress: it.readingProgress || null,
        lastActiveAt: it.lastActiveAt || Date.now()
      }));
  }

  _findExistingMinimizedTask(targetType, taskKey) {
    const direct = this.minimizedTasks.find(
      l => !l.isClosing && l.taskType === targetType && l.taskKey === taskKey
    );
    if (direct) return direct;
    if (targetType === 'blog') {
      return this.minimizedTasks.find(
        l => !l.isClosing && l.taskType === 'blog-group' &&
          Array.isArray(l.groupItems) && l.groupItems.some(item => item.key === taskKey)
      ) || null;
    }
    return null;
  }

  _tryMergeBlogsForIncoming(incomingType, incomingStates = null) {
    const blogSlotIndices = [];
    this.minimizedTasks.forEach((l, index) => {
      if (l && !l.isClosing && (l.taskType === 'blog' || l.taskType === 'blog-group')) {
        blogSlotIndices.push(index);
      }
    });

    if (blogSlotIndices.length === 0) {
      return { handled: false, absorbed: false, replacedIds: [] };
    }

    const isIncomingBlogLike = incomingType === 'blog' || incomingType === 'blog-group';
    if (blogSlotIndices.length === 1 && !isIncomingBlogLike) {
      return { handled: false, absorbed: false, replacedIds: [] };
    }

    const absorbIncoming = (blogSlotIndices.length === 1 && isIncomingBlogLike) || incomingType === 'blog-group';
    const firstBlogIndex = blogSlotIndices[0];
    const replacedIds = [];
    const mergedMap = new Map();

    const pushState = (state) => {
      if (!state || !state.key) return;
      if (mergedMap.has(state.key)) {
        const prev = mergedMap.get(state.key);
        mergedMap.set(state.key, {
          ...prev,
          ...state,
          markdown: state.markdown || prev.markdown || null,
          readingProgress: state.readingProgress || prev.readingProgress || null
        });
      } else {
        mergedMap.set(state.key, { ...state });
      }
    };

    const layersToRemove = blogSlotIndices.map(i => this.minimizedTasks[i]);
    layersToRemove.forEach(l => {
      replacedIds.push(l.taskId);
      const states = typeof l._getBlogStates === 'function' ? l._getBlogStates() : (l.groupItems || []);
      states.forEach(pushState);
    });

    let activeKey = null;
    if (absorbIncoming && Array.isArray(incomingStates) && incomingStates.length > 0) {
      incomingStates.forEach(pushState);
      activeKey = incomingStates[incomingStates.length - 1].key;
    }

    const mergedStates = Array.from(mergedMap.values());
    if (mergedStates.length < 2) {
      return { handled: false, absorbed: false, replacedIds: [] };
    }

    const removeSet = new Set(layersToRemove);
    this.minimizedTasks = this.minimizedTasks.filter(l => !removeSet.has(l));
    layersToRemove.forEach(l => {
      l._skipRebalanceOnDestroy = true;
      l._skipNotifyOnDestroy = true;
      l._forceDestroy();
    });

    const insertAt = Math.min(firstBlogIndex, this.minimizedTasks.length);
    const groupLayer = this.openBlogGroup(mergedStates, {
      minimized: true,
      activeKey: activeKey || mergedStates[mergedStates.length - 1].key,
      skipMerge: true,
      skipRebalance: true,
      insertIndex: insertAt
    });

    this.showToast('后台任务已满，已将博客文章合并为文章组');
    return {
      handled: true,
      absorbed: absorbIncoming,
      groupLayer,
      replacedIds
    };
  }

  _isGroupTaskSlot(slot) {
    if (!slot) return false;
    if (slot.taskType === 'blog-group') return true;
    if (slot.taskType === 'image-group') {
      return this.imageGroupItems.length >= 2;
    }
    return false;
  }

  _evictOneTaskForSpace() {
    if (this.minimizedTasks.length === 0) return null;
    let evictIdx = this.minimizedTasks.findIndex(slot => !this._isGroupTaskSlot(slot));
    if (evictIdx === -1) {
      evictIdx = 0;
    }
    const [evicted] = this.minimizedTasks.splice(evictIdx, 1);
    if (evicted) {
      evicted._skipRebalanceOnDestroy = true;
      evicted._skipNotifyOnDestroy = true;
      evicted._forceDestroy();
    }
    return evicted;
  }

  _rebalanceBlogGroups({ silent = false } = {}) {
    const replacedIds = [];
    let splitHappened = false;
    const openImageSlotCount = (
      this.activeImageViewer &&
      (this.activeImageViewer.mode === 'group' || this.imageGroupItems.length === 0)
    ) ? 1 : 0;
    const openMinimizableCount = this.layers.filter(l => !l.isClosing && l.minimizable).length + openImageSlotCount;

    let idx = 0;
    while (idx < this.minimizedTasks.length) {
      const task = this.minimizedTasks[idx];
      if (task && !task.isClosing && task.taskType === 'blog-group') {
        const items = typeof task._getBlogStates === 'function' ? task._getBlogStates() : (task.groupItems || []);
        const totalSlotsAfterSplit = (this.minimizedTasks.length - 1) + openMinimizableCount + items.length;
        if (items.length <= 1 || totalSlotsAfterSplit <= this.maxMinimizedTasks) {
          const hadMulti = items.length >= 2;
          replacedIds.push(task.taskId);
          this.minimizedTasks.splice(idx, 1);
          task._skipRebalanceOnDestroy = true;
          task._skipNotifyOnDestroy = true;
          task._forceDestroy();

          items.forEach((item, offset) => {
            this.openBlog(item, {
              minimized: true,
              skipMerge: true,
              skipRebalance: true,
              insertIndex: idx + offset
            });
          });

          if (hadMulti) splitHappened = true;
          idx += Math.max(0, items.length);
          continue;
        }
      }
      idx++;
    }

    if (splitHappened && !silent) {
      this.showToast('后台任务不满 3 个，文章组已自动分开');
    }
    return replacedIds;
  }

  minimizeBlog(post) {
    return this.openBlog(post, { minimized: true });
  }

  openBlog(post, options = {}) {
    if (!post || !post.title) return null;
    return this.openBlogGroup([post], options);
  }

  openBlogGroup(rawItems, options = {}) {
    const items = this._normalizeBlogStates(rawItems);
    if (items.length === 0) return null;

    const {
      minimized = false,
      activeKey: initialActiveKey = null,
      skipMerge = false,
      skipRebalance = false,
      insertIndex = -1
    } = options;

    let activeItem = items.find(it => it.key === initialActiveKey) || items[items.length - 1];
    const isGroup = items.length > 1;
    const safeTitle = this._escapeHtml(activeItem.title);
    const hasInitialMd = typeof activeItem.markdown === 'string' && activeItem.markdown.length > 0;

    return this.open({
      className: isGroup ? 'modal blog-modal has-group-tabs' : 'modal blog-modal',
      minimizable: true,
      startMinimized: minimized,
      skipMerge,
      skipRebalance,
      insertIndex,
      taskMeta: isGroup ? {
        type: 'blog-group',
        key: 'blog-group',
        title: `文章组 (${items.length})`,
        subtitle: items.map(it => it.title).join(' · '),
        items
      } : {
        type: 'blog',
        key: activeItem.key,
        title: activeItem.title,
        subtitle: activeItem.date ? `博客文章 · ${activeItem.date}` : '博客文章',
        date: activeItem.date,
        file: activeItem.file,
        cover: activeItem.cover,
        markdown: activeItem.markdown,
        readingProgress: activeItem.readingProgress
      },
      content: `
        <div class="blog-modal-header">
          <div class="blog-modal-header-main">
            <div class="blog-modal-title" id="blogModalTitle" title="${safeTitle}">${safeTitle}</div>
            <div class="web-modal-actions blog-modal-actions">
              <button id="blogModalMinimizeBtn" class="web-modal-action web-modal-minimize" type="button" title="最小化 / Minimize" aria-label="最小化">
                <svg viewBox="0 0 24 24"><path d="M5 11h14v2H5z"/></svg>
              </button>
              <button id="blogModalOpenFullBtn" class="web-modal-action" type="button" title="打开完整博客页面 / Open Full Page" aria-label="打开完整博客页面">
                <svg id="icon-expand" viewBox="0 0 24 24"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/></svg>
              </button>
              <button id="blogModalCloseBtn" class="web-modal-action web-modal-close" type="button" title="关闭 / Close" aria-label="关闭">
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          </div>
          <div class="blog-group-tabs" id="blogGroupTabs" role="tablist"></div>
        </div>
        <div class="loading-overlay ${hasInitialMd ? '' : 'show'}" id="blogLoadingOverlay" ${hasInitialMd ? 'style="display: none;"' : ''}>
          <div class="spinner"></div>
        </div>
        <div class="blog-modal-body" id="blogModalBody">
          <div class="md-body" id="blogModalContent"></div>
        </div>
      `,
      onMount: (layer) => {
        const { modal, close } = layer;
        const minimizeBtn = modal.querySelector('#blogModalMinimizeBtn');
        const openFullBtn = modal.querySelector('#blogModalOpenFullBtn');
        const closeBtn = modal.querySelector('#blogModalCloseBtn');
        const titleEl = modal.querySelector('#blogModalTitle');
        const tabsEl = modal.querySelector('#blogGroupTabs');
        const modalBody = modal.querySelector('#blogModalBody');
        const contentEl = modal.querySelector('#blogModalContent');
        const loadingOverlay = modal.querySelector('#blogLoadingOverlay');
        let viewerInstance = null;
        let activeKey = activeItem.key;
        let isBodyRendered = false;
        let userInteractedInModal = false;
        let imgSyncCleanup = null;

        layer.groupItems = items;
        layer.activeGroupKey = activeKey;

        const destroyViewer = () => {
          if (viewerInstance) {
            try { viewerInstance.destroy(); } catch (e) {}
            viewerInstance = null;
          }
        };

        const cleanupImgSync = () => {
          if (typeof imgSyncCleanup === 'function') {
            imgSyncCleanup();
            imgSyncCleanup = null;
          }
        };

        const showLoading = () => {
          if (!loadingOverlay) return;
          loadingOverlay.style.display = '';
          loadingOverlay.classList.add('show');
        };

        const hideLoading = () => {
          if (!loadingOverlay) return;
          loadingOverlay.classList.remove('show');
          setTimeout(() => {
            if (!loadingOverlay.classList.contains('show')) {
              loadingOverlay.style.display = 'none';
            }
          }, 300);
        };

        const captureModalReadingProgress = () => {
          if (!isBodyRendered || !modalBody) {
            return activeItem.readingProgress || null;
          }
          const scrollTop = modalBody.scrollTop || 0;
          const maxScroll = Math.max(0, modalBody.scrollHeight - modalBody.clientHeight);
          const blocks = Array.from(contentEl.children);
          if (blocks.length === 0 || scrollTop <= 4) {
            return { ratio: 0, blockIndex: 0, blockOffsetRatio: 0 };
          }
          if (maxScroll > 4 && scrollTop >= maxScroll - 4) {
            return { ratio: 1, blockIndex: blocks.length - 1, blockOffsetRatio: 1 };
          }

          const headerOffset = parseFloat(window.getComputedStyle(modalBody).paddingTop) || 68;
          const refContentY = scrollTop + headerOffset;
          let blockIndex = 0;
          let blockOffsetRatio = 0;

          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const h = block.offsetHeight;
            if (h <= 0 && block.offsetWidth <= 0) continue;
            const blockTop = this._getOffsetTopWithin(block, modalBody);
            const blockBottom = blockTop + h;
            if (blockBottom > refContentY) {
              blockIndex = i;
              blockOffsetRatio = (blockTop < refContentY && h > 0)
                ? Math.max(0, Math.min(1, (refContentY - blockTop) / h))
                : 0;
              break;
            }
            blockIndex = i;
            blockOffsetRatio = 1;
          }

          const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, scrollTop / maxScroll)) : 0;
          return { ratio, blockIndex, blockOffsetRatio };
        };

        const applyModalReadingProgress = (progress) => {
          if (!isBodyRendered || !modalBody) return;
          if (!progress) {
            modalBody.scrollTop = 0;
            return;
          }
          const maxScroll = Math.max(0, modalBody.scrollHeight - modalBody.clientHeight);
          if (maxScroll <= 0) {
            modalBody.scrollTop = 0;
            return;
          }
          const ratio = Math.max(0, Math.min(1, Number(progress.ratio) || 0));
          if (ratio <= 0.005) {
            modalBody.scrollTop = 0;
            return;
          }
          if (ratio >= 0.995) {
            modalBody.scrollTop = maxScroll;
            return;
          }

          const blocks = Array.from(contentEl.children);
          const headerOffset = parseFloat(window.getComputedStyle(modalBody).paddingTop) || 68;
          const idx = Math.max(0, Math.min(blocks.length - 1, Number(progress.blockIndex) || 0));
          const targetBlock = blocks[idx];

          if (targetBlock && targetBlock.offsetHeight > 0) {
            const blockTop = this._getOffsetTopWithin(targetBlock, modalBody);
            const offsetRatio = Math.max(0, Math.min(1, Number(progress.blockOffsetRatio) || 0));
            const targetScrollTop = blockTop + offsetRatio * targetBlock.offsetHeight - headerOffset;
            modalBody.scrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop));
          } else {
            modalBody.scrollTop = Math.round(maxScroll * ratio);
          }
        };

        const syncLayerMeta = () => {
          if (items.length > 1) {
            modal.classList.add('has-group-tabs');
            layer.taskType = 'blog-group';
            layer.taskKey = 'blog-group';
            layer.taskTitle = `文章组 (${items.length})`;
            layer.taskSubtitle = items.map(it => it.title).join(' · ');
          } else {
            modal.classList.remove('has-group-tabs');
            const single = items[0];
            layer.taskType = 'blog';
            layer.taskKey = single.key;
            layer.taskTitle = single.title;
            layer.taskSubtitle = single.date ? `博客文章 · ${single.date}` : '博客文章';
          }
        };

        const renderGroupTabs = () => {
          syncLayerMeta();
          if (!tabsEl) return;
          tabsEl.innerHTML = '';
          if (items.length <= 1) return;

          items.forEach(item => {
            const tab = document.createElement('div');
            tab.className = `blog-group-tab${item.key === activeKey ? ' active' : ''}`;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(item.key === activeKey));
            tab.title = item.title;

            const textSpan = document.createElement('span');
            textSpan.className = 'blog-group-tab-title';
            textSpan.textContent = item.title;

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'blog-group-tab-close';
            delBtn.setAttribute('aria-label', `关闭 ${item.title}`);
            delBtn.title = '从文章组中关闭';
            delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              removeGroupItem(item.key);
            });

            tab.addEventListener('click', () => {
              if (item.key !== activeKey) {
                switchToItem(item.key);
              }
            });

            tab.appendChild(textSpan);
            tab.appendChild(delBtn);
            tabsEl.appendChild(tab);
          });

          const activeTab = tabsEl.querySelector('.blog-group-tab.active');
          if (activeTab) {
            requestAnimationFrame(() => {
              activeTab.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
            });
          }
        };

        const renderMarkdown = async (targetItem, mdText) => {
          try {
            const markedLib = await this._ensureMarkedLoaded();
            if (layer.isClosing || activeItem.key !== targetItem.key) return;

            const processedMd = mdText.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
              const resolvedSrc = typeof window.getCdnUrl === 'function'
                ? window.getCdnUrl(src.startsWith('http://') || src.startsWith('https://') ? src : `/blog/${src.replace(/^\/+/, '')}`)
                : (src.startsWith('http://') || src.startsWith('https://') ? src : `/blog/${src.replace(/^\/+/, '')}`);
              return `![${alt}](${resolvedSrc})`;
            });

            contentEl.innerHTML = markedLib.parse(processedMd);

            contentEl.querySelectorAll('table').forEach(table => {
              const wrapper = document.createElement('div');
              wrapper.className = 'table-wrapper';
              table.parentNode.insertBefore(wrapper, table);
              wrapper.appendChild(table);
            });

            contentEl.querySelectorAll('a').forEach(link => {
              const href = link.getAttribute('href');
              if (href && !href.startsWith('#') &&
                  !href.startsWith('http://') &&
                  !href.startsWith('https://') &&
                  !href.startsWith('/')) {
                link.setAttribute('href', `/blog/${href}`);
              }
              if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
              }
            });

            destroyViewer();
            if (typeof window.Viewer !== 'undefined' && contentEl.querySelectorAll('img').length > 0) {
              if (typeof window.syncViewerOpenToHtml === 'function') {
                window.syncViewerOpenToHtml();
              }
              viewerInstance = new window.Viewer(contentEl, {
                zIndex: 10040,
                title: (img) => {
                  const width = img.naturalWidth || (viewerInstance && viewerInstance.imageData ? viewerInstance.imageData.naturalWidth : 0);
                  const height = img.naturalHeight || (viewerInstance && viewerInstance.imageData ? viewerInstance.imageData.naturalHeight : 0);
                  return width && height ? `${targetItem.title} (${width} × ${height})` : targetItem.title;
                },
                backdrop: true,
                toolbar: true,
                navbar: true,
                tooltip: true,
                movable: true,
                zoomable: true,
                rotatable: true,
                scalable: true,
                transition: true,
                fullscreen: true,
                keyboard: true,
                className: 'viewer-custom',
                play: () => viewerInstance?.viewer?.classList.add('viewer-playing'),
                stop: () => viewerInstance?.viewer?.classList.remove('viewer-playing'),
                hidden: () => {
                  if (!layer.isClosing && !layer.isMinimized && this.layers.includes(layer)) {
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
                    const scrollbarWidth = parseFloat(document.documentElement.style.getPropertyValue('--scrollbar-compensate')) || 0;
                    if (scrollbarWidth > 0) {
                      document.body.style.paddingRight = `${scrollbarWidth}px`;
                    }
                  }
                }
              });
            }

            cleanupImgSync();
            isBodyRendered = true;
            userInteractedInModal = false;
            if (modalBody) {
              applyModalReadingProgress(targetItem.readingProgress || null);
              if (targetItem.readingProgress) {
                const incompleteImgs = Array.from(contentEl.querySelectorAll('img')).filter(img => !img.complete);
                if (incompleteImgs.length > 0) {
                  const onUserInteract = () => { userInteractedInModal = true; };
                  modalBody.addEventListener('wheel', onUserInteract, { passive: true, once: true });
                  modalBody.addEventListener('touchstart', onUserInteract, { passive: true, once: true });
                  modalBody.addEventListener('pointerdown', onUserInteract, { passive: true, once: true });
                  const onImgDone = () => {
                    if (!userInteractedInModal && !layer.isClosing && activeItem.key === targetItem.key && targetItem.readingProgress) {
                      applyModalReadingProgress(targetItem.readingProgress);
                    }
                  };
                  incompleteImgs.forEach(img => {
                    img.addEventListener('load', onImgDone, { once: true });
                    img.addEventListener('error', onImgDone, { once: true });
                  });
                  const timer = setTimeout(cleanupImgSync, 4000);
                  imgSyncCleanup = () => {
                    clearTimeout(timer);
                    modalBody.removeEventListener('wheel', onUserInteract);
                    modalBody.removeEventListener('touchstart', onUserInteract);
                    modalBody.removeEventListener('pointerdown', onUserInteract);
                    incompleteImgs.forEach(img => {
                      img.removeEventListener('load', onImgDone);
                      img.removeEventListener('error', onImgDone);
                    });
                  };
                }
              }
            }

            hideLoading();
          } catch (err) {
            console.error('渲染博客弹窗正文失败:', err);
            if (activeItem.key !== targetItem.key) return;
            hideLoading();
            contentEl.innerHTML = `<div class="blog-modal-status"><p>文章内容解析失败</p></div>`;
          }
        };

        const loadItemContent = async (targetItem, mdOverride = null) => {
          if (mdOverride) targetItem.markdown = mdOverride;
          if (targetItem.markdown) {
            await renderMarkdown(targetItem, targetItem.markdown);
            return;
          }
          if (!targetItem.file) {
            isBodyRendered = false;
            hideLoading();
            contentEl.innerHTML = `<div class="blog-modal-status"><p>暂无正文内容</p></div>`;
            return;
          }
          isBodyRendered = false;
          showLoading();
          try {
            const md = await this._fetchBlogMarkdown(targetItem.file);
            targetItem.markdown = md;
            if (layer.isClosing || activeItem.key !== targetItem.key) return;
            await renderMarkdown(targetItem, md);
          } catch (err) {
            console.error('加载博客弹窗正文失败:', err);
            if (layer.isClosing || activeItem.key !== targetItem.key) return;
            hideLoading();
            contentEl.innerHTML = `
              <div class="blog-modal-status">
                <p>文章加载失败，请重试</p>
                <button type="button" class="back-button" id="blogModalRetryBtn" aria-label="重试">
                  <svg viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 013.51 15"/></svg>
                </button>
              </div>
            `;
            const retryBtn = contentEl.querySelector('#blogModalRetryBtn');
            if (retryBtn) {
              retryBtn.onclick = () => loadItemContent(targetItem, null);
            }
          }
        };

        const switchToItem = (targetKey) => {
          if (isBodyRendered) {
            activeItem.readingProgress = captureModalReadingProgress();
          }
          const nextItem = items.find(it => it.key === targetKey);
          if (!nextItem) return;
          activeKey = nextItem.key;
          activeItem = nextItem;
          activeItem.lastActiveAt = Date.now();
          layer.activeGroupKey = activeKey;
          if (titleEl) {
            titleEl.textContent = activeItem.title;
            titleEl.title = activeItem.title;
          }
          cleanupImgSync();
          isBodyRendered = false;
          userInteractedInModal = false;
          renderGroupTabs();
          loadItemContent(activeItem);
        };

        const removeGroupItem = (targetKey) => {
          const idx = items.findIndex(it => it.key === targetKey);
          if (idx === -1) return;
          const wasActive = (targetKey === activeKey);
          items.splice(idx, 1);
          if (items.length === 0) {
            close();
            return;
          }
          if (wasActive) {
            const nextItem = items[Math.min(idx, items.length - 1)];
            activeKey = nextItem.key;
            activeItem = nextItem;
            layer.activeGroupKey = activeKey;
            if (titleEl) {
              titleEl.textContent = activeItem.title;
              titleEl.title = activeItem.title;
            }
            cleanupImgSync();
            isBodyRendered = false;
            userInteractedInModal = false;
            renderGroupTabs();
            loadItemContent(activeItem);
          } else {
            renderGroupTabs();
          }
        };

        if (tabsEl) {
          tabsEl.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              tabsEl.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }, { passive: false });
        }

        layer.onDestroy(() => {
          cleanupImgSync();
          destroyViewer();
        });

        layer._getBlogStates = () => {
          if (isBodyRendered && !layer.isMinimized) {
            activeItem.readingProgress = captureModalReadingProgress();
          }
          return items.map(it => ({ ...it }));
        };

        layer._onMinimize = () => {
          activeItem.readingProgress = captureModalReadingProgress();
          activeItem.lastActiveAt = Date.now();
          userInteractedInModal = false;
        };

        layer._onRestore = () => {
          userInteractedInModal = false;
          if (isBodyRendered && modalBody) {
            applyModalReadingProgress(activeItem.readingProgress || null);
          }
        };

        layer._onUpdateTask = (meta) => {
          if (!meta) return;
          const targetKey = meta.key ? String(meta.key) : activeKey;
          const target = items.find(it => it.key === targetKey) || activeItem;
          if (meta.readingProgress) target.readingProgress = meta.readingProgress;
          if (meta.markdown) target.markdown = meta.markdown;
          target.lastActiveAt = Date.now();

          if (target.key !== activeKey) {
            activeKey = target.key;
            activeItem = target;
            layer.activeGroupKey = activeKey;
            if (titleEl) {
              titleEl.textContent = activeItem.title;
              titleEl.title = activeItem.title;
            }
            cleanupImgSync();
            isBodyRendered = false;
            renderGroupTabs();
            loadItemContent(activeItem);
          } else if (meta.markdown && !isBodyRendered) {
            loadItemContent(activeItem, meta.markdown);
          } else if (meta.readingProgress && isBodyRendered) {
            userInteractedInModal = false;
            applyModalReadingProgress(activeItem.readingProgress);
          }
        };

        renderGroupTabs();
        loadItemContent(activeItem);

        if (minimizeBtn) minimizeBtn.onclick = () => layer.minimize();
        if (closeBtn) closeBtn.onclick = () => close();
        if (openFullBtn) {
          openFullBtn.onclick = () => {
            const progress = captureModalReadingProgress();
            this._savePendingBlogProgress(activeItem, progress);
            const remainingItems = items.filter(it => it.key !== activeItem.key).map(it => ({ ...it }));
            const targetUrl = `/blog.html?title=${encodeURIComponent(activeItem.title)}`;
            close({ immediateUnlock: true });

            if (remainingItems.length > 0) {
              if (remainingItems.length === 1) {
                this.openBlog(remainingItems[0], {
                  minimized: true,
                  skipMerge: true,
                  skipRebalance: true
                });
              } else {
                this.openBlogGroup(remainingItems, {
                  minimized: true,
                  activeKey: remainingItems[remainingItems.length - 1].key,
                  skipMerge: true,
                  skipRebalance: true
                });
              }
              const replacedIds = this._rebalanceBlogGroups({ silent: true });
              this._notifyTasksChanged(replacedIds);
            }

            if (typeof window.navigateTo === 'function') {
              window.navigateTo(targetUrl);
            } else {
              window.location.href = targetUrl;
            }
          };
        }
      }
    });
  }

  // ==========================================
  // 后台图片组管理与多任务恢复
  // ==========================================
  _ensureImageGroupSlot() {
    let slot = this.minimizedTasks.find(l => !l.isClosing && l.taskType === 'image-group');
    let evictedOnStart = false;
    let mergedIntoGroup = false;
    let mergeReplacedIds = [];

    if (!slot) {
      if (this.minimizedTasks.length >= this.maxMinimizedTasks) {
        const mergeRes = this._tryMergeBlogsForIncoming('image', null);
        if (mergeRes.handled) {
          mergedIntoGroup = true;
          mergeReplacedIds = mergeRes.replacedIds || [];
        } else {
          while (this.minimizedTasks.length >= this.maxMinimizedTasks) {
            this._evictOneTaskForSpace();
            evictedOnStart = true;
          }
          if (evictedOnStart) {
            this.showToast(`多任务最多保留 ${this.maxMinimizedTasks} 个，已自动关闭最早的任务`);
          }
        }
      }

      slot = {
        taskId: 'image-group-slot',
        taskKey: 'image-group',
        minimizable: true,
        isMinimized: true,
        isClosing: false,
        taskType: 'image-group',
        taskTitle: '图片组',
        taskSubtitle: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        close: () => this.closeTask('image-group-slot'),
        restore: () => this._restoreImageGroup('group', null),
        _forceDestroy: () => {
          slot.isClosing = true;
          this.imageGroupItems = [];
          this.minimizedTasks = this.minimizedTasks.filter(l => l !== slot);
        },
        _skipRebalanceOnDestroy: false,
        _skipNotifyOnDestroy: false
      };
      this.minimizedTasks.push(slot);
    } else {
      slot.lastActiveAt = Date.now();
    }

    return { slot, evictedOnStart, mergedIntoGroup, mergeReplacedIds };
  }

  minimizeImage(imgInfo) {
    const multitaskEnabled = typeof window.isMultitaskEnabled === 'function' ? window.isMultitaskEnabled() : true;
    if (!multitaskEnabled) {
      this.showToast('请前往设置中开启多任务管理');
      return null;
    }
    if (!imgInfo || !imgInfo.src) return null;

    const existingIdx = this.imageGroupItems.findIndex(it => it.src === imgInfo.src);
    const now = Date.now();
    let item;

    if (existingIdx !== -1) {
      const prev = this.imageGroupItems[existingIdx];
      this.imageGroupItems.splice(existingIdx, 1);
      item = {
        ...prev,
        title: imgInfo.title || prev.title,
        alt: imgInfo.alt || prev.alt,
        link: imgInfo.link !== undefined ? imgInfo.link : prev.link,
        width: imgInfo.width || prev.width,
        height: imgInfo.height || prev.height,
        lastActiveAt: now
      };
    } else {
      item = {
        id: `img-${++this.taskCounter}`,
        src: imgInfo.src,
        title: imgInfo.title || '图片',
        alt: imgInfo.alt || imgInfo.title || '图片',
        link: imgInfo.link || '',
        width: imgInfo.width || 0,
        height: imgInfo.height || 0,
        lastActiveAt: now
      };
    }

    const slotRes = this._ensureImageGroupSlot();
    this.imageGroupItems.push(item);

    const rebalanceIds = this._rebalanceBlogGroups({ silent: true });
    this._notifyTasksChanged([...slotRes.mergeReplacedIds, ...rebalanceIds]);
    return {
      slot: slotRes.slot,
      item,
      evictedOnStart: slotRes.evictedOnStart,
      mergedIntoGroup: slotRes.mergedIntoGroup
    };
  }

  async _ensureViewerLoaded() {
    if (!document.querySelector('link[href*="viewer.min.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.15.2/viewer.min.css';
      document.head.appendChild(link);
    }
    if (typeof window.Viewer !== 'undefined') return window.Viewer;
    if (this._viewerLoadPromise) return this._viewerLoadPromise;
    this._viewerLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="viewer.min.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Viewer), { once: true });
        existing.addEventListener('error', () => {
          this._viewerLoadPromise = null;
          reject(new Error('Viewer load failed'));
        }, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.15.2/viewer.min.js';
      script.onload = () => resolve(window.Viewer);
      script.onerror = () => {
        this._viewerLoadPromise = null;
        reject(new Error('Viewer load failed'));
      };
      document.head.appendChild(script);
    });
    return this._viewerLoadPromise;
  }

  _restoreImageGroup(mode = 'group', targetItemId = null) {
    if (this.imageGroupItems.length === 0) return false;

    const snapshotItems = this.imageGroupItems.map(it => ({ ...it }));
    let startIndex = snapshotItems.length - 1;
    let detachedItem = null;

    if (mode === 'single' && targetItemId) {
      const idx = snapshotItems.findIndex(it => it.id === targetItemId);
      if (idx === -1) return false;
      startIndex = idx;
      detachedItem = snapshotItems[idx];
      this.imageGroupItems = this.imageGroupItems.filter(it => it.id !== targetItemId);
      if (this.imageGroupItems.length === 0) {
        this.minimizedTasks = this.minimizedTasks.filter(l => l.taskType !== 'image-group');
      }
    } else {
      this.imageGroupItems = [];
      this.minimizedTasks = this.minimizedTasks.filter(l => l.taskType !== 'image-group');
    }

    this._openRestoredImageViewer(snapshotItems, startIndex, mode, detachedItem);
    this._notifyTasksChanged();
    return true;
  }

  async _openRestoredImageViewer(snapshotItems, startIndex = 0, mode = 'group', detachedItem = null) {
    if (this.activeImageViewer && this.activeImageViewer.viewer) {
      try { this.activeImageViewer.viewer.destroy(); } catch (e) {}
      if (this.activeImageViewer.container) this.activeImageViewer.container.remove();
      this.activeImageViewer = null;
    }

    try {
      const ViewerClass = await this._ensureViewerLoaded();
      if (typeof window.syncViewerOpenToHtml === 'function') {
        window.syncViewerOpenToHtml();
      }

      const container = document.createElement('div');
      container.style.display = 'none';
      snapshotItems.forEach(item => {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.alt || item.title;
        img.dataset.imgId = item.id;
        img.dataset.displayTitle = item.title;
        if (item.link) img.dataset.link = item.link;
        container.appendChild(img);
      });
      document.body.appendChild(container);

      let minimizedBack = false;
      const state = {
        viewer: null,
        container,
        mode,
        items: snapshotItems,
        detachedItem
      };
      this.activeImageViewer = state;

      const viewer = new ViewerClass(container, {
        initialViewIndex: Math.max(0, Math.min(snapshotItems.length - 1, startIndex)),
        zIndex: 10040,
        title: (img) => {
          const baseTitle = (img.dataset && img.dataset.displayTitle) || img.alt || '图片';
          const width = img.naturalWidth || (viewer.imageData ? viewer.imageData.naturalWidth : 0);
          const height = img.naturalHeight || (viewer.imageData ? viewer.imageData.naturalHeight : 0);
          return width && height ? `${baseTitle} (${width} × ${height})` : baseTitle;
        },
        backdrop: true,
        toolbar: true,
        navbar: snapshotItems.length > 1,
        tooltip: true,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: true,
        transition: true,
        fullscreen: true,
        keyboard: true,
        className: 'viewer-custom',
        play: () => viewer?.viewer?.classList.add('viewer-playing'),
        stop: () => viewer?.viewer?.classList.remove('viewer-playing'),
        viewed: (event) => {
          const currentImg = event.detail.originalImage;
          const linkUrl = currentImg && currentImg.dataset ? currentImg.dataset.link : '';
          const titleElement = viewer.viewer ? viewer.viewer.querySelector('.viewer-title') : null;
          if (titleElement) {
            titleElement.style.cursor = '';
            titleElement.style.textDecoration = '';
            titleElement.style.color = '';
            titleElement.onclick = null;
            titleElement.title = '';

            if (linkUrl && linkUrl.trim() !== '') {
              titleElement.style.cursor = 'pointer';
              titleElement.title = '点击访问 / Click to visit';
              titleElement.onclick = (e) => {
                e.stopPropagation();
                window.open(linkUrl, '_blank');
              };
            }
          }
        },
        hidden: () => {
          try { viewer.destroy(); } catch (e) {}
          container.remove();
          if (this.activeImageViewer === state) {
            this.activeImageViewer = null;
          }
          if (!minimizedBack) {
            const rebalanceIds = this._rebalanceBlogGroups();
            this._notifyTasksChanged(rebalanceIds);
          }
        }
      });

      state.viewer = viewer;

      viewer._globalModalMinimizeHandler = () => {
        minimizedBack = true;
        const currentIdx = typeof viewer.index === 'number' ? viewer.index : startIndex;
        const currentItem = snapshotItems[currentIdx] || detachedItem || snapshotItems[snapshotItems.length - 1];
        const now = Date.now();

        const itemsToRestore = mode === 'group'
          ? snapshotItems
          : (detachedItem ? [detachedItem] : []);

        itemsToRestore.forEach(it => {
          const existingIdx = this.imageGroupItems.findIndex(x => x.src === it.src);
          if (existingIdx !== -1) this.imageGroupItems.splice(existingIdx, 1);
          this.imageGroupItems.push({ ...it });
        });

        // 将关闭瞬间正查看的图片排至末尾，作为最近打开的图片
        if (currentItem) {
          const curIdxInGroup = this.imageGroupItems.findIndex(x => x.src === currentItem.src);
          if (curIdxInGroup !== -1) {
            const [picked] = this.imageGroupItems.splice(curIdxInGroup, 1);
            picked.lastActiveAt = now;
            this.imageGroupItems.push(picked);
          }
        }

        const slotRes = this._ensureImageGroupSlot();
        const rebalanceIds = this._rebalanceBlogGroups({ silent: true });
        this._notifyTasksChanged([...slotRes.mergeReplacedIds, ...rebalanceIds]);
        viewer.hide();
      };

      viewer.show();
    } catch (err) {
      console.error('打开图片查看器失败:', err);
      this.showToast('图片查看器加载失败');
    }
  }

  // 调用全局 Toast (假设页面上有 <div id="toast">)
  showToast(msg) {
    // 为了兼容旧代码，这里查找全局的 showToast 函数，或者自己实现
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      const tip = document.getElementById("toast");
      if (tip) {
        tip.textContent = msg;
        tip.classList.add("show");
        setTimeout(() => tip.classList.add("done"), 250);
        setTimeout(() => tip.classList.remove("show", "done"), 1800);
      }
    }
  }
}

customElements.define('global-modal', GlobalModal);