"""Tool declarations and handlers — ported from Day06 Hackathon."""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timezone

from app.basau import domain
from app.basau.data_store import get_data, patch_order


@dataclass
class SessionState:
    order_id: str | None = None
    escalated: bool = False
    order_mutated: bool = False


_audit_entries: list[dict] = []


def _driver_first_name(full_name: str | None) -> str:
    if not full_name:
        return "tài xế"
    parts = full_name.strip().split()
    return " ".join(parts[-2:]) if len(parts) > 1 else parts[0]


def _approximate_area(driver: dict | None) -> str:
    if not driver:
        return "khu vực gần bạn"
    lat = driver.get("current_lat", 0)
    if lat > 21.03:
        return "Khu vực Hoàn Kiếm"
    if lat > 21.0:
        return "Khu vực Hai Bà Trưng"
    return "Khu vực gần bạn"


def _calculate_risk_score(order: dict) -> int:
    score = 10
    if domain.is_preparing_status(order.get("status", "")) and not order.get("driver_id"):
        wait = domain.minutes_since(order.get("created_at"))
        if wait > 30:
            score = 80
        elif wait >= 20:
            score = 55
        else:
            score = 20
    elif order.get("active_driver_orders", 0) >= 3:
        score = 40

    if order.get("food_ready_at") and domain.minutes_since(order["food_ready_at"]) > 20:
        score += 10
    if order.get("active_driver_orders", 0) >= 3:
        score += 15
    if domain.matches_reason(order, domain.REASON["MERCHANT_CLOSING"]):
        score += 20
    if order.get("payment_state") == "mismatch":
        score += 25
    return min(100, score)


def _merchant_status_from_order(order: dict | None) -> dict:
    if order and domain.matches_reason(order, domain.REASON["MERCHANT_CLOSING"]):
        return {
            "status": "closing_soon",
            "closing_time": "23:00",
            "minutes_until_close": 18,
            "is_accepting_orders": False,
            "message": "Quán sắp đóng cửa, đơn có thể cần hủy nếu chưa có tài xế.",
        }
    return {
        "status": "open",
        "closing_time": "23:00",
        "minutes_until_close": 120,
        "is_accepting_orders": True,
        "message": "Quán đang mở và nhận đơn bình thường.",
    }


def lookup_order(args: dict) -> dict:
    data = get_data()
    order_id = args.get("order_id", "")
    order = next((o for o in data.get("orders", []) if o.get("order_id") == order_id), None)
    if not order:
        return {"error": "ORDER_NOT_FOUND", "message": f"Không tìm thấy đơn {order_id}"}

    enriched = domain.enrich_order(dict(order))
    phase = domain.get_cancel_journey_phase(enriched)
    hints = {
        "ordered": "CHỈ được hủy tự động khi khách xác nhận.",
        "confirmed": "Chỉ ghi nhận yêu cầu — admin duyệt, KHÔNG hủy ngay.",
        "preparing": "KHÔNG được hủy — quán đang chuẩn bị.",
        "delivering": "KHÔNG được hủy — đang giao.",
    }
    return {
        **enriched,
        "cancel_journey_phase": phase,
        "cancel_auto_allowed": domain.can_auto_cancel_order(enriched),
        "cancel_policy_hint": hints.get(phase, "Không hủy tự động."),
    }


def analyze_order_risk(args: dict) -> dict:
    order = lookup_order(args)
    if order.get("error"):
        return order
    return {
        "order_id": order["order_id"],
        "risk_level": order.get("risk_level"),
        "risk_score": _calculate_risk_score(order),
        "reason_code": order.get("reason_code"),
        "reason_label": domain.reason_label(order.get("reason_code")),
        "recommended_actions": domain.recommended_actions(order),
        "customer_message": domain.build_customer_message(order),
        "wait_time_minutes": domain.minutes_since(order.get("created_at")),
        "food_wait_minutes": domain.minutes_since(order.get("food_ready_at"))
        if order.get("food_ready_at")
        else None,
        "view_type": domain.get_customer_view_type(order),
    }


