import { resolveApiBase } from "./geminiClient.js";

function apiUrl(path) {
  return `${cachedBase ?? ""}${path}`;
}

let cachedBase;

async function ensureBase() {
  if (cachedBase === undefined) {
    cachedBase = await resolveApiBase();
  }
  return cachedBase;
}

export async function syncChatMessage(orderId, sender, text, time, customerName) {
  await ensureBase();
  try {
    await fetch(apiUrl("/api/chat/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, sender, text, time, customerName }),
    });
  } catch {
    // offline demo
  }
}

export async function resetOrderChatSession(orderId) {
  await ensureBase();
  try {
    const res = await fetch(apiUrl("/api/chat/order/reset"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    if (!res.ok) return { ok: false };
    return res.json();
  } catch {
    return { ok: false };
  }
}

export async function requestHumanSupport(orderId, summary) {
  await ensureBase();
  const res = await fetch(apiUrl("/api/chat/escalate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, summary }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Không chuyển được nhân viên");
  return data;
}

export async function sendCustomerHumanMessage(orderId, message) {
  await ensureBase();
  const res = await fetch(apiUrl("/api/chat/human/send"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, message }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Không gửi được tin nhắn");
    if (res.status === 409 || data.useBot) {
      err.code = "HUMAN_SESSION_ENDED";
    }
    throw err;
  }
  return data;
}

export async function pollOrderChat(orderId, sinceAt = 0) {
  await ensureBase();
  try {
    const res = await fetch(
      apiUrl(`/api/chat/poll?orderId=${encodeURIComponent(orderId)}&since=${sinceAt}`)
    );
    if (!res.ok) return { messages: [], escalated: false };
    return res.json();
  } catch {
    return { messages: [], escalated: false };
  }
}

export async function fetchAdminOverview() {
  await ensureBase();
  const res = await fetch(apiUrl("/api/admin/overview"));
  if (!res.ok) throw new Error("Không tải overview admin");
  return res.json();
}

export async function fetchAdminOrderChat(orderId) {
  await ensureBase();
  const res = await fetch(apiUrl(`/api/admin/orders/${encodeURIComponent(orderId)}/chat`));
  if (!res.ok) throw new Error("Không tải chat đơn");
  return res.json();
}

export async function sendAdminMessage(orderId, message) {
  await ensureBase();
  const res = await fetch(apiUrl("/api/admin/chat/send"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Không gửi được tin nhắn");
  return data;
}

export async function endAdminConversation(orderId) {
  await ensureBase();
  const res = await fetch(apiUrl("/api/admin/chat/end"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Không kết thúc được phiên chat");
  return data;
}

export async function fetchAdminNotifications() {
  await ensureBase();
  const res = await fetch(apiUrl("/api/admin/notifications"));
  if (!res.ok) return { notifications: [], unreadCount: 0 };
  return res.json();
}
