import { buildDeliveryJourney } from "./deliveryJourney.js";
import { isCancelledStatus, isCompletedStatus } from "./orderStatus.js";

const ITEM_BY_MERCHANT = {
  "Bún Đậu Mắm Tôm ": "Bún đậu mắm tôm đầy đủ",
  "Cơm Tấm Sài Gòn": "Cơm tấm sườn bì chả",
  "Pizza 4P's Lê Đại Hành": "Pizza Teriyoka M",
  "Phở Thìn Bò": "Phở bò tái nạm",
  "Bánh Mì Hồng Hoa": "Bánh mì thịt nướng",
  "Lẩu Thái Tom Yum": "Lẩu Tom Yum 2 người",
  "Cafe Highlands Nguyễn Huệ": "Trà đào cam sả + croissant",
  "Trà Sữa Gong Cha": "Trà sữa trân châu đường đen",
  "Gà Rán KFC Vincom": "Combo gà rán 2 người",
  "Bún Chả Hà Nội 36": "Bún chả đặc biệt",
};

export function formatVnd(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function demoTotal(order) {
  if (order.total_amount != null) return Number(order.total_amount);
  const n = parseInt(String(order.order_id).replace(/\D/g, ""), 10) || 1;
  return 52000 + n * 3300;
}

export function getOrderItemLine(order) {
  const item =
    order.item_name ||
    order.items_summary ||
    ITEM_BY_MERCHANT[order.merchant_name] ||
    order.merchant_name;
  return `${item} · ${formatVnd(demoTotal(order))}`;
}

/** Một dòng trạng thái trên banner — khớp mốc đang active trên timeline (5 bước). */
export function getOrderDetailStatus(order) {
  const journey = buildDeliveryJourney(order);

  if (isCancelledStatus(journey.status)) {
    return "Đã hủy";
  }

  const active = journey.steps.find((s) => s.state === "active");
  if (active) {
    return active.label;
  }

  if (isCompletedStatus(journey.status)) {
    return "Hoàn thành";
  }

  return journey.steps[journey.currentIndex]?.label ?? "—";
}
