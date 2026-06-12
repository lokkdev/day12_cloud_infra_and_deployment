"""Day06-compatible chat API — bridges the web UI to the Python BaSau agent."""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.basau.agent import ask as agent_ask, is_ai_enabled, reset_session
from app.basau.domain import get_cancel_journey_phase, get_customer_view_type
from app.basau.tools import SessionState, cancel_order, lookup_order
from app.chat_store import (
    append_message,
    end_human_session,
    escalate_order,
    get_messages_since,
    get_order_chat,
    reset_order_chat,
)
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Day06 UI"])

_ui_sessions: dict[str, dict] = {}


def _default_quick_replies(order: dict) -> list[str]:
    phase = get_cancel_journey_phase(order)
    view = get_customer_view_type(order)
    replies = ["Đơn của tôi sao rồi?"]
    if phase == "ordered":
        replies.append("Tôi muốn hủy đơn")
    if view in ("recovery", "warning"):
        replies.append("Gặp nhân viên hỗ trợ")
    replies.append("Hotline basau là gì?")
    return replies[:4]


def _get_order(order_id: str) -> dict:
    order = lookup_order({"order_id": order_id})
    if order.get("error"):
        raise HTTPException(404, order.get("message", "Không tìm thấy đơn"))
    return order


class InitChatRequest(BaseModel):
    orderId: str


class MessageRequest(BaseModel):
    sessionId: str
    message: str = Field(..., min_length=1)


class ResetRequest(BaseModel):
    sessionId: str | None = None


class OrderResetRequest(BaseModel):
    orderId: str


class CancelRequest(BaseModel):
    orderId: str
    customerConfirmed: bool = True


class SyncRequest(BaseModel):
    orderId: str
    sender: str
    text: str
    time: str | None = None
    customerName: str | None = None


class EscalateRequest(BaseModel):
    orderId: str
    summary: str | None = None
    reason: str | None = None
    priority: str = "high"


class HumanSendRequest(BaseModel):
    orderId: str
    message: str


@router.get("/chat/status")
def chat_status():
    if is_ai_enabled():
        return {
            "aiEnabled": True,
            "provider": "gemini",
            "model": settings.gemini_model,
        }
    return {"aiEnabled": False}


@router.post("/chat/init")
def chat_init(body: InitChatRequest):
    order = _get_order(body.orderId)
    reset_order_chat(body.orderId)

    if not is_ai_enabled():
        return {"aiEnabled": False}

    started = time.time()
    try:
        prompt = (
            f"[Hệ thống] Khách vừa mở chat hỗ trợ cho đơn {body.orderId}. "
            f"Khách: {order.get('customer_name', '—')}. "
            f"Hãy gửi welcome message ngắn gọn (2-3 câu) theo trạng thái đơn, tiếng Việt."
        )
        result = agent_ask(prompt, order_id=body.orderId)
        sid = result.session_id or str(uuid.uuid4())
        _ui_sessions[sid] = {
            "orderId": body.orderId,
            "escalated": False,
        }
        return {
            "aiEnabled": True,
            "sessionId": sid,
            "text": result.answer,
            "escalate": result.escalated,
            "quickReplies": _default_quick_replies(order),
            "suggestedQuestions": [],
            "responseMs": int((time.time() - started) * 1000),
            "apiError": False,
        }
    except Exception as exc:
        logger.exception("chat_init_error")
        return {
            "aiEnabled": True,
            "sessionId": str(uuid.uuid4()),
            "text": "Xin lỗi, hệ thống đang bận. Bạn thử lại sau ít phút nhé.",
            "escalate": False,
            "quickReplies": _default_quick_replies(order),
            "apiError": True,
        }


