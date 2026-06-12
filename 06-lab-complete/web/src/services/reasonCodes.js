/** Mã lý do nghiệp vụ — giá trị tiếng Việt (lưu thẳng trong data.json). */

export const REASON = {
  STACK_TOO_DEEP: "Tài xế ghép quá nhiều đơn",
  NO_DRIVER_TIMEOUT: "Chưa có tài xế quá ngưỡng",
  FOOD_READY_TOO_LONG: "Đồ ăn chờ quá lâu sau khi quán làm xong",
  MERCHANT_CLOSING: "Quán sắp đóng cửa",
  PAYMENT_STATE_MISMATCH: "Lệch trạng thái thanh toán",
  HUMAN_SUPPORT_REQUIRED: "Cần hỗ trợ người thật",
};

const LEGACY_REASON = {
  STACK_TOO_DEEP: REASON.STACK_TOO_DEEP,
  NO_DRIVER_TIMEOUT: REASON.NO_DRIVER_TIMEOUT,
  FOOD_READY_TOO_LONG: REASON.FOOD_READY_TOO_LONG,
  MERCHANT_CLOSING: REASON.MERCHANT_CLOSING,
  PAYMENT_STATE_MISMATCH: REASON.PAYMENT_STATE_MISMATCH,
  HUMAN_SUPPORT_REQUIRED: REASON.HUMAN_SUPPORT_REQUIRED,
};

export function normalizeReasonCode(code) {
  if (!code) return null;
  if (LEGACY_REASON[code]) return LEGACY_REASON[code];
  return String(code);
}

export function matchesReason(order, ...reasons) {
  const code = normalizeReasonCode(order?.reason_code);
  return reasons.some((r) => normalizeReasonCode(r) === code);
}
