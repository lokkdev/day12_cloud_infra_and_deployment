/**
 * Quick replies theo ngữ cảnh hội thoại (client + server).
 */

import { getCustomerViewType } from "./aiExplain.js";
import { STATUS } from "./orderStatus.js";

const CASE_PATTERNS = [
  { re: /hủy|huỷ|cancel/i, intent: "CANCEL", chips: ["Hủy đơn & hoàn tiền", "Tại sao chưa hủy được?", "Gặp nhân viên hỗ trợ"] },
  { re: /hoàn|refund|tiền về/i, intent: "REFUND", chips: ["Hoàn tiền bao lâu?", "Đã trừ tiền nhưng app báo chưa thanh toán", "Gửi ảnh giao dịch"] },
  { re: /trễ|chậm|lâu|đợi|30 phút|20 phút/i, intent: "DELAY", chips: ["Đơn của tôi đến đâu rồi?", "Tại sao đơn bị chậm?", "Tiếp tục đợi thêm 10 phút"] },
  { re: /tài xế|shipper|driver/i, intent: "DRIVER", chips: ["Tài xế còn bao lâu tới?", "Tài xế đã tới quán chưa?", "Đổi tài xế được không?"] },
  { re: /quán|merchant|món|đóng cửa/i, intent: "MERCHANT", chips: ["Gọi quán giúp mình", "Quán còn mở không?", "Sửa ghi chú món"] },
  { re: /thanh toán|trừ tiền|mismatch|chưa thanh toán/i, intent: "PAYMENT", chips: ["Mình đã bị trừ tiền rồi", "Gặp nhân viên xử lý thanh toán", "Kiểm tra lại trạng thái thanh toán"] },
  { re: /nhân viên|người thật|hotline/i, intent: "HUMAN", chips: ["Gặp nhân viên hỗ trợ", "Hotline basau là gì?"] },
  { re: /sửa|đổi|chỉnh|thêm món|bớt/i, intent: "EDIT_ORDER", chips: ["Chỉnh sửa đơn", "Quán đã xác nhận chưa?", "Thêm ghi chú cho quán"] },
  { re: /ở đâu|tiến độ|đến đâu|tracking|bản đồ/i, intent: "STATUS", chips: ["Đơn của tôi đến đâu rồi?", "Xem tiến độ giao hàng", "ETA còn bao lâu?"] },
  { re: /voucher|ưu đãi|giảm giá/i, intent: "VOUCHER", chips: ["Có voucher bồi thường không?", "Áp mã giảm đơn sau"] },
  { re: /sai món|thiếu|đổ|hỏng/i, intent: "QUALITY", chips: ["Món giao sai / thiếu", "Gửi ảnh đơn hàng", "Hoàn tiền món lỗi"] },
  { re: /cảm ơn|ok|được rồi|ổn/i, intent: "CLOSING", chips: ["Không cần thêm, cảm ơn", "Đánh giá dịch vụ"] },
  { re: /đánh giá|sao|feedback/i, intent: "RATING", chips: ["Mình muốn gửi đánh giá", "Góp ý về tài xế"] },
];

const BY_RISK = {
  Green: ["Đơn của tôi đến đâu rồi?", "Tài xế còn bao lâu tới?", "Liên hệ quán"],
  Yellow: ["Tại sao đơn bị chậm?", "Tiếp tục đợi", "Hủy đơn & hoàn tiền"],
  Red: ["Hủy đơn & hoàn tiền", "Gặp nhân viên hỗ trợ", "Đơn của tôi đến đâu rồi?"],
};

const BY_STATUS = {
  [STATUS.ORDERED]: ["Chỉnh sửa đơn", "Quán xác nhận chưa?", "Hủy đơn & hoàn tiền"],
  [STATUS.CONFIRMED]: ["Quán đang làm món", "Tài xế còn bao lâu nhận đơn?"],
  [STATUS.PREPARING]: ["Sao chưa có tài xế?", "Tiếp tục chờ thêm", "Gặp nhân viên hỗ trợ"],
  [STATUS.DELIVERING]: ["Còn bao lâu tới nhà?", "Gọi tài xế giúp mình"],
  [STATUS.COMPLETED]: ["Mình muốn gửi đánh giá", "Kiểm tra hoá đơn"],
};

const FOLLOW_UP_QUESTIONS = {
  CANCEL: ["Hủy xong hoàn tiền trong mấy ngày?", "Có mất phí hủy không?"],
  REFUND: ["Hoàn về ví hay thẻ?", "Cần gửi thêm giấy tờ không?"],
  DELAY: ["Có voucher bồi thường không?", "Ưu tiên tài xế được không?"],
  DRIVER: ["Tài xế ghép mấy đơn?", "Đổi tài xế được không?"],
  MERCHANT: ["Số điện thoại quán?", "Quán sắp đóng cửa phải không?"],
  PAYMENT: ["Ai xử lý case thanh toán?", "Mình cần gửi ảnh bill"],
  STATUS: ["Xem bản đồ giao hàng", "ETA cập nhật lúc nào?"],
  GENERAL: ["Đơn của tôi đến đâu rồi?", "Cần hỗ trợ thêm gì?"],
};

function matchIntent(text) {
  for (const p of CASE_PATTERNS) {
    if (p.re.test(text)) return p.intent;
  }
  return "GENERAL";
}

function uniqueSlice(list, max = 4) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = item.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= max) return out;
  }
  return out;
}

