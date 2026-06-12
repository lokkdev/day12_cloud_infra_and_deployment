"""In-memory chat store for Day06 UI compatibility (sync, escalate, poll)."""

from __future__ import annotations

import time
from typing import Any

_order_chats: dict[str, dict[str, Any]] = {}


def _now_ms() -> int:
    return int(time.time() * 1000)


def get_order_chat(order_id: str) -> dict[str, Any]:
    if order_id not in _order_chats:
        _order_chats[order_id] = {
            "orderId": order_id,
            "messages": [],
            "escalated": False,
            "escalation": None,
            "updatedAt": _now_ms(),
        }
    return _order_chats[order_id]


def reset_order_chat(order_id: str) -> dict[str, Any]:
    _order_chats[order_id] = {
        "orderId": order_id,
        "messages": [],
        "escalated": False,
        "escalation": None,
        "updatedAt": _now_ms(),
    }
    return _order_chats[order_id]


def append_message(order_id: str, *, sender: str, text: str, time_str: str | None = None) -> dict:
    chat = get_order_chat(order_id)
    msg = {
        "id": f"msg-{_now_ms()}",
        "sender": sender,
        "text": text,
        "time": time_str or "",
        "at": _now_ms(),
    }
    chat["messages"].append(msg)
    chat["updatedAt"] = _now_ms()
    return msg


def escalate_order(
    order_id: str,
    *,
    reason: str = "CUSTOMER_REQUESTED",
    summary: str = "",
    priority: str = "high",
) -> dict[str, Any]:
    chat = get_order_chat(order_id)
    chat["escalated"] = True
    chat["escalation"] = {
        "reason": reason,
        "summary": summary,
        "priority": priority,
        "ticketId": f"TKT-{_now_ms()}",
    }
    append_message(
        order_id,
        sender="system",
        text="Mình đang chuyển bạn sang nhân viên hỗ trợ. Vui lòng không đóng cửa sổ chat.",
    )
    chat["updatedAt"] = _now_ms()
    return chat


def get_messages_since(order_id: str, since_at: int) -> list[dict]:
    chat = get_order_chat(order_id)
    return [m for m in chat["messages"] if m.get("at", 0) > since_at]


def end_human_session(order_id: str) -> dict[str, Any]:
    chat = get_order_chat(order_id)
    chat["escalated"] = False
    chat["updatedAt"] = _now_ms()
    return chat
