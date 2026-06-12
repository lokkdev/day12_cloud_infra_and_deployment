/**
 * Quãng đường giao hàng — 5 mốc UI (status tiếng Việt).
 */

import {
  STATUS,
  isCancelledStatus,
  isCompletedStatus,
  isDeliveringStatus,
  isPreparingStatus,
  normalizeStatus,
  statusStepIndex,
} from "./orderStatus.js";

export const JOURNEY_STEPS = [
  { id: "ordered", label: "Đã đặt hàng", short: "Đã đặt hàng" },
  { id: "confirmed", label: "Đã xác nhận", short: "Đã xác nhận" },
  { id: "preparing", label: "Đang chuẩn bị", short: "Đang chuẩn bị" },
  { id: "delivering", label: "Đang giao", short: "Đang giao" },
  { id: "completed", label: "Hoàn thành", short: "Hoàn thành" },
];

export function buildDeliveryJourney(order) {
  const status = normalizeStatus(order.status);
  const current = statusStepIndex(status);
  const driverAssigned = Boolean(order.driver_id);
  const isFinished = isCompletedStatus(status);

  const steps = JOURNEY_STEPS.map((s, i) => ({
    ...s,
    state: isFinished
      ? "done"
      : i < current
        ? "done"
        : i === current
          ? "active"
          : "pending",
  }));

  if (isDeliveringStatus(status)) {
    steps[2].state = "done";
    steps[3].state = "active";
  }

  const percent = isFinished
    ? 100
    : Math.round(((current + 0.5) / JOURNEY_STEPS.length) * 100);

  let mapHint = "Đơn đang được xử lý.";
  if (isFinished) {
    mapHint = "Đơn đã giao thành công.";
  } else if (isDeliveringStatus(status)) {
    mapHint = driverAssigned
      ? "Tài xế đang giao hàng tới bạn."
      : "Đơn đang trên đường giao.";
  } else if (isPreparingStatus(status) && !driverAssigned) {
    mapHint = "Chưa có tài xế — hệ thống đang tìm người nhận đơn.";
  } else if (isPreparingStatus(status)) {
    mapHint = "Quán đang chuẩn bị món.";
  } else if (status === STATUS.CONFIRMED) {
    mapHint = "Quán đã xác nhận đơn.";
  } else if (status === STATUS.ORDERED) {
    mapHint = "Đang chờ quán xác nhận.";
  } else if (isCancelledStatus(status)) {
    mapHint = "Đơn đã hủy.";
  }

  return {
    steps,
    currentIndex: current,
    percent: Math.min(100, Math.max(8, percent)),
    mapHint,
    status,
  };
}
