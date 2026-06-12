/**
 * 5 trạng thái timeline UI (tiếng Việt, khớp deliveryJourney).
 */

export const STATUS = {
  ORDERED: "đã đặt hàng",
  CONFIRMED: "đã xác nhận",
  PREPARING: "đang chuẩn bị",
  DELIVERING: "đang giao",
  COMPLETED: "hoàn thành",
  CANCELLED: "đã hủy",
};

/** Map legacy English status (nếu còn trong cache cũ). */
const LEGACY_STATUS = {
  placed: STATUS.ORDERED,
  pending_merchant: STATUS.ORDERED,
  confirmed: STATUS.CONFIRMED,
  searching_driver: STATUS.PREPARING,
  food_ready: STATUS.PREPARING,
  preparing: STATUS.PREPARING,
  support_escalated: STATUS.PREPARING,
  picked_up: STATUS.DELIVERING,
  delivering: STATUS.DELIVERING,
  delivered: STATUS.COMPLETED,
  completed: STATUS.COMPLETED,
  cancelled: STATUS.CANCELLED,
};

export function normalizeStatus(status) {
  if (!status) return STATUS.ORDERED;
  const raw = String(status).trim().toLowerCase();
  const values = Object.values(STATUS);
  if (values.includes(raw)) return raw;
  return LEGACY_STATUS[status] ?? LEGACY_STATUS[raw] ?? STATUS.ORDERED;
}

/** @returns {0|1|2|3|4} */
export function statusStepIndex(status) {
  const s = normalizeStatus(status);
  if (s === STATUS.ORDERED) return 0;
  if (s === STATUS.CONFIRMED) return 1;
  if (s === STATUS.PREPARING) return 2;
  if (s === STATUS.DELIVERING) return 3;
  if (s === STATUS.COMPLETED) return 4;
  return 0;
}

export function isPreparingStatus(status) {
  return normalizeStatus(status) === STATUS.PREPARING;
}

export function isDeliveringStatus(status) {
  return normalizeStatus(status) === STATUS.DELIVERING;
}

export function isCompletedStatus(status) {
  return normalizeStatus(status) === STATUS.COMPLETED;
}

export function isCancelledStatus(status) {
  return normalizeStatus(status) === STATUS.CANCELLED;
}

/** Màu UI customer theo giai đoạn timeline — không dùng risk_level. */
export function getOrderStatusTier(orderOrStatus) {
  const status =
    typeof orderOrStatus === "string"
      ? normalizeStatus(orderOrStatus)
      : normalizeStatus(orderOrStatus?.status);

  if (status === STATUS.COMPLETED) return "green";
  if (status === STATUS.CANCELLED) return "cancelled";
  if (status === STATUS.ORDERED) return "white";
  if (status === STATUS.CONFIRMED) return "orange";
  if (status === STATUS.PREPARING || status === STATUS.DELIVERING) return "yellow";
  return "white";
}

export function getStatusTierBannerClass(tier) {
  return (
    {
      white: "recovery-card__banner--ordered",
      orange: "recovery-card__banner--confirmed",
      yellow: "recovery-card__banner--active",
      green: "recovery-card__banner--success",
      cancelled: "recovery-card__banner--cancelled",
    }[tier] || ""
  );
}

export function getStatusTierBadgeClass(tier) {
  return (
    {
      white: "badge--status-white",
      orange: "badge--status-orange",
      yellow: "badge--status-yellow",
      green: "badge--green",
      cancelled: "badge--status-cancelled",
    }[tier] || "badge--status-white"
  );
}
