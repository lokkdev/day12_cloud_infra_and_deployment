/**
 * AI explanation stub — thay bằng gọi API thật tại checkpoint AI flow.
 */

import { matchesReason, REASON } from "./reasonCodes.js";
import {
  isCancelledStatus,
  isCompletedStatus,
  isDeliveringStatus,
  isPreparingStatus,
  normalizeStatus,
  STATUS,
} from "./orderStatus.js";

/**
 * Layout customer: completed | cancelled | recovery | warning | in_progress
 * Màu banner theo status — view type chỉ quyết định nội dung / nút hành động.
 */
export function getCustomerViewType(order) {
  const status = normalizeStatus(order.status);
  if (isCompletedStatus(status)) return "completed";
  if (isCancelledStatus(status)) return "cancelled";
  if (order.risk_level === "Red") return "recovery";
  if (order.risk_level === "Yellow") return "warning";
  return "in_progress";
}

export function buildCustomerMessage(order) {
  const view = getCustomerViewType(order);
  const status = normalizeStatus(order.status);

  if (view === "completed") {
    return "Cảm ơn bạn đã sử dụng dịch vụ, vui lòng đánh giá đơn và để lại góp ý của bạn để cải thiện hệ thống của chúng tôi.";
  }

  if (view === "cancelled") {
    return "Đơn của bạn đã được hủy. Nếu đã thanh toán trước, hoàn tiền sẽ về trong 1–3 ngày làm việc.";
  }

  if (view === "in_progress") {
    if (status === STATUS.ORDERED) {
      return order.is_cancelable
        ? "Đơn đã ghi nhận — đang chờ quán xác nhận. Bạn có thể chỉnh sửa đơn hoặc hủy theo chính sách basau."
        : "Đơn đã ghi nhận — đang chờ quán xác nhận. Bạn có thể chỉnh sửa ghi chú cho quán.";
    }
    if (status === STATUS.CONFIRMED) {
      return "Quán đã xác nhận đơn — món sẽ được chuẩn bị trong thời gian sớm nhất.";
    }
    if (isPreparingStatus(status)) {
      return "Quán đang chuẩn bị món cho bạn. Mình sẽ báo khi tài xế nhận đơn.";
    }
    if (isDeliveringStatus(status)) {
      return "Tài xế đang giao hàng tới bạn — vui lòng giữ điện thoại để liên hệ.";
    }
    return "Đơn của bạn đang được xử lý.";
  }

  if (view === "warning") {
    let reason = "đơn đang được theo dõi";
    if (matchesReason(order, REASON.NO_DRIVER_TIMEOUT)) {
      reason = "chưa có tài xế nhận đơn";
    } else if (matchesReason(order, REASON.STACK_TOO_DEEP)) {
      reason = "khu vực giao hàng đang đông";
    } else if (matchesReason(order, REASON.FOOD_READY_TOO_LONG)) {
      reason = "đồ ăn đã chờ lâu hơn dự kiến";
    }
    return `Đơn của bạn đang chậm vì ${reason}. Hệ thống đang ưu tiên xử lý — bạn có thể tiếp tục đợi hoặc liên hệ nhân viên nếu cần.`;
  }

  let reason = order.reason_code
    ? String(order.reason_code).toLowerCase()
    : "hệ thống chưa xử lý kịp";
  if (matchesReason(order, REASON.NO_DRIVER_TIMEOUT)) {
    reason = "chưa tìm được tài xế phù hợp";
  } else if (matchesReason(order, REASON.STACK_TOO_DEEP)) {
    reason = "tài xế khu vực đang quá tải";
  } else if (matchesReason(order, REASON.FOOD_READY_TOO_LONG)) {
    reason = "đồ ăn đã chờ quá lâu";
  } else if (matchesReason(order, REASON.MERCHANT_CLOSING)) {
    reason = "quán sắp đóng cửa";
  } else if (matchesReason(order, REASON.PAYMENT_STATE_MISMATCH)) {
    reason = "cần xác minh thanh toán";
  } else if (matchesReason(order, REASON.HUMAN_SUPPORT_REQUIRED)) {
    reason = "cần hỗ trợ chuyên sâu";
  }

  const waitHint =
    status === STATUS.ORDERED && order.is_cancelable
      ? "Bạn có quyền hủy đơn và hoàn tiền theo chính sách basau."
      : isPreparingStatus(status) || isDeliveringStatus(status)
        ? "Đơn không thể hủy tự động lúc này — bấm «Gặp nhân viên hỗ trợ» nếu cần."
        : "Nhân viên sẽ liên hệ nếu cần thêm thao tác.";

  return `Đơn của bạn đang gặp sự cố vì ${reason}. ${waitHint}`;
}

export function getBannerTag(order) {
  const status = normalizeStatus(order.status);
  if (isCompletedStatus(status)) return "Đã giao";
  if (isCancelledStatus(status)) return "Đã hủy";
  if (status === STATUS.ORDERED) return "Chờ xác nhận";
  if (status === STATUS.CONFIRMED) return "Đã xác nhận";
  if (isPreparingStatus(status)) return "Đang chuẩn bị";
  if (isDeliveringStatus(status)) return "Đang giao";
  return "basau Food";
}
