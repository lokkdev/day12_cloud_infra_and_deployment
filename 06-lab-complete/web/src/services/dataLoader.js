/**
 * Load mock data from data/data.json (requires local HTTP server).
 */
export async function loadData() {
  const res = await fetch("/data/data.json");
  if (!res.ok) {
    throw new Error(`Không load được data.json (${res.status})`);
  }
  return res.json();
}

export function getChatByOrderId(chats, orderId) {
  return chats.find((c) => c.order_id === orderId) ?? null;
}

export function getDriverById(drivers, driverId) {
  if (!driverId) return null;
  return drivers.find((d) => d.driver_id === driverId) ?? null;
}

export function sortOrdersByRisk(orders) {
  const rank = { Red: 0, Yellow: 1, Green: 2 };
  return [...orders].sort(
    (a, b) => (rank[a.risk_level] ?? 9) - (rank[b.risk_level] ?? 9)
  );
}