@router.post("/chat/message")
def chat_message(body: MessageRequest):
    session = _ui_sessions.get(body.sessionId)
    if not session:
        raise HTTPException(400, "Phiên chat không tồn tại hoặc đã hết hạn. Vui lòng mở lại chat.")

    order_id = session["orderId"]
    order = _get_order(order_id)
    chat = get_order_chat(order_id)

    if session.get("escalated") or chat.get("escalated"):
        return {"text": None, "silent": True, "escalate": True, "quickReplies": []}

    started = time.time()
    try:
        result = agent_ask(body.message.strip(), order_id=order_id, session_id=body.sessionId)
        if result.escalated:
            escalate_order(order_id, summary=body.message.strip())
            session["escalated"] = True
            return {
                "text": None,
                "silent": True,
                "escalate": True,
                "quickReplies": [],
                "responseMs": int((time.time() - started) * 1000),
            }

        fresh = _get_order(order_id)
        return {
            "text": result.answer,
            "escalate": False,
            "quickReplies": _default_quick_replies(fresh),
            "responseMs": int((time.time() - started) * 1000),
            "apiError": False,
            "order": fresh,
        }
    except Exception as exc:
        logger.exception("chat_message_error")
        return {
            "text": "Xin lỗi, mình chưa xử lý được yêu cầu. Bạn thử hỏi lại hoặc gặp nhân viên nhé.",
            "escalate": False,
            "quickReplies": _default_quick_replies(order),
            "apiError": True,
            "responseMs": int((time.time() - started) * 1000),
        }


@router.post("/chat/reset")
def chat_reset(body: ResetRequest):
    if body.sessionId:
        reset_session(body.sessionId)
        _ui_sessions.pop(body.sessionId, None)
    return {"ok": True}


@router.post("/chat/order/reset")
def chat_order_reset(body: OrderResetRequest):
    chat = reset_order_chat(body.orderId)
    return {
        "ok": True,
        "orderId": body.orderId,
        "escalated": chat["escalated"],
        "messages": [],
    }


@router.post("/chat/sync")
def chat_sync(body: SyncRequest):
    msg = append_message(body.orderId, sender=body.sender, text=body.text, time_str=body.time)
    return {"ok": True, "message": msg}


@router.post("/chat/escalate")
def chat_escalate(body: EscalateRequest):
    chat = escalate_order(
        body.orderId,
        reason=body.reason or "CUSTOMER_REQUESTED",
        summary=body.summary or "Khách yêu cầu gặp nhân viên",
        priority=body.priority,
    )
    for sid, meta in list(_ui_sessions.items()):
        if meta.get("orderId") == body.orderId:
            meta["escalated"] = True
    return {
        "ok": True,
        "escalated": True,
        "messages": chat["messages"],
        "escalation": chat["escalation"],
    }


@router.post("/chat/human/send")
def chat_human_send(body: HumanSendRequest):
    chat = get_order_chat(body.orderId)
    if not chat.get("escalated"):
        raise HTTPException(
            409,
            detail={
                "error": "Phiên chat với nhân viên đã kết thúc — vui lòng chat với Trợ lý BaSau.",
                "escalated": False,
                "useBot": True,
            },
        )
    msg = append_message(body.orderId, sender="customer", text=body.message.strip())
    return {"ok": True, "message": msg, "escalated": True}


@router.get("/chat/poll")
def chat_poll(orderId: str, since: int = 0):
    snapshot = get_order_chat(orderId)
    return {
        "messages": get_messages_since(orderId, since),
        "escalated": snapshot.get("escalated", False),
        "updatedAt": snapshot.get("updatedAt", 0),
    }


@router.post("/orders/cancel-request")
def orders_cancel_request(body: CancelRequest):
    session = SessionState(order_id=body.orderId)
    tool_result = cancel_order(
        {
            "order_id": body.orderId,
            "reason": "CHANGED_MIND",
            "customer_confirmed": body.customerConfirmed,
        },
        session,
    )
    order = _get_order(body.orderId)
    phase = get_cancel_journey_phase(order)
    return {
        "phase": phase,
        "outcome": tool_result.get("cancel_status"),
        "success": bool(tool_result.get("success")),
        "message": tool_result.get("message"),
        "requiresAdmin": bool(tool_result.get("requires_admin")),
        "order": order,
    }
