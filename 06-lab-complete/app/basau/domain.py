"""Order domain logic ported from Day06 Hackathon (JS services)."""
from __future__ import annotations

from datetime import datetime, timezone

STATUS = {
    "ORDERED": "đã đặt hàng",
    "CONFIRMED": "đã xác nhận",
    "PREPARING": "đang chuẩn bị",
    "DELIVERING": "đang giao",
    "COMPLETED": "hoàn thành",
    "CANCELLED": "đã hủy",
}

LEGACY_STATUS = {
    "placed": STATUS["ORDERED"],
    "pending_merchant": STATUS["ORDERED"],
    "confirmed": STATUS["CONFIRMED"],
    "searching_driver": STATUS["PREPARING"],
    "food_ready": STATUS["PREPARING"],
    "preparing": STATUS["PREPARING"],
    "support_escalated": STATUS["PREPARING"],
    "picked_up": STATUS["DELIVERING"],
    "delivering": STATUS["DELIVERING"],
    "delivered": STATUS["COMPLETED"],
    "completed": STATUS["COMPLETED"],
    "cancelled": STATUS["CANCELLED"],
}

REASON = {
    "STACK_TOO_DEEP": "Tài xế ghép quá nhiều đơn",
    "NO_DRIVER_TIMEOUT": "Chưa có tài xế quá ngưỡng",
    "FOOD_READY_TOO_LONG": "Đồ ăn chờ quá lâu sau khi quán làm xong",
    "MERCHANT_CLOSING": "Quán sắp đóng cửa",
    "PAYMENT_STATE_MISMATCH": "Lệch trạng thái thanh toán",
    "HUMAN_SUPPORT_REQUIRED": "Cần hỗ trợ người thật",
}

LEGACY_REASON = {k: v for k, v in REASON.items()}

MERCHANT_PENDING = {STATUS["ORDERED"], "placed", "pending_merchant"}

MERCHANT_CONTACTS = {
    "Bún Đậu Mắm Tôm ": {"phone": "024 3201 8891", "address": "42 Hàng Bún, Hoàn Kiếm, Hà Nội"},
    "Cơm Tấm Sài Gòn": {"phone": "028 3822 4410", "address": "15 Nguyễn Thị Minh Khai, Q.1, TP.HCM"},
    "Pizza 4P's Lê Đại Hành": {"phone": "024 3626 9988", "address": "Lê Đại Hành, Hai Bà Trưng, Hà Nội"},
    "Phở Thìn Bò": {"phone": "024 3828 8151", "address": "13 Lò Đúc, Hai Bà Trưng, Hà Nội"},
    "Bánh Mì Hồng Hoa": {"phone": "028 3823 4567", "address": "62 Nguyễn Đình Chiểu, Q.3, TP.HCM"},
    "Lẩu Thái Tom Yum": {"phone": "024 3718 2200", "address": "88 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội"},
    "Cafe Highlands Nguyễn Huệ": {"phone": "028 3822 9001", "address": "72 Nguyễn Huệ, Q.1, TP.HCM"},
    "Trà Sữa Gong Cha": {"phone": "024 3936 1122", "address": "12 Phố Huế, Hai Bà Trưng, Hà Nội"},
    "Gà Rán KFC Vincom": {"phone": "024 3974 8800", "address": "Vincom Bà Triệu, Hai Bà Trưng, Hà Nội"},
    "Bún Chả Hà Nội 36": {"phone": "024 3825 6636", "address": "36 Đường Thành, Hoàn Kiếm, Hà Nội"},
}


def normalize_status(status: str | None) -> str:
    if not status:
        return STATUS["ORDERED"]
    raw = str(status).strip().lower()
    if raw in STATUS.values():
        return raw
    return LEGACY_STATUS.get(status) or LEGACY_STATUS.get(raw) or STATUS["ORDERED"]


def is_preparing_status(status: str) -> bool:
    return normalize_status(status) == STATUS["PREPARING"]