def cancel_order(args: dict, session: SessionState) -> dict:
    data = get_data()
    order_id = args.get("order_id", "")
    order = next((o for o in data.get("orders", []) if o.get("order_id") == order_id), None)
    if not order:
        return {"error": "ORDER_NOT_FOUND", "message": f"Không tìm thấy đơn {order_id}"}

    if not args.get("customer_confirmed"):
        return {
            "success": False,
            "order_id": order_id,
            "cancel_status": "rejected",
            "refund_eligible": False,
            "message": "Cần xác nhận từ khách trước khi hủy.",
        }

    if order.get("payment_state") == "mismatch":
        return {
            "success": False,
            "order_id": order_id,
            "cancel_status": "pending_review",
            "refund_eligible": False,
            "rejection_reason": "PAYMENT_MISMATCH",
            "message": "Case thanh toán cần nhân viên xử lý.",
            "requires_escalation": True,
        }

    phase = domain.get_cancel_journey_phase(order)

    if phase == "finished":
        return {
            "success": False,
            "order_id": order_id,
            "cancel_status": "rejected",
            "refund_eligible": False,
            "message": f"Đơn {order_id} đã hoàn thành — không thể hủy.",
        }
    if phase == "cancelled":
        return {
            "success": True,
            "order_id": order_id,
            "cancel_status": "cancelled",
            "refund_eligible": False,
            "message": f"Đơn {order_id} đã được hủy trước đó.",
        }
    if phase == "delivering":
        return {
            "success": False,
            "order_id": order_id,
            "cancel_status": "rejected",
            "refund_eligible": False,
            "rejection_reason": "ORDER_IN_DELIVERY",
            "message": (
                f"Rất tiếc, đơn {order_id} không thể hủy vì đang được giao. "
                "Bạn liên hệ nhân viên nếu có sự cố."
            ),
        }
    if phase == "preparing":
        return {
            "success": False,
            "order_id": order_id,
            "cancel_status": "rejected",
            "refund_eligible": False,
            "rejection_reason": "ORDER_PREPARING",
            "message": (
                f"Rất tiếc, đơn {order_id} không thể hủy lúc này vì quán đang chuẩn bị món."
            ),
        }
    if phase == "confirmed":
        return {
            "success": True,
            "order_id": order_id,
            "cancel_status": "pending_review",
            "refund_eligible": False,
            "requires_admin": True,
            "message": (
                f"Đơn {order_id} đã được quán xác nhận. Yêu cầu hủy đã gửi — "
                "admin basau sẽ duyệt trong ít phút."
            ),
        }
    if phase == "ordered":
        patch_order(order_id, {"status": domain.STATUS["CANCELLED"]})
        session.order_mutated = True
        voucher = domain.matches_reason(order, domain.REASON["NO_DRIVER_TIMEOUT"])
        return {
            "success": True,
            "order_id": order_id,
            "cancel_status": "cancelled",
            "refund_eligible": True,
            "refund_amount": order.get("total_amount", 85000),
            "refund_type": "full",
            "refund_timeline": "1-3 ngày làm việc",
            "voucher_issued": voucher,
            "voucher_detail": "Giảm 30%, tối đa 50.000đ" if voucher else None,
            "message": (
                f"Mình đã hủy đơn {order_id} cho bạn. Hoàn tiền về phương thức thanh toán "
                "gốc trong 1–3 ngày làm việc."
            ),
        }

    return {
        "success": False,
        "order_id": order_id,
        "cancel_status": "rejected",
        "refund_eligible": False,
        "message": "Không xác định được trạng thái đơn để hủy.",
    }


def request_refund(args: dict) -> dict:
    order = lookup_order(args)
    if order.get("error"):
        return order

    if order.get("payment_state") == "mismatch":
        return {
            "success": False,
            "order_id": args.get("order_id"),
            "refund_status": "rejected",
            "refund_amount": 0,
            "rejection_reason": "PAYMENT_MISMATCH",
            "message": "Lệch trạng thái thanh toán — cần chuyển nhân viên.",
            "requires_escalation": True,
        }

    needs_evidence = args.get("refund_reason") in {
        "WRONG_FOOD", "MISSING_ITEMS", "FOOD_DAMAGED"
    }
    if needs_evidence and not args.get("evidence_provided"):
        return {
            "success": False,
            "order_id": args.get("order_id"),
            "refund_status": "pending_review",
            "refund_amount": 0,
            "rejection_reason": "EVIDENCE_REQUIRED",
            "message": "Vui lòng gửi ảnh bằng chứng để xử lý hoàn tiền.",
        }

    auto_approve = args.get("refund_reason") in {
        "SYSTEM_CANCEL", "NO_DRIVER", "MERCHANT_CLOSED", "LATE_DELIVERY"
    }
    return {
        "success": True,
        "order_id": args.get("order_id"),
        "refund_status": "approved" if auto_approve else "pending_review",
        "refund_amount": 85000 if auto_approve else 50000,
        "refund_type": "full" if auto_approve else "partial",
        "refund_method": "Hoàn về phương thức thanh toán gốc",
        "refund_timeline": "1-3 ngày làm việc",
        "message": (
            "Yêu cầu hoàn tiền đã được ghi nhận và sẽ xử lý trong 1-3 ngày làm việc."
            if auto_approve
            else "Yêu cầu hoàn tiền đang được nhân viên xem xét."
        ),
    }