function getLastTurn(sessionMessages = []) {
  let lastUser = "";
  let lastAgent = "";
  for (let i = sessionMessages.length - 1; i >= 0; i--) {
    const m = sessionMessages[i];
    if (!m?.text || m.sender === "system") continue;
    if (m.sender === "customer" && !lastUser) lastUser = m.text;
    if ((m.sender === "bot" || m.sender === "admin") && !lastAgent) lastAgent = m.text;
    if (lastUser && lastAgent) break;
  }
  return { lastUser, lastAgent };
}

function inferSessionLog(sessionMessages = []) {
  const prefs = {
    wants_fast_cancel: false,
    asks_human_often: false,
    payment_sensitive: false,
  };
  for (const m of sessionMessages) {
    if (m.sender !== "customer") continue;
    const t = m.text || "";
    if (/hủy|huỷ|cancel/i.test(t)) prefs.wants_fast_cancel = true;
    if (/nhân viên|người thật|hotline/i.test(t)) prefs.asks_human_often = true;
    if (/thanh toán|trừ tiền|mismatch/i.test(t)) prefs.payment_sensitive = true;
  }
  return { preferences: prefs };
}

function humanContextChips(lastUser, lastAgent) {
  const u = lastUser.toLowerCase();
  const a = lastAgent.toLowerCase();

  if (/cảm ơn|thank|ok rồi|ổn rồi/.test(u)) {
    return ["Không cần thêm, cảm ơn", "Đánh giá dịch vụ", "Đơn của tôi đến đâu rồi?"];
  }

  if (
    /hủy|hoàn/i.test(u) ||
    /không thể hủy|admin.*duyệt|chuẩn bị món|đang được giao/.test(a)
  ) {
    return [
      "Tại sao không hủy được?",
      "Hoàn tiền bao lâu?",
      "Cho mình biết tiến độ đơn",
      "Cảm ơn nhân viên",
    ];
  }

  if (/tiến độ|đến đâu|tài xế|trễ|chậm/.test(u)) {
    return [
      "Tài xế còn bao lâu?",
      "Tại sao đơn bị chậm?",
      "Có voucher bồi thường không?",
      "Cảm ơn nhân viên",
    ];
  }

  if (/thanh toán|trừ tiền|hoàn/.test(u) || /thanh toán|mismatch/.test(a)) {
    return [
      "Hoàn tiền bao lâu?",
      "Mình đã bị trừ tiền rồi",
      "Gửi ảnh giao dịch",
      "Cảm ơn nhân viên",
    ];
  }

  if (lastAgent && !lastUser) {
    return [
      "Cho mình biết tiến độ đơn",
      "Mình muốn hủy đơn",
      "Vấn đề thanh toán",
      "Cảm ơn nhân viên",
    ];
  }

  return [
    "Cho mình biết tiến độ đơn",
    "Mình muốn hủy đơn",
    "Tài xế còn bao lâu?",
    "Cảm ơn nhân viên",
  ];
}

export function suggestConversationNextSteps(ctx) {
  const {
    order = {},
    risk = {},
    lastUserMessage = "",
    sessionLog = {},
    botReplyText = "",
  } = ctx;

  const intent = matchIntent(`${lastUserMessage} ${botReplyText}`);
  const prefs = sessionLog.preferences || {};
  const chips = [];

  const pattern = CASE_PATTERNS.find((p) => p.intent === intent);
  if (pattern) chips.push(...pattern.chips);

  const statusKey = order.status;
  if (BY_STATUS[statusKey]) chips.push(...BY_STATUS[statusKey]);
  if (BY_RISK[order.risk_level]) chips.push(...BY_RISK[order.risk_level]);

  if (!order.merchant_confirmed && order.can_edit_order) {
    chips.push("Chỉnh sửa đơn", "Quán xác nhận chưa?");
  }

  if (order.payment_state === "mismatch") {
    chips.push("Gặp nhân viên xử lý thanh toán");
  }

  if (prefs.wants_fast_cancel) chips.push("Hủy đơn ngay giúp mình");
  if (prefs.asks_human_often) chips.push("Gặp nhân viên hỗ trợ");
  if (prefs.payment_sensitive) chips.push("Kiểm tra lại thanh toán");

  if (risk.view_type === "recovery") chips.push("Gặp nhân viên hỗ trợ");
  if (order.is_cancelable) chips.push("Hủy đơn & hoàn tiền");

  const followUps = FOLLOW_UP_QUESTIONS[intent] || FOLLOW_UP_QUESTIONS.GENERAL;
  if (botReplyText) chips.push(...followUps);

  if (!/nhân viên/i.test(chips.join(" "))) {
    chips.push("Gặp nhân viên hỗ trợ");
  }

  const quickReplies = uniqueSlice(chips, 4);
  const suggestedQuestions = uniqueSlice(followUps, 3);

  return {
    intent,
    quickReplies,
    suggestedQuestions,
    followUpPrompt: suggestedQuestions[0] || null,
  };
}

/**
 * Gợi ý cho UI chat (AI, demo, hoặc đang chat với nhân viên).
 */
export function buildChatQuickReplies({ order, sessionMessages = [], isEscalated = false }) {
  if (!order) return [];

  const { lastUser, lastAgent } = getLastTurn(sessionMessages);
  const sessionLog = inferSessionLog(sessionMessages);
  const viewType = getCustomerViewType(order);

  if (isEscalated) {
    return uniqueSlice(humanContextChips(lastUser, lastAgent), 4);
  }

  const base = suggestConversationNextSteps({
    order,
    risk: { view_type: viewType },
    lastUserMessage: lastUser,
    botReplyText: lastAgent,
    sessionLog,
  });

  return base.quickReplies;
}