def is_delivering_status(status: str) -> bool:
    return normalize_status(status) == STATUS["DELIVERING"]


def is_completed_status(status: str) -> bool:
    return normalize_status(status) == STATUS["COMPLETED"]


def is_cancelled_status(status: str) -> bool:
    return normalize_status(status) == STATUS["CANCELLED"]


def normalize_reason_code(code: str | None) -> str | None:
    if not code:
        return None
    if code in LEGACY_REASON:
        return LEGACY_REASON[code]
    return str(code)


def matches_reason(order: dict | None, *reasons: str) -> bool:
    code = normalize_reason_code(order.get("reason_code") if order else None)
    return any(normalize_reason_code(r) == code for r in reasons)


def reason_label(code: str | None) -> str:
    return normalize_reason_code(code) or "—"


def is_merchant_confirmed(order: dict) -> bool:
    if order.get("merchant_confirmed") is not None:
        return bool(order["merchant_confirmed"])
    return normalize_status(order.get("status")) not in MERCHANT_PENDING


def can_edit_order(order: dict) -> bool:
    status = normalize_status(order.get("status"))
    if is_cancelled_status(status) or is_completed_status(status):
        return False
    return not is_merchant_confirmed(order)


def get_merchant_contact(order: dict) -> dict:
    base = MERCHANT_CONTACTS.get(order.get("merchant_name", ""), {
        "phone": "1900 6363",
        "address": "Chi nhánh gần bạn — xem trong app basau",
    })
    return {
        "name": (order.get("merchant_name") or "").strip(),
        "phone": order.get("merchant_phone") or base["phone"],
        "address": order.get("merchant_address") or base["address"],
    }


def enrich_order(order: dict | None) -> dict | None:
    if not order:
        return order
    status = normalize_status(order.get("status"))
    enriched = {**order, "status": status}
    enriched["merchant_confirmed"] = is_merchant_confirmed({**order, "status": status})
    enriched["can_edit_order"] = can_edit_order({**order, "status": status})
    enriched["merchant_contact"] = get_merchant_contact(order)
    return enriched


def get_cancel_journey_phase(order: dict | None) -> str:
    if not order or not order.get("status"):
        return "unknown"
    status = normalize_status(order["status"])
    if is_cancelled_status(status):
        return "cancelled"
    if is_completed_status(status):
        return "finished"
    if is_delivering_status(status):
        return "delivering"
    if is_preparing_status(status):
        return "preparing"
    if status == STATUS["CONFIRMED"]:
        return "confirmed"
    if status == STATUS["ORDERED"]:
        return "ordered"
    return "unknown"


def can_auto_cancel_order(order: dict) -> bool:
    return get_cancel_journey_phase(order) == "ordered"


def get_customer_view_type(order: dict) -> str:
    status = normalize_status(order.get("status"))
    if is_completed_status(status):
        return "completed"
    if is_cancelled_status(status):
        return "cancelled"
    if order.get("risk_level") == "Red":
        return "recovery"
    if order.get("risk_level") == "Yellow":
        return "warning"
    return "in_progress"


