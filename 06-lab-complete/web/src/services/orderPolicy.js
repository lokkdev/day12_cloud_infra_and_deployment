/** Chính sách đơn: sửa đơn, xác nhận quán, liên hệ quán. */

import { STATUS, isCancelledStatus, isCompletedStatus, normalizeStatus } from "./orderStatus.js";

const MERCHANT_PENDING_STATUSES = new Set([STATUS.ORDERED, "placed", "pending_merchant"]);

const MERCHANT_CONTACTS = {
  "Bún Đậu Mắm Tôm ": { phone: "024 3201 8891", address: "42 Hàng Bún, Hoàn Kiếm, Hà Nội" },
  "Cơm Tấm Sài Gòn": { phone: "028 3822 4410", address: "15 Nguyễn Thị Minh Khai, Q.1, TP.HCM" },
  "Pizza 4P's Lê Đại Hành": { phone: "024 3626 9988", address: "Lê Đại Hành, Hai Bà Trưng, Hà Nội" },
  "Phở Thìn Bò": { phone: "024 3828 8151", address: "13 Lò Đúc, Hai Bà Trưng, Hà Nội" },
  "Bánh Mì Hồng Hoa": { phone: "028 3823 4567", address: "62 Nguyễn Đình Chiểu, Q.3, TP.HCM" },
  "Lẩu Thái Tom Yum": { phone: "024 3718 2200", address: "88 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội" },
  "Cafe Highlands Nguyễn Huệ": { phone: "028 3822 9001", address: "72 Nguyễn Huệ, Q.1, TP.HCM" },
  "Trà Sữa Gong Cha": { phone: "024 3936 1122", address: "12 Phố Huế, Hai Bà Trưng, Hà Nội" },
  "Gà Rán KFC Vincom": { phone: "024 3974 8800", address: "Vincom Bà Triệu, Hai Bà Trưng, Hà Nội" },
  "Bún Chả Hà Nội 36": { phone: "024 3825 6636", address: "36 Đường Thành, Hoàn Kiếm, Hà Nội" },
};

export function isMerchantConfirmed(order) {
  if (order.merchant_confirmed != null) return Boolean(order.merchant_confirmed);
  const status = normalizeStatus(order.status);
  return !MERCHANT_PENDING_STATUSES.has(status);
}

export function canEditOrder(order) {
  const status = normalizeStatus(order.status);
  if (isCancelledStatus(status) || isCompletedStatus(status)) return false;
  return !isMerchantConfirmed(order);
}

export function getMerchantContact(order) {
  const base = MERCHANT_CONTACTS[order.merchant_name] || {
    phone: "1900 6363",
    address: "Chi nhánh gần bạn — xem trong app basau",
  };
  return {
    name: order.merchant_name?.trim(),
    phone: order.merchant_phone || base.phone,
    address: order.merchant_address || base.address,
  };
}

export function enrichOrder(order) {
  if (!order) return order;
  const status = normalizeStatus(order.status);
  return {
    ...order,
    status,
    merchant_confirmed: isMerchantConfirmed({ ...order, status }),
    can_edit_order: canEditOrder({ ...order, status }),
    merchant_contact: getMerchantContact(order),
  };
}