def escalate_to_human(args: dict, session: SessionState) -> dict:
    session.escalated = True
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    ticket_id = f"TKT-{today}-{random.randint(100, 999)}"
    priority = args.get("priority", "normal")
    return {
        "success": True,
        "ticket_id": ticket_id,
        "assigned_agent": None,
        "estimated_wait": "Trong vòng 2 phút" if priority == "urgent" else "Trong vòng 5 phút",
        "message": (
            "Mình đang chuyển bạn sang nhân viên hỗ trợ. Vui lòng không đóng cửa sổ chat."
        ),
    }


def lookup_driver(args: dict) -> dict:
    data = get_data()
    driver_id = args.get("driver_id", "")
    driver = next((d for d in data.get("drivers", []) if d.get("driver_id") == driver_id), None)
    if not driver:
        return {"error": "DRIVER_NOT_FOUND", "message": f"Không tìm thấy tài xế {driver_id}"}
    return {
        "driver_id": driver["driver_id"],
        "name": _driver_first_name(driver.get("name")),
        "status": driver.get("status"),
        "active_orders_count": driver.get("active_orders_count"),
        "approximate_area": _approximate_area(driver),
    }


def check_merchant_status(args: dict) -> dict:
    data = get_data()
    order_id = args.get("order_id")
    merchant_name = args.get("merchant_name", "")
    if order_id:
        order = next((o for o in data.get("orders", []) if o.get("order_id") == order_id), None)
    else:
        order = next(
            (o for o in data.get("orders", []) if (o.get("merchant_name") or "").strip() == merchant_name.strip()),
            None,
        )
    status = _merchant_status_from_order(order)
    return {"merchant_name": merchant_name, **status}