def build_customer_message(order: dict) -> str:
    view = get_customer_view_type(order)
    status = normalize_status(order.get("status"))

    if view == "completed":
        return (
            "Cảm ơn bạn đã sử dụng dịch vụ, vui lòng đánh giá đơn và để lại góp ý "
            "của bạn để cải thiện hệ thống của chúng tôi."
        )
    if view == "cancelled":
        return "Đơn của bạn đã được hủy. Nếu đã thanh toán trước, hoàn tiền sẽ về trong 1–3 ngày làm việc."
    if view == "in_progress":
        if status == STATUS["ORDERED"]:
            if order.get("is_cancelable"):
                return "Đơn đã ghi nhận — đang chờ quán xác nhận. Bạn có thể chỉnh sửa đơn hoặc hủy theo chính sách basau."
            return "Đơn đã ghi nhận — đang chờ quán xác nhận. Bạn có thể chỉnh sửa ghi chú cho quán."
        if status == STATUS["CONFIRMED"]:
            return "Quán đã xác nhận đơn — món sẽ được chuẩn bị trong thời gian sớm nhất."
        if is_preparing_status(status):
            return "Quán đang chuẩn bị món cho bạn. Mình sẽ báo khi tài xế nhận đơn."
        if is_delivering_status(status):
            return "Tài xế đang giao hàng tới bạn — vui lòng giữ điện thoại để liên hệ."
        return "Đơn của bạn đang được xử lý."

    if view == "warning":
        reason = "đơn đang được theo dõi"
        if matches_reason(order, REASON["NO_DRIVER_TIMEOUT"]):
            reason = "chưa có tài xế nhận đơn"
        elif matches_reason(order, REASON["STACK_TOO_DEEP"]):
            reason = "khu vực giao hàng đang đông"
        elif matches_reason(order, REASON["FOOD_READY_TOO_LONG"]):
            reason = "đồ ăn đã chờ lâu hơn dự kiến"
        return (
            f"Đơn của bạn đang chậm vì {reason}. Hệ thống đang ưu tiên xử lý — "
            "bạn có thể tiếp tục đợi hoặc liên hệ nhân viên nếu cần."
        )

    reason = str(order.get("reason_code", "hệ thống chưa xử lý kịp")).lower()
    if matches_reason(order, REASON["NO_DRIVER_TIMEOUT"]):
        reason = "chưa tìm được tài xế phù hợp"
    elif matches_reason(order, REASON["STACK_TOO_DEEP"]):
        reason = "tài xế khu vực đang quá tải"
    elif matches_reason(order, REASON["FOOD_READY_TOO_LONG"]):
        reason = "đồ ăn đã chờ quá lâu"
    elif matches_reason(order, REASON["MERCHANT_CLOSING"]):
        reason = "quán sắp đóng cửa"
    elif matches_reason(order, REASON["PAYMENT_STATE_MISMATCH"]):
        reason = "cần xác minh thanh toán"
    elif matches_reason(order, REASON["HUMAN_SUPPORT_REQUIRED"]):
        reason = "cần hỗ trợ chuyên sâu"

    if status == STATUS["ORDERED"] and order.get("is_cancelable"):
        wait_hint = "Bạn có quyền hủy đơn và hoàn tiền theo chính sách basau."
    elif is_preparing_status(status) or is_delivering_status(status):
        wait_hint = "Đơn không thể hủy tự động lúc này — bấm «Gặp nhân viên hỗ trợ» nếu cần."
    else:
        wait_hint = "Nhân viên sẽ liên hệ nếu cần thêm thao tác."

    return f"Đơn của bạn đang gặp sự cố vì {reason}. {wait_hint}"


def recommended_actions(order: dict) -> list[str]:
    actions: list[str] = []
    if matches_reason(order, REASON["STACK_TOO_DEEP"]):
        actions.extend(["Không ghép thêm đơn", "Tìm tài xế khác / tách batch"])
    if matches_reason(order, REASON["NO_DRIVER_TIMEOUT"]):
        actions.extend(["Ưu tiên dispatch", "Cho phép request hủy"])
    if order.get("risk_level") == "Red" and order.get("is_cancelable"):
        actions.append("Mở hủy / hoàn tiền có điều kiện")
    if matches_reason(order, REASON["PAYMENT_STATE_MISMATCH"], REASON["HUMAN_SUPPORT_REQUIRED"]):
        actions.extend(["Escalate human support", "Không đóng case sớm"])
    if matches_reason(order, REASON["MERCHANT_CLOSING"]):
        actions.extend(["Platform-mediated cancel", "Xác nhận với quán"])
    if not actions:
        actions.append("Tiếp tục theo dõi — không can thiệp")
    return actions


def minutes_since(iso: str | None) -> int:
    if not iso:
        return 0
    try:
        created = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - created.astimezone(timezone.utc)
        return max(0, round(delta.total_seconds() / 60))
    except ValueError:
        return 0
