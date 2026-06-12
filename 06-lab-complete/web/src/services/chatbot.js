import { getCustomerViewType } from "./aiExplain.js";
import {
  getCancelJourneyPhase,
  getCancelRequestReply,
  isCancelConfirmMessage,
  isCancelIntentMessage,
} from "./cancelRequestFlow.js";
import { isExplicitHumanEscalationRequest } from "./humanSupportRequest.js";
import { matchesReason, REASON } from "./reasonCodes.js";

let pendingCancelConfirm = false;

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function welcomeMessage(order) {
  const view = getCustomerViewType(order);
  if (view === "completed") {
    return "Xin chào! Đơn của bạn đã hoàn tất. Bạn cần hỗ trợ thêm về đánh giá hoặc hoá đơn không?";
  }
  if (view === "warning") {
    return `Xin chào! Mình là trợ lý basau. Đơn ${order.order_id} đang được ưu tiên — bạn muốn hỏi về thời gian giao hay hủy đơn?`;
  }
  return `Xin chào! Mình thấy đơn ${order.order_id} đang cần hỗ trợ recovery. Bạn có thể hỏi về hủy đơn, hoàn tiền hoặc gặp nhân viên.`;
}

export function getBotReply(order, userText, priorBotCount) {
  const text = userText.toLowerCase();
  const view = getCustomerViewType(order);

  if (isExplicitHumanEscalationRequest(userText)) {
    if (view === "recovery" || matchesReason(order, REASON.HUMAN_SUPPORT_REQUIRED)) {
      return {
        text: "Mình đang chuyển bạn sang nhân viên hỗ trợ. Vui lòng không đóng cửa sổ chat.",
        escalate: true,
      };
    }
    return {
      text: "Bạn có thể bấm «Gặp nhân viên hỗ trợ» trên màn hình đơn, hoặc tiếp tục chat tại đây.",
      escalate: false,
    };
  }

  if (/hotline/.test(text)) {
    return {
      text: "Hotline basau: 1900 6363 (8h–22h). Bạn cần gặp nhân viên trực tiếp thì bấm «Gặp nhân viên hỗ trợ» trên màn hình đơn.",
      escalate: false,
    };
  }

  if (isCancelConfirmMessage(userText) && pendingCancelConfirm) {
    pendingCancelConfirm = false;
    const reply = getCancelRequestReply(order);
    return { text: reply.text, escalate: false };
  }

  if (isCancelIntentMessage(userText) || isCancelRequestMessage(userText)) {
    const phase = getCancelJourneyPhase(order);
    if (phase === "ordered") {
      pendingCancelConfirm = true;
      return {
        text: `Bạn xác nhận muốn hủy đơn ${order.order_id} phải không? Nếu hủy, bạn sẽ được hoàn lại toàn bộ số tiền đã thanh toán.`,
        escalate: false,
      };
    }
    pendingCancelConfirm = false;
    const reply = getCancelRequestReply(order);
    return { text: reply.text, escalate: false };
  }

  if (text.includes("hoàn")) {
    return {
      text: "Bạn muốn hoàn tiền đơn nào? Gửi «Yêu cầu hủy đơn và hoàn tiền» hoặc bấm nút trên màn hình đơn để mình kiểm tra theo trạng thái đơn nhé.",
      escalate: false,
    };
  }

  if (text.includes("trễ") || text.includes("tài xế") || text.includes("giao")) {
    if (view === "completed") {
      return {
        text: "Đơn đã giao xong. Nếu vẫn có vấn đề, bạn mô tả thêm để mình ghi nhận góp ý nhé.",
        escalate: false,
      };
    }
    return {
      text: `Đơn ${order.order_id} (${order.risk_level}): hệ thống đang theo dõi và ưu tiên xử lý. Bạn đã chờ bao lâu rồi?`,
      escalate: false,
    };
  }

  if (priorBotCount >= 2 && view === "recovery") {
    return {
      text: "Mình chưa giải quyết được hết. Để mình kết nối nhân viên basau hỗ trợ bạn ngay.",
      escalate: true,
    };
  }

  return {
    text: "Cảm ơn bạn đã nhắn. Mình đã ghi nhận và sẽ phản hồi theo chính sách basau trong giây lát.",
    escalate: false,
  };
}

export { nowTime };