def log_audit_event(args: dict) -> dict:
    entry = {
        "log_id": f"LOG-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "order_id": args.get("order_id"),
        "event_type": args.get("event_type"),
        "details": args.get("details"),
        "actor": args.get("actor"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _audit_entries.append(entry)
    return {
        "success": True,
        "log_id": entry["log_id"],
        "timestamp": entry["timestamp"],
        "message": "Audit event logged successfully",
    }


TOOL_HANDLERS = {
    "lookupOrder": lambda args, session: lookup_order(args),
    "analyzeOrderRisk": lambda args, session: analyze_order_risk(args),
    "cancelOrder": cancel_order,
    "requestRefund": lambda args, session: request_refund(args),
    "escalateToHuman": escalate_to_human,
    "lookupDriver": lambda args, session: lookup_driver(args),
    "checkMerchantStatus": lambda args, session: check_merchant_status(args),
    "logAuditEvent": lambda args, session: log_audit_event(args),
}


def run_tool(name: str, args: dict, session: SessionState) -> dict:
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return {"error": "UNKNOWN_TOOL", "message": f"Tool {name} chưa được hỗ trợ."}
    return handler(args or {}, session)


def _schema_object(properties: dict, required: list[str]):
    from google.genai import types

    return types.Schema(
        type=types.Type.OBJECT,
        properties=properties,
        required=required,
    )


def get_tool_declarations():
    from google.genai import types

    return [
        types.FunctionDeclaration(
            name="lookupOrder",
            description=(
                "Tra cứu thông tin đơn hàng theo mã đơn. Trả về trạng thái đơn, tên quán, "
                "thông tin tài xế, trạng thái thanh toán, và mức rủi ro."
            ),
            parameters=_schema_object(
                {"order_id": types.Schema(type=types.Type.STRING, description="Mã đơn hàng, format ORD-xxx.")},
                ["order_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="analyzeOrderRisk",
            description="Phân tích mức rủi ro đơn hàng, reason code và đề xuất hành động recovery.",
            parameters=_schema_object(
                {"order_id": types.Schema(type=types.Type.STRING)},
                ["order_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="cancelOrder",
            description=(
                "Hủy đơn theo GIAI ĐOẠN TIMELINE. CHỈ khi cancel_auto_allowed=true "
                "VÀ customer_confirmed=true."
            ),
            parameters=_schema_object(
                {
                    "order_id": types.Schema(type=types.Type.STRING),
                    "reason": types.Schema(
                        type=types.Type.STRING,
                        enum=[
                            "NO_DRIVER_TOO_LONG",
                            "FOOD_QUALITY_CONCERN",
                            "CHANGED_MIND",
                            "WRONG_ORDER",
                            "MERCHANT_ISSUE",
                            "OTHER",
                        ],
                    ),
                    "customer_confirmed": types.Schema(type=types.Type.BOOLEAN),
                },
                ["order_id", "reason", "customer_confirmed"],
            ),
        ),
        types.FunctionDeclaration(
            name="requestRefund",
            description="Yêu cầu hoàn tiền theo chính sách BaSau Food khi đủ điều kiện.",
            parameters=_schema_object(
                {
                    "order_id": types.Schema(type=types.Type.STRING),
                    "refund_reason": types.Schema(
                        type=types.Type.STRING,
                        enum=[
                            "SYSTEM_CANCEL",
                            "NO_DRIVER",
                            "MERCHANT_CLOSED",
                            "WRONG_FOOD",
                            "MISSING_ITEMS",
                            "FOOD_DAMAGED",
                            "LATE_DELIVERY",
                            "OTHER",
                        ],
                    ),
                    "evidence_provided": types.Schema(type=types.Type.BOOLEAN),
                },
                ["order_id", "refund_reason"],
            ),
        ),
        types.FunctionDeclaration(
            name="escalateToHuman",
            description="Chuyển phiên chat sang nhân viên thật.",
            parameters=_schema_object(
                {
                    "order_id": types.Schema(type=types.Type.STRING),
                    "escalation_reason": types.Schema(
                        type=types.Type.STRING,
                        enum=[
                            "CUSTOMER_REQUESTED",
                            "PAYMENT_ISSUE",
                            "BOT_CANNOT_RESOLVE",
                            "HIGH_RISK_ORDER",
                            "DISPUTE",
                            "ANGRY_CUSTOMER",
                            "COMPLEX_REFUND",
                        ],
                    ),
                    "context_summary": types.Schema(type=types.Type.STRING),
                    "priority": types.Schema(
                        type=types.Type.STRING, enum=["normal", "high", "urgent"]
                    ),
                },
                ["order_id", "escalation_reason", "context_summary", "priority"],
            ),
        ),
        types.FunctionDeclaration(
            name="lookupDriver",
            description="Tra cứu thông tin tài xế. KHÔNG tiết lộ SĐT hoặc GPS chính xác cho khách.",
            parameters=_schema_object(
                {"driver_id": types.Schema(type=types.Type.STRING)},
                ["driver_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="checkMerchantStatus",
            description="Kiểm tra trạng thái hoạt động của quán ăn.",
            parameters=_schema_object(
                {
                    "merchant_name": types.Schema(type=types.Type.STRING),
                    "order_id": types.Schema(type=types.Type.STRING),
                },
                ["merchant_name"],
            ),
        ),
        types.FunctionDeclaration(
            name="logAuditEvent",
            description="Ghi audit log sau mỗi action quan trọng.",
            parameters=_schema_object(
                {
                    "order_id": types.Schema(type=types.Type.STRING),
                    "event_type": types.Schema(
                        type=types.Type.STRING,
                        enum=[
                            "ORDER_CANCELLED",
                            "REFUND_REQUESTED",
                            "REFUND_APPROVED",
                            "ESCALATED_TO_HUMAN",
                            "RISK_LEVEL_CHANGED",
                            "CANCEL_UNLOCKED",
                            "CUSTOMER_FEEDBACK",
                            "BOT_CANNOT_RESOLVE",
                            "PAYMENT_MISMATCH_DETECTED",
                        ],
                    ),
                    "details": types.Schema(type=types.Type.STRING),
                    "actor": types.Schema(
                        type=types.Type.STRING, enum=["bot", "customer", "admin", "system"]
                    ),
                },
                ["order_id", "event_type", "details", "actor"],
            ),
        ),
    ]
