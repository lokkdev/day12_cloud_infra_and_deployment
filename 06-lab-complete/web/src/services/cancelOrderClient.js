import { resolveApiBase } from "./geminiClient.js";

export async function submitCancelRequest(orderId) {
  const base = await resolveApiBase();

  try {
    const res = await fetch(`${base}/api/orders/cancel-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customerConfirmed: true,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
