let cachedApiBase = undefined;

async function probeBase(base) {
  const url = `${base}/api/chat/status`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (typeof data.aiEnabled !== "boolean") return null;
  return { base, ...data };
}

/** Tìm backend AI (cùng origin hoặc localhost:3000). */
export async function resolveApiBase() {
  if (cachedApiBase !== undefined) return cachedApiBase;

  const candidates = [""];
  const host = window.location.hostname || "localhost";
  if (window.location.port !== "3000") {
    candidates.push(`http://${host}:3000`);
  }

  for (const base of candidates) {
    try {
      const status = await probeBase(base);
      if (status) {
        cachedApiBase = base;
        return base;
      }
    } catch {
      // thử candidate tiếp theo
    }
  }

  cachedApiBase = "";
  return "";
}

function apiUrl(path) {
  return `${cachedApiBase ?? ""}${path}`;
}

export async function fetchAiStatus() {
  try {
    await resolveApiBase();
    const res = await fetch(apiUrl("/api/chat/status"));
    if (!res.ok) return { aiEnabled: false };
    return res.json();
  } catch {
    return { aiEnabled: false };
  }
}

export async function initAiChat(orderId) {
  await resolveApiBase();
  const res = await fetch(apiUrl("/api/chat/init"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (data.text && data.apiError) return data;
    throw new Error(data.error || "Không khởi tạo được chat AI");
  }
  return data;
}

export async function sendAiMessage(sessionId, message) {
  await resolveApiBase();
  const res = await fetch(apiUrl("/api/chat/message"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (data.text && data.apiError) return data;
    throw new Error(data.error || "Không gửi được tin nhắn");
  }
  return data;
}

export async function resetAiSession(sessionId) {
  if (!sessionId) return;
  try {
    await resolveApiBase();
    await fetch(apiUrl("/api/chat/reset"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // ignore
  }
}
