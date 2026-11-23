(function () {
  if (window.SatinAiChat) return;

  const CHAT_API_URL = "https://ai-engine.satinau.cn/v1/chat";
  const STORAGE_KEY = "satin_ai_chat_history";
  const MAX_STORED_MESSAGES = 24;

  const QUICK_PROMPTS = [
    "介绍一下站长和泽凌",
    "怎么联系站长扩列？",
    "带我去看看最近动态",
    "打开网站设置",
  ];

  let messages = [];
  let isSending = false;
  let desktopOpen = false;
  let mobileOpen = false;

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        messages = parsed.slice(-MAX_STORED_MESSAGES);
        return;
      }
    } catch {}
    messages = [
      {
        role: "model",
        text: "嗨！我是泽凌 🦊 想了解缎金、小站内容，或者让我直接带你去某个页面都可以问我哦～",
        action: null,
      },
    ];
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch {}
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildAnimatedTextHtml(text) {
    const tokens = String(text).match(/(\n|[\u4e00-\u9fa5]{1,2}|[A-Za-z0-9_]+|\s+|.)/g) || [];
    const stepMs = Math.min(26, Math.max(12, Math.floor(900 / Math.max(tokens.length, 1))));
    let idx = 0;
    const html = tokens
      .map((token) => {
        if (token === "\n") return "<br>";
        const delay = idx * stepMs;
        idx += 1;
        return `<span class="ai-chat-chunk" style="animation-delay:${delay}ms">${escapeHtml(token)}</span>`;
      })
      .join("");
    return { html, totalDuration: idx * stepMs + 260 };
  }

  async function executeSiteAction(action) {
    if (!action) return;

    if (action.type === "open_settings") {
      if (mobileOpen) closeMobileChat();
      if (typeof window.openSettingsModal === "function") {
        window.openSettingsModal(action.anchor || null);
      }
      return;
    }

    if (action.type === "navigate" && action.path) {
      if (mobileOpen) closeMobileChat();

      const targetUrl = new URL(action.path, window.location.origin);
      const isSamePage =
        targetUrl.pathname.replace(/\/index\.html$/, "/") ===
        window.location.pathname.replace(/\/index\.html$/, "/");

      if (!isSamePage && typeof window.navigateTo === "function") {
        await window.navigateTo(action.path);
      } else if (!isSamePage) {
        window.location.href = action.path;
        return;
      }

      if (action.selector && action.selector !== "body") {
        setTimeout(() => {
          const targetEl = document.querySelector(action.selector);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            targetEl.classList.remove("ai-nav-highlight");
            void targetEl.offsetWidth;
            targetEl.classList.add("ai-nav-highlight");
            setTimeout(() => targetEl.classList.remove("ai-nav-highlight"), 2200);
          }
        }, isSamePage ? 80 : 420);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }

  function renderMessageList(container) {
    if (!container) return;
    container.innerHTML = messages
      .map((msg, idx) => {
        const isUser = msg.role === "user";
        const shouldAnimateBubble = Boolean(msg.isNew);
        let textHtml = escapeHtml(msg.text).replace(/\n/g, "<br>");
        let actionDelay = 0;

        if (!isUser && msg.animateText) {
          const animated = buildAnimatedTextHtml(msg.text);
          textHtml = animated.html;
          actionDelay = Math.min(animated.totalDuration, 1100);
        }

        const actionBtn =
          !isUser && msg.action
            ? `<button type="button" class="ai-chat-action-pill${msg.animateText ? " is-entering" : ""}" style="${msg.animateText ? `animation-delay:${actionDelay}ms` : ""}" data-msg-idx="${idx}">🧭 ${escapeHtml(msg.action.label || "前往查看")}</button>`
            : "";

        return `
          <div class="ai-chat-msg ${isUser ? "is-user" : "is-model"}${shouldAnimateBubble ? " is-entering" : ""}">
            <div class="ai-chat-bubble">
              <div class="ai-chat-text">${textHtml}</div>
              ${actionBtn}
            </div>
          </div>
        `;
      })
      .join("");

    if (isSending) {
      container.insertAdjacentHTML(
        "beforeend",
        `
        <div class="ai-chat-msg is-model is-thinking is-entering">
          <div class="ai-chat-bubble">
            <span class="ai-typing-dots"><i></i><i></i><i></i></span>
          </div>
        </div>
        `
      );
    }

    container.querySelectorAll(".ai-chat-action-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.msgIdx);
        const msg = messages[idx];
        if (msg?.action) executeSiteAction(msg.action);
      });
    });

    container.scrollTop = container.scrollHeight;
  }

  function syncAllViews() {
    renderMessageList(document.getElementById("l2dChatMessages"));
    renderMessageList(document.getElementById("mobileAiChatMessages"));

    messages.forEach((m) => {
      if (m.isNew) delete m.isNew;
      if (m.animateText) delete m.animateText;
    });

    document.querySelectorAll(".ai-chat-status-text").forEach((el) => {
      el.textContent = isSending ? "正在思考…" : "在线 · 与泽凌对话中";
    });
    document.querySelectorAll(".ai-chat-send-btn").forEach((btn) => {
      btn.disabled = isSending;
    });
  }

  async function sendMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || isSending) return;

    const historyForApi = messages
      .filter((m) => m.role === "user" || m.role === "model")
      .slice(-16)
      .map((m) => ({ role: m.role, text: m.text }));

    messages.push({ role: "user", text, action: null, isNew: true });
    saveHistory();
    isSending = true;
    syncAllViews();

    try {
      const response = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyForApi,
          currentPath: window.location.pathname,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `请求失败 (${response.status})`);
      }

      const replyMsg = {
        role: "model",
        text: data.reply || "收到啦！",
        action: data.action || null,
        isNew: true,
        animateText: true,
      };
      messages.push(replyMsg);
      saveHistory();

      // 桌面端同步触发 Live2D 表情，增强“与形象对话”的沉浸感
      if (data.expression && typeof window.__live2dTriggerExpression === "function") {
        window.__live2dTriggerExpression(data.expression);
      } else if (typeof window.__live2dTapMotion === "function") {
        window.__live2dTapMotion();
      }

      if (data.action && data.action.auto) {
        setTimeout(() => executeSiteAction(data.action), 350);
      }
    } catch (err) {
      console.error("[SatinAiChat] Error:", err);
      messages.push({
        role: "model",
        text: "暂时连不上 AI 引擎，请稍后再试一下～",
        action: null,
        isNew: true,
        animateText: true,
      });
    } finally {
      isSending = false;
      syncAllViews();
    }
  }

  let isClearing = false;

  function clearHistory() {
    if (isClearing || isSending) return;
    isClearing = true;

    const lists = [
      document.getElementById("l2dChatMessages"),
      document.getElementById("mobileAiChatMessages"),
    ].filter(Boolean);

    document.querySelectorAll(".l2d-chat-icon-btn.is-refresh").forEach((btn) => {
      btn.classList.remove("is-spinning");
      void btn.offsetWidth;
      btn.classList.add("is-spinning");
      setTimeout(() => btn.classList.remove("is-spinning"), 460);
    });

    lists.forEach((el) => el.classList.add("is-clearing"));

    setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEY);
      loadHistory();
      if (messages[0]) {
        messages[0].isNew = true;
        messages[0].animateText = true;
      }
      lists.forEach((el) => el.classList.remove("is-clearing"));
      syncAllViews();
      isClearing = false;
    }, 220);
  }

  /* ========== 桌面端：挂载于 Live2D 上方的气泡对话框 ========== */
  function ensureDesktopPanel() {
    const wrapper = document.getElementById("live2d-wrapper");
    if (!wrapper) return null;

    let panel = wrapper.querySelector(".l2d-chat-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.className = "l2d-chat-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="l2d-chat-surface">
        <div class="l2d-chat-header">
          <div class="l2d-chat-persona">
            <span class="l2d-chat-dot"></span>
            <div class="l2d-chat-title-group">
              <span class="l2d-chat-name">泽凌 Zelynn</span>
              <span class="ai-chat-status-text">在线 · 与泽凌对话中</span>
            </div>
          </div>
          <div class="l2d-chat-header-actions">
            <button type="button" class="l2d-chat-icon-btn is-refresh" data-chat-clear title="清空对话" aria-label="清空对话">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button type="button" class="l2d-chat-icon-btn is-close" data-chat-close title="收起对话" aria-label="收起对话">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div class="l2d-chat-messages" id="l2dChatMessages"></div>
        <div class="ai-chat-quick-row">
          ${QUICK_PROMPTS.map((q) => `<button type="button" class="ai-quick-chip">${escapeHtml(q)}</button>`).join("")}
        </div>
        <form class="l2d-chat-input-bar" id="l2dChatForm">
          <input type="text" id="l2dChatInput" placeholder="和泽凌聊点什么，或让我带你逛逛…" autocomplete="off" maxlength="600" />
          <button type="submit" class="ai-chat-send-btn" aria-label="发送">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
        </form>
      </div>
    `;

    wrapper.appendChild(panel);

    panel.querySelector("[data-chat-close]").addEventListener("click", closeDesktopChat);
    panel.querySelector("[data-chat-clear]").addEventListener("click", clearHistory);
    panel.querySelectorAll(".ai-quick-chip").forEach((chip) => {
      chip.addEventListener("click", () => sendMessage(chip.textContent));
    });

    const form = panel.querySelector("#l2dChatForm");
    const input = panel.querySelector("#l2dChatInput");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value;
      input.value = "";
      sendMessage(val);
    });

    syncAllViews();
    return panel;
  }

  function openDesktopChat() {
    const wrapper = document.getElementById("live2d-wrapper");
    if (!wrapper) return;
    const panel = ensureDesktopPanel();
    if (!panel) return;

    const menu = wrapper.querySelector(".live2d-menu");
    if (menu) menu.classList.remove("show");

    desktopOpen = true;
    wrapper.classList.add("chat-open");
    panel.setAttribute("aria-hidden", "false");
    syncAllViews();

    setTimeout(() => {
      const input = panel.querySelector("#l2dChatInput");
      if (input) input.focus();
    }, 220);
  }

  function closeDesktopChat() {
    desktopOpen = false;
    const wrapper = document.getElementById("live2d-wrapper");
    if (!wrapper) return;

    const menu = wrapper.querySelector(".live2d-menu");
    if (menu) menu.classList.remove("show");

    wrapper.classList.remove("chat-open");
    const panel = wrapper.querySelector(".l2d-chat-panel");
    if (panel) panel.setAttribute("aria-hidden", "true");
  }

  /* ========== 移动端：底部抽屉式 AI 对话框 ========== */
  function ensureMobileSheet() {
    let overlay = document.getElementById("mobileAiChatOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "mobileAiChatOverlay";
    overlay.className = "mobile-ai-chat-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="mobile-ai-chat-sheet" role="dialog" aria-label="与泽凌 AI 对话">
        <div class="mobile-ai-chat-drag-zone">
          <div class="mobile-ai-chat-handle"></div>
          <div class="l2d-chat-header">
            <div class="l2d-chat-persona">
              <span class="l2d-chat-dot"></span>
              <div class="l2d-chat-title-group">
                <span class="l2d-chat-name">泽凌 Zelynn · AI</span>
                <span class="ai-chat-status-text">在线 · 与泽凌对话中</span>
              </div>
            </div>
            <div class="l2d-chat-header-actions">
              <button type="button" class="l2d-chat-icon-btn is-refresh" data-mobile-clear title="清空对话" aria-label="清空对话">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
              <button type="button" class="l2d-chat-icon-btn is-close" data-mobile-close title="关闭" aria-label="关闭">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="mobile-ai-chat-messages" id="mobileAiChatMessages"></div>
        <div class="ai-chat-quick-row">
          ${QUICK_PROMPTS.map((q) => `<button type="button" class="ai-quick-chip">${escapeHtml(q)}</button>`).join("")}
        </div>
        <form class="l2d-chat-input-bar mobile-ai-chat-form" id="mobileAiChatForm">
          <input type="text" id="mobileAiChatInput" placeholder="问问泽凌关于小站的一切…" autocomplete="off" maxlength="600" />
          <button type="submit" class="ai-chat-send-btn" aria-label="发送">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeMobileChat();
    });
    overlay.querySelector("[data-mobile-close]").addEventListener("click", closeMobileChat);
    overlay.querySelector("[data-mobile-clear]").addEventListener("click", clearHistory);
    overlay.querySelectorAll(".ai-quick-chip").forEach((chip) => {
      chip.addEventListener("click", () => sendMessage(chip.textContent));
    });

    const form = overlay.querySelector("#mobileAiChatForm");
    const input = overlay.querySelector("#mobileAiChatInput");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value;
      input.value = "";
      sendMessage(val);
    });

    const sheet = overlay.querySelector(".mobile-ai-chat-sheet");
    const dragZone = overlay.querySelector(".mobile-ai-chat-drag-zone");
    if (sheet && dragZone) {
      let startY = 0;
      let deltaY = 0;
      let startTime = 0;
      let isDraggingSheet = false;

      dragZone.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1 || e.target.closest("button")) return;
        startY = e.touches[0].clientY;
        deltaY = 0;
        startTime = Date.now();
        isDraggingSheet = true;
        sheet.style.transition = "none";
      }, { passive: true });

      dragZone.addEventListener("touchmove", (e) => {
        if (!isDraggingSheet || e.touches.length !== 1) return;
        const diff = e.touches[0].clientY - startY;
        deltaY = diff > 0 ? diff : diff * 0.18;
        if (diff > 0) e.preventDefault();
        sheet.style.transform = `translateY(${deltaY}px)`;
      }, { passive: false });

      const endSheetDrag = () => {
        if (!isDraggingSheet) return;
        isDraggingSheet = false;
        const duration = Math.max(Date.now() - startTime, 1);
        const velocity = deltaY / duration;
        sheet.style.transition = "";
        if (deltaY > 80 || velocity > 0.45) {
          sheet.style.transform = "";
          closeMobileChat();
        } else {
          sheet.style.transform = "";
        }
      };

      dragZone.addEventListener("touchend", endSheetDrag);
      dragZone.addEventListener("touchcancel", endSheetDrag);
    }

    syncAllViews();
    return overlay;
  }

  function openMobileChat() {
    if (typeof window.closeMobileMoreMenu === "function") {
      window.closeMobileMoreMenu();
    }
    const overlay = ensureMobileSheet();
    mobileOpen = true;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    syncAllViews();

    setTimeout(() => {
      const input = overlay.querySelector("#mobileAiChatInput");
      if (input) input.focus();
    }, 260);
  }

  function closeMobileChat() {
    mobileOpen = false;
    const overlay = document.getElementById("mobileAiChatOverlay");
    if (overlay) {
      const sheet = overlay.querySelector(".mobile-ai-chat-sheet");
      if (sheet) {
        sheet.style.transition = "";
        sheet.style.transform = "";
      }
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
    }
    document.documentElement.style.overflow = "";
  }

  // 全局绑定移动端输入框触发器（支持 SPA 重新挂载）
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".mobile-ai-input-trigger");
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      openMobileChat();
    }
  });

  // 按 ESC 快捷关闭对话框
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (desktopOpen) closeDesktopChat();
      if (mobileOpen) closeMobileChat();
    }
  });

  loadHistory();

  window.SatinAiChat = {
    openDesktopChat,
    closeDesktopChat,
    openMobileChat,
    closeMobileChat,
    sendMessage,
    clearHistory,
    ensureDesktopPanel,
  };
})();
