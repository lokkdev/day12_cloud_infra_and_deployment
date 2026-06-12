/**
 * Luồng hủy đơn theo giai đoạn timeline (status tiếng Việt).
 */

import {
  STATUS,
  isCancelledStatus,
  isCompletedStatus,
  isDeliveringStatus,
  isPreparingStatus,
  normalizeStatus,
} from "./orderStatus.js";

export const CANCEL_REQUEST_MESSAGE = "Yêu cầu hủy đơn và hoàn tiền";

export function isCancelRequestMessage(text) {
  return (
    isCancelIntentMessage(text) ||
    /yêu cầu hủy đơn|hủy đơn\s*&\s*hoàn tiền|muốn hủy đơn.*hoàn/i.test(
      String(text || "")
    )
  );
}

export function isCancelIntentMessage(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!/hủy|huỷ|cancel/.test(t)) return false;
  if (/tại sao|không hủy|chưa hủy|vì sao|lý do|sao lại/.test(t)) return false;
  return true;
}

export function isCancelConfirmMessage(text) {
  const t = String(text || "").trim().toLowerCase();
  return (
    /^(có|ok|đồng ý|xác nhận|đúng rồi|uh|yes|y|ừ)$/i.test(t) ||
    /^có[,.!\s]*$/i.test(t)
  );
}

export function canAutoCancelOrder(order) {
  return getCancelJourneyPhase(order) === "ordered";
}

/** @returns {"ordered"|"confirmed"|"preparing"|"delivering"|"finished"|"cancelled"|"unknown"} */
export function getCancelJourneyPhase(order) {
  if (!order?.status) return "unknown";
  const status = normalizeStatus(order.status);

  if (isCancelledStatus(status)) return "cancelled";
  if (isCompletedStatus(status)) return "finished";
  if (isDeliveringStatus(status)) return "delivering";
  if (isPreparingStatus(status)) return "preparing";
  if (status === STATUS.CONFIRMED) return "confirmed";
  if (status === STATUS.ORDERED) return "ordered";

  return "unknown";
}

export function getCancelRequestReply(order, apiResult = null) {
  if (apiResult?.message) {
    return {
      text: apiResult.message,
      outcome: apiResult.outcome,
      requiresAdmin: Boolean(apiResult.requiresAdmin),
      orderUpdated: Boolean(apiResult.order),
    };
  }

  const phase = getCancelJourneyPhase(order);
  const id = order?.order_id || "đơn của bạn";

  switch (phase) {
    case "ordered":
      return {
        text: `Đơn ${id} đang ở bước «Đã đặt hàng» — mình sẽ hủy ngay và hoàn tiền trong 1–3 ngày làm việc.`,
        outcome: "cancelled",
        expectsApi: true,
      };
    case "confirmed":
      return {
        text: `Đơn ${id} đã được quán xác nhận. Yêu cầu hủy của bạn đã ghi nhận — admin basau sẽ duyệt trong ít phút, mình sẽ báo lại qua chat.`,
        outcome: "pending_review",
        requiresAdmin: true,
        expectsApi: true,
      };
    case "preparing":
      return {
        text: `Rất tiếc, đơn ${id} không thể hủy lúc này vì quán đang chuẩn bị món. Bạn bấm «Gặp nhân viên hỗ trợ» nếu cần xử lý gấp.`,
        outcome: "rejected",
      };
    case "delivering":
      return {
        text: `Rất tiếc, đơn ${id} không thể hủy vì đang được giao. Nếu có sự cố, bạn liên hệ nhân viên để được hỗ trợ.`,
        outcome: "rejected",
      };
    case "finished":
      return {
        text: `Đơn ${id} đã hoàn thành — không thể hủy. Bạn có thể gửi khiếu nại hoặc đánh giá nếu cần.`,
        outcome: "rejected",
      };
    case "cancelled":
      return {
        text: `Đơn ${id} đã được hủy trước đó.`,
        outcome: "cancelled",
      };
    default:
      return {
        text: "Mình chưa xác định được trạng thái đơn. Bạn thử lại hoặc gặp nhân viên hỗ trợ.",
        outcome: "unknown",
      };
  }
}
