import { getChatByOrderId } from "../services/dataLoader.js";
import { welcomeMessage, getBotReply, nowTime } from "../services/chatbot.js";
import {
  CANCEL_REQUEST_MESSAGE,
  getCancelRequestReply,
  isCancelIntentMessage,
  isCancelRequestMessage,
} from "../services/cancelRequestFlow.js";
import { submitCancelRequest } from "../services/cancelOrderClient.js";
import { buildChatQuickReplies } from "../services/chatSuggestions.js";
import {
  fetchAiStatus,
  initAiChat,
  resetAiSession,
  sendAiMessage,
} from "../services/geminiClient.js";
import { pickApiErrorReply } from "../services/apiErrorReplies.js";
import {
  syncChatMessage,
  resetOrderChatSession,
  requestHumanSupport,
  sendCustomerHumanMessage,
  pollOrderChat,
} from "../services/liveChatClient.js";
import {
  isExplicitHumanEscalationRequest,
  isHumanSessionEndNotice,
} from "../services/humanSupportRequest.js";

/**
 * Gắn FAB chat + panel chatbot (dùng trên trang customer).
 * @param {{ getOrder: () => object | null, getChats: () => array }} ctx
 */
export function initChatWidget(ctx) {
  const fab = document.getElementById("chat-fab");
  const panel = document.getElementById("chat-panel");
  const backdrop = document.getElementById("chat-backdrop");
  const closeBtn = document.getElementById("chat-close");
  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const subtitle = document.getElementById("chat-subtitle");
  const quickRepliesEl = document.getElementById("chat-quick-replies");

  if (!fab || !panel) return;

  let botReplyCount = 0;
  let sessionMessages = [];
  let aiStatus = { aiEnabled: false, provider: null, model: null };
  let aiSessionId = null;
  let isEscalated = false;
  let isConnectingToHuman = false;
  let isSending = false;
  let lastMessageAt = 0;
  let pollTimer = null;
  let activeOrderId = null;

  const aiStatusReady = fetchAiStatus().then((status) => {
    aiStatus = status;
    updateChatHeader();
    return status;
  });

  function updateChatHeader() {
    const title = document.getElementById("chat-title");
    if (!title) return;

    const order = ctx.getOrder();

    if (!order) {
      title.textContent = "basau Assistant";
      if (subtitle) subtitle.textContent = "Chọn đơn để bắt đầu";
      return;
    }

    if (isEscalated) {
      title.textContent = "Nhân viên basau";
      if (subtitle) {
        subtitle.textContent = `${order.order_id} · Đang chat với nhân viên`;
      }
      return;
    }

    if (aiEnabled()) {
      title.textContent = "Trợ lý BaSau";
      if (subtitle) {
        subtitle.textContent = `${order.order_id} · Đang chat với AI`;
      }
      return;
    }

    title.textContent = "basau Assistant";
    if (subtitle) {
      subtitle.textContent = `${order.order_id} · Chế độ demo`;
    }
  }

  function aiEnabled() {
    return Boolean(aiStatus.aiEnabled);
  }

  function updateAiBadge() {
    updateChatHeader();
  }

  function isOpen() {
    return !panel.hidden;
  }

  function openPanel() {
    panel.hidden = false;
    backdrop.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    panel.classList.remove("panel-enter");
    void panel.offsetWidth;
    panel.classList.add("panel-enter");
    input.focus();
    scrollMessages();
    syncEscalatedFromServer();
  }

  async function syncEscalatedFromServer() {
    const order = ctx.getOrder();
    if (!order) return;
    const data = await pollOrderChat(order.order_id, lastMessageAt);
    if (isEscalated && !data.escalated) {
      handleHumanSessionEnded(data.messages);
      return;
    }
    if (data.messages?.length) mergeIncomingMessages(data.messages);
  }

  function closePanel() {
    panel.hidden = true;
    backdrop.hidden = true;
    fab.setAttribute("aria-expanded", "false");
  }

  function scrollMessages() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatBotText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function appendBubble(msg, animate = true) {
    const el = document.createElement("div");
    el.className = `chat-widget__bubble chat-widget__bubble--${msg.sender}`;
    if (animate) el.classList.add("animate-in");
    el.style.setProperty("--i", "0");
    const body =
      msg.sender === "bot" || msg.sender === "admin"
        ? formatBotText(msg.text)
        : msg.sender === "system"
          ? escapeHtml(msg.text)
          : escapeHtml(msg.text);
    el.innerHTML = `<small>${msg.time} · ${labelFor(msg.sender)}</small>${body}`;
    messagesEl.appendChild(el);
    scrollMessages();
  }

  function labelFor(sender) {
    if (sender === "system") return "Hệ thống";
    if (sender === "customer") return "Bạn";
    if (sender === "admin") return "Nhân viên";
    if (isEscalated) return "Nhân viên";
    return aiEnabled() ? "Trợ lý BaSau" : "basau Bot";
  }

  function setInputEnabled(enabled) {
    input.disabled = !enabled;
    const sendBtn = form?.querySelector(".chat-panel__send");
    if (sendBtn) {
      if (enabled) sendBtn.removeAttribute("disabled");
      else sendBtn.setAttribute("disabled", "");
    }
  }

  function setEscalated(active) {
    isEscalated = active;
    document.getElementById("chat-escalation-banner")?.remove();

    if (active) {
      input.placeholder = "Nhắn cho nhân viên basau...";
      setInputEnabled(true);
      startPolling();
      hideQuickReplies();
    } else {
      input.placeholder = "Nhắn tin cho Trợ lý BaSau...";
      stopPolling();
      if (!isConnectingToHuman) setInputEnabled(true);
    }

    updateChatHeader();
  }

  function trackMessage(msg) {
    const order = ctx.getOrder();
    if (order) {
      syncChatMessage(
        order.order_id,
        msg.sender,
        msg.text,
        msg.time,
        order.customer_name
      );
    }
  }

  function bumpPollCursor(messages) {
    for (const m of messages || []) {
      if (m.at) lastMessageAt = Math.max(lastMessageAt, m.at);
    }
  }

  function contextualQuickReplies(serverReplies) {
    const order = ctx.getOrder();
    if (!order) return [];

    if (serverReplies?.length && !isEscalated) {
      return serverReplies;
    }

    return buildChatQuickReplies({
      order,
      sessionMessages,
      isEscalated,
    });
  }

  function getLastConversationMessage() {
    for (let i = sessionMessages.length - 1; i >= 0; i--) {
      const m = sessionMessages[i];
      if (m.sender === "system") continue;
      return m;
    }
    return null;
  }

  /** Chỉ hiện gợi ý khi lượt trước là bot/nhân viên — không phải ngay sau tin khách. */
  function shouldShowQuickReplies() {
    if (isSending || isConnectingToHuman) return false;
    const last = getLastConversationMessage();
    if (!last) return false;
    return last.sender !== "customer";
  }

  function hideQuickReplies() {
    if (!quickRepliesEl) return;
    quickRepliesEl.innerHTML = "";
    quickRepliesEl.hidden = true;
  }

  function showQuickReplies(serverReplies) {
    if (!quickRepliesEl) return;
    quickRepliesEl.innerHTML = "";
    quickRepliesEl.hidden = true;

    if (!shouldShowQuickReplies()) return;

    const list = contextualQuickReplies(serverReplies);
    if (!list.length) return;

    quickRepliesEl.hidden = false;
    list.slice(0, 4).forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-quick-reply btn-press";
      btn.textContent = text;
      btn.addEventListener("click", () => handleUserSend(text));
      quickRepliesEl.appendChild(btn);
    });
  }

  /** Gọi sau khi isSending = false — tránh gợi ý nhảy sau tin khách. */
  function showQuickRepliesAfterTurn(serverReplies) {
    queueMicrotask(() => showQuickReplies(serverReplies));
  }

  function mergeIncomingMessages(incoming, { fromSessionEnd = false } = {}) {
    if (!fromSessionEnd && incoming?.some(isHumanSessionEndNotice) && isEscalated) {
      handleHumanSessionEnded(incoming);
      return;
    }

    for (const m of incoming) {
      if (isEscalated && m.sender === "bot") continue;
      const exists = sessionMessages.some(
        (x) => x.text === m.text && x.sender === m.sender && x.time === m.time
      );
      if (!exists) {
        const msg = { sender: m.sender, text: m.text, time: m.time };
        sessionMessages.push(msg);
        appendBubble(msg, true);
      }
    }
    bumpPollCursor(incoming);
    if (isEscalated && shouldShowQuickReplies()) {
      showQuickRepliesAfterTurn();
    }
  }

  function handleHumanSessionEnded(incoming) {
    setEscalated(false);
    isConnectingToHuman = false;
    setInputEnabled(true);
    if (incoming?.length) mergeIncomingMessages(incoming, { fromSessionEnd: true });
    showQuickRepliesAfterTurn();
    document.getElementById("chat-connecting")?.remove();
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(async () => {
      const order = ctx.getOrder();
      if (!order) return;
      const data = await pollOrderChat(order.order_id, lastMessageAt);

      if (isEscalated && !data.escalated) {
        handleHumanSessionEnded(data.messages);
        return;
      }

      if (isEscalated && data.messages?.length) {
        mergeIncomingMessages(data.messages);
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function triggerEscalation(summary) {
    const order = ctx.getOrder();
    if (!order || isEscalated || isConnectingToHuman) return;

    isConnectingToHuman = true;
    setInputEnabled(false);
    hideQuickReplies();

    const connecting = {
      sender: "system",
      text: "Đang kết nối tới nhân viên hỗ trợ",
      time: nowTime(),
    };
    sessionMessages.push(connecting);
    const connectingEl = document.createElement("div");
    connectingEl.id = "chat-connecting";
    connectingEl.className =
      "chat-widget__bubble chat-widget__bubble--system animate-in";
    connectingEl.innerHTML = `<small>${connecting.time} · ${labelFor("system")}</small>${escapeHtml(connecting.text)}`;
    messagesEl.appendChild(connectingEl);
    scrollMessages();

    await new Promise((r) => window.setTimeout(r, 1500));

    try {
      const data = await requestHumanSupport(order.order_id, summary);
      document.getElementById("chat-connecting")?.remove();
      setEscalated(true);
      bumpPollCursor(data.messages);
      if (data.messages) mergeIncomingMessages(data.messages);
    } catch (err) {
      document.getElementById("chat-connecting")?.remove();
      setEscalated(true);
      appendAdminHandoff();
      hideQuickReplies();
      console.warn("[chat] escalate:", err.message);
    } finally {
      isConnectingToHuman = false;
      if (isEscalated) setInputEnabled(true);
    }
  }

  function showOfflineHint() {
    let hint = document.getElementById("chat-offline-hint");
    if (hint || aiEnabled()) return;

    hint = document.createElement("div");
    hint.id = "chat-offline-hint";
    hint.className = "chat-offline-hint";
    hint.innerHTML =
      'Chế độ demo (rule-based). Chạy <code>npm start</code> tại <code>codebase/</code> và mở <strong>localhost:3000</strong> để test AI.';
    form.parentElement?.insertBefore(hint, form);
  }

  function showTyping(label = "basau đang gõ") {
    hideTyping();
    const el = document.createElement("div");
    el.className = "chat-widget__typing";
    el.id = "chat-typing";
    el.innerHTML = `<span class="chat-widget__typing-label">${escapeHtml(label)}</span><span class="dots"><span style="--i:0"></span><span style="--i:1"></span><span style="--i:2"></span></span>`;
    messagesEl.appendChild(el);
    scrollMessages();
  }

  function hideTyping() {
    document.getElementById("chat-typing")?.remove();
  }

  async function ensureAiSession(order) {
    if (!aiEnabled() || aiSessionId) return aiSessionId;

    const result = await initAiChat(order.order_id);
    if (result.aiEnabled && result.sessionId) {
      aiSessionId = result.sessionId;
      return aiSessionId;
    }
    throw new Error("Không tạo được phiên AI");
  }

  function rehydrateMessagesToDom() {
    messagesEl.innerHTML = "";
    sessionMessages.forEach((m) => appendBubble(m, false));
    scrollMessages();
  }

  async function loadThreadForOrder(order, { force = false } = {}) {
    await aiStatusReady;

    const newOrderId = order?.order_id ?? null;
    const orderChanged = newOrderId !== activeOrderId;

    if (!order) {
      stopPolling();
      activeOrderId = null;
      messagesEl.innerHTML = "";
      sessionMessages = [];
      botReplyCount = 0;
      updateChatHeader();
      return;
    }

    // Cùng đơn, phiên chat đã mở — không gửi lại tin chào (mở/đóng panel, render lại UI)
    if (!force && !orderChanged && sessionMessages.length > 0) {
      updateChatHeader();
      if (!messagesEl.childElementCount) {
        rehydrateMessagesToDom();
      }
      return;
    }

    stopPolling();
    messagesEl.innerHTML = "";
    botReplyCount = 0;
    sessionMessages = [];
    isEscalated = false;
    isConnectingToHuman = false;
    setEscalated(false);
    hideQuickReplies();
    document.getElementById("chat-offline-hint")?.remove();
    document.getElementById("chat-connecting")?.remove();
    setInputEnabled(true);

    if (orderChanged || force) {
      if (activeOrderId) await resetOrderChatSession(activeOrderId);
      if (newOrderId) await resetOrderChatSession(newOrderId);
      activeOrderId = newOrderId;
      lastMessageAt = 0;
      if (aiSessionId) {
        await resetAiSession(aiSessionId);
        aiSessionId = null;
      }
    } else {
      activeOrderId = newOrderId;
    }

    updateChatHeader();

    if (!aiEnabled()) {
      showOfflineHint();
      const existing = getChatByOrderId(ctx.getChats(), order.order_id);
      if (existing?.messages?.length) {
        existing.messages.forEach((m) => {
          sessionMessages.push({ ...m });
          appendBubble(m, false);
        });
        return;
      }
    }

    if (aiEnabled()) {
      showTyping("Trợ lý BaSau đang kiểm tra đơn...");
      try {
        const result = await initAiChat(order.order_id);
        hideTyping();

        if (result.aiEnabled && result.sessionId) {
          aiSessionId = result.sessionId;
          const welcome = {
            sender: "bot",
            text: result.text,
            time: nowTime(),
          };
          sessionMessages.push(welcome);
          appendBubble(welcome, false);
          trackMessage(welcome);
          if (result.escalate) {
            await triggerEscalation("Bot chuyển nhân viên khi mở chat");
          }
          showQuickRepliesAfterTurn(result.quickReplies);
          return;
        }
      } catch (err) {
        hideTyping();
        const msg = String(err.message || "");
        const isOrderMissing = /không tìm thấy đơn/i.test(msg);
        const hint = isOrderMissing
          ? "Server chưa nạp đơn mới — chạy npm run restart trong thư mục codebase."
          : "Kiểm tra OPENROUTER_API_KEY trong .env và chạy npm start.";
        appendBubble(
          {
            sender: "bot",
            text: isOrderMissing
              ? `${msg}. ${hint}`
              : `Không kết nối được AI: ${msg}. ${hint}`,
            time: nowTime(),
          },
          false
        );
        return;
      }
    }

    const welcome = {
      sender: "bot",
      text: welcomeMessage(order),
      time: nowTime(),
    };
    sessionMessages.push(welcome);
    appendBubble(welcome, false);
    trackMessage(welcome);
    showQuickRepliesAfterTurn();
  }

  function appendAdminHandoff() {
    const adminMsg = {
      sender: "admin",
      text: "Xin chào, mình là nhân viên basau — mình sẽ hỗ trợ bạn ngay.",
      time: nowTime(),
    };
    sessionMessages.push(adminMsg);
    appendBubble(adminMsg);
    trackMessage(adminMsg);
  }

  async function processCancelRequest(userText = CANCEL_REQUEST_MESSAGE) {
    const order = ctx.getOrder();
    if (!order || isSending || isConnectingToHuman) return;

    hideQuickReplies();
    isSending = true;

    const userMsg = { sender: "customer", text: userText, time: nowTime() };
    sessionMessages.push(userMsg);
    appendBubble(userMsg);
    trackMessage(userMsg);

    showTyping(aiEnabled() ? "Trợ lý BaSau đang xử lý..." : "basau đang xử lý...");

    try {
      const apiResult = await submitCancelRequest(order.order_id);
      const reply = getCancelRequestReply(order, apiResult);

      hideTyping();

      const botMsg = { sender: "bot", text: reply.text, time: nowTime() };
      sessionMessages.push(botMsg);
      appendBubble(botMsg);
      trackMessage(botMsg);

      if (apiResult?.order && ctx.onOrderUpdated) {
        ctx.onOrderUpdated(apiResult.order);
      }
    } catch (err) {
      hideTyping();
      const botMsg = {
        sender: "bot",
        text: `Không gửi được yêu cầu hủy: ${err.message}`,
        time: nowTime(),
      };
      sessionMessages.push(botMsg);
      appendBubble(botMsg);
      trackMessage(botMsg);
    } finally {
      isSending = false;
      showQuickRepliesAfterTurn();
    }
  }

  async function handleUserSend(text, options = {}) {
    const order = ctx.getOrder();
    if (!order || isSending || isConnectingToHuman) return;

    const skipUserBubble = Boolean(options.skipUserBubble);

    await syncEscalatedFromServer();

    if (isCancelRequestMessage(text) && !isEscalated) {
      if (!isOpen()) openPanel();
      await processCancelRequest(text);
      return;
    }

    if (isCancelIntentMessage(text) && !isEscalated && !aiEnabled()) {
      if (!isOpen()) openPanel();
      await processCancelRequest(CANCEL_REQUEST_MESSAGE);
      return;
    }

    hideQuickReplies();
    isSending = true;

    const wantsHuman = isExplicitHumanEscalationRequest(text);

    if (wantsHuman && !isEscalated) {
      const userMsg = { sender: "customer", text, time: nowTime() };
      sessionMessages.push(userMsg);
      appendBubble(userMsg);
      trackMessage(userMsg);
      isSending = false;
      await triggerEscalation(text);
      return;
    }

    if (isEscalated) {
      if (!skipUserBubble) {
        const userMsg = { sender: "customer", text, time: nowTime() };
        sessionMessages.push(userMsg);
        appendBubble(userMsg);
      }

      showTyping("Nhân viên đang trả lời...");
      try {
        const result = await sendCustomerHumanMessage(order.order_id, text);
        hideTyping();
        bumpPollCursor([result.message]);

        const data = await pollOrderChat(order.order_id, lastMessageAt);
        if (data.messages?.length) mergeIncomingMessages(data.messages);
      } catch (err) {
        hideTyping();
        if (err.code === "HUMAN_SESSION_ENDED") {
          isSending = false;
          handleHumanSessionEnded();
          await handleUserSend(text, { skipUserBubble: true });
          return;
        }
        const adminMsg = {
          sender: "admin",
          text: `Không gửi được tin nhắn: ${err.message}. Thử lại hoặc gọi hotline.`,
          time: nowTime(),
        };
        sessionMessages.push(adminMsg);
        appendBubble(adminMsg);
      } finally {
        isSending = false;
        showQuickRepliesAfterTurn();
      }
      return;
    }

    if (!skipUserBubble) {
      const userMsg = { sender: "customer", text, time: nowTime() };
      sessionMessages.push(userMsg);
      appendBubble(userMsg);
      trackMessage(userMsg);
    }

    showTyping(aiEnabled() ? "Trợ lý BaSau đang trả lời..." : "basau đang gõ...");

    let chipsAfterReply;
    try {
      if (aiEnabled()) {
        await ensureAiSession(order);
        const reply = await sendAiMessage(aiSessionId, text);
        hideTyping();

        if (reply.escalate || reply.silent) {
          isSending = false;
          await triggerEscalation(text);
          return;
        }

        if (reply.text?.trim()) {
          const botMsg = { sender: "bot", text: reply.text, time: nowTime() };
          sessionMessages.push(botMsg);
          appendBubble(botMsg);
          trackMessage(botMsg);
        }

        if (reply.order && ctx.onOrderUpdated) {
          ctx.onOrderUpdated(reply.order);
        }

        chipsAfterReply = reply.quickReplies;
      } else {
        hideTyping();
        const reply = getBotReply(order, text, botReplyCount);
        botReplyCount += 1;

        const botMsg = { sender: "bot", text: reply.text, time: nowTime() };
        sessionMessages.push(botMsg);
        appendBubble(botMsg);
        trackMessage(botMsg);

        if (reply.escalate) {
          isSending = false;
          await triggerEscalation(text);
          return;
        }
      }
    } catch (err) {
      hideTyping();
      console.warn("[chat]", err.message);
      const botMsg = {
        sender: "bot",
        text: pickApiErrorReply(botReplyCount),
        time: nowTime(),
      };
      botReplyCount += 1;
      sessionMessages.push(botMsg);
      appendBubble(botMsg);
      trackMessage(botMsg);
    } finally {
      isSending = false;
      showQuickRepliesAfterTurn(chipsAfterReply);
    }
  }

  fab.addEventListener("click", () => {
    if (isOpen()) closePanel();
    else openPanel();
  });

  closeBtn?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    handleUserSend(text);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closePanel();
  });

  return {
    refresh(options = {}) {
      loadThreadForOrder(ctx.getOrder(), options);
    },
    updateHeader() {
      updateChatHeader();
    },
    async escalate(summary) {
      await triggerEscalation(summary || "Khách bấm Gặp nhân viên hỗ trợ");
    },
    async requestCancelOrder() {
      if (!isOpen()) openPanel();
      await processCancelRequest(CANCEL_REQUEST_MESSAGE);
    },
  };
}
