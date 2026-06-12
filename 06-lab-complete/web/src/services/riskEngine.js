/**
 * Rule-based risk helpers (prototype; AI explain in aiExplain.js).
 */

import { matchesReason, normalizeReasonCode, REASON } from "./reasonCodes.js";

export function reasonLabel(code) {
  return normalizeReasonCode(code) ?? "—";
}

export function recommendedActions(order) {
  const actions = [];
  if (matchesReason(order, REASON.STACK_TOO_DEEP)) {
    actions.push("Không ghép thêm đơn", "Tìm tài xế khác / tách batch");
  }
  if (matchesReason(order, REASON.NO_DRIVER_TIMEOUT)) {
    actions.push("Ưu tiên dispatch", "Cho phép request hủy");
  }
  if (order.risk_level === "Red" && order.is_cancelable) {
    actions.push("Mở hủy / hoàn tiền có điều kiện");
  }
  if (
    matchesReason(order, REASON.PAYMENT_STATE_MISMATCH, REASON.HUMAN_SUPPORT_REQUIRED)
  ) {
    actions.push("Escalate human support", "Không đóng case sớm");
  }
  if (matchesReason(order, REASON.MERCHANT_CLOSING)) {
    actions.push("Platform-mediated cancel", "Xác nhận với quán");
  }
  if (actions.length === 0) {
    actions.push("Tiếp tục theo dõi — không can thiệp");
  }
  return actions;
}

export function getRiskSummary(order) {
  const level = order.risk_level || "Green";
  const reason = reasonLabel(order.reason_code);
  const actions = recommendedActions(order);
  return { level, reason, actions };
}

export function shouldEscalate(order) {
  if (matchesReason(order, REASON.HUMAN_SUPPORT_REQUIRED)) {
    return true;
  }
  if (matchesReason(order, REASON.PAYMENT_STATE_MISMATCH)) {
    return true;
  }
  return false;
}

function formatAuditTime(iso) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function buildAuditLines(order) {
  const t = formatAuditTime(order.created_at);
  const lines = [`${t} — Đơn được tạo · ${order.status || "—"}`];

  if (order.reason_code) {
    lines.push(`${t} — ${reasonLabel(order.reason_code)}`);
  }

  if (order.risk_level === "Yellow") {
    lines.push(`${t} — Cảnh báo risk Yellow`);
  }

  if (order.risk_level === "Red") {
    lines.push(`${t} — Risk Red`);
    if (order.is_cancelable) {
      lines.push(`${t} — Mở quyền hủy đơn`);
    }
  }

  if (matchesReason(order, REASON.HUMAN_SUPPORT_REQUIRED)) {
    lines.push(`${t} — Chuyển nhân viên hỗ trợ`);
  }

  return lines;
}
