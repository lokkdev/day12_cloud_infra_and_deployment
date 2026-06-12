"""BaSau Gemini agent with tool-calling — ported from Day06 geminiService.js."""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass

from app.basau import domain
from app.basau.prompt_loader import load_system_prompt
from app.basau.tools import SessionState, analyze_order_risk, get_tool_declarations, lookup_order, run_tool
from app.config import settings

logger = logging.getLogger(__name__)

_sessions: dict[str, dict] = {}
_system_prompt: str | None = None
_genai_client = None


@dataclass
class AgentReply:
    answer: str
    model: str
    session_id: str | None = None
    escalated: bool = False
    provider: str = "mock"


def is_ai_enabled() -> bool:
    return bool(settings.gemini_api_key)


def _get_system_prompt() -> str:
    global _system_prompt
    if _system_prompt is None:
        _system_prompt = load_system_prompt()
    return _system_prompt


def _extract_order_id(question: str, order_id: str | None) -> str | None:
    if order_id:
        return order_id
    match = re.search(r"ORD-\d+", question, re.IGNORECASE)
    return match.group(0).upper() if match else None


def _get_genai_client():
    """Singleton client — tránh httpx client bị đóng giữa các request."""
    global _genai_client
    from google import genai

    if _genai_client is None:
        _genai_client = genai.Client(api_key=settings.gemini_api_key)
    return _genai_client


def _reset_genai_client() -> None:
    global _genai_client
    _genai_client = None


def _create_chat():
    from google.genai import types

    client = _get_genai_client()
    tool = types.Tool(function_declarations=get_tool_declarations())
    config = types.GenerateContentConfig(
        system_instruction=_get_system_prompt(),
        temperature=settings.gemini_temperature,
        max_output_tokens=settings.gemini_max_output_tokens,
        tools=[tool],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    return client.chats.create(model=settings.gemini_model, config=config)


def _run_tool_loop(chat, message: str, session: SessionState) -> str:
    from google.genai import types

    response = chat.send_message(message)
    guard = 0

    while response.function_calls and guard < 8:
        guard += 1
        parts: list[types.Part] = []

        for call in response.function_calls:
            args = dict(call.args) if call.args else {}
            result = run_tool(call.name, args, session)
            if call.name == "escalateToHuman" and result.get("success"):
                session.escalated = True
            if result.get("requires_escalation"):
                session.escalated = True
            parts.append(
                types.Part.from_function_response(
                    name=call.name,
                    response=result,
                    id=call.id,
                )
            )

        response = chat.send_message(parts)

    reply = (response.text or "").strip()
    if not reply:
        raise ValueError("Gemini: empty assistant content")
    return reply


def _build_order_context(order_id: str) -> str:
    order = domain.enrich_order(lookup_order({"order_id": order_id}))
    if order.get("error"):
        return f"[Hệ thống] Không tìm thấy đơn {order_id}."
    risk = analyze_order_risk({"order_id": order_id})
    return (
        f"[Hệ thống] Ngữ cảnh đơn hàng {order_id}.\n"
        f"Khách: {order.get('customer_name', '—')}.\n"
        f"Dữ liệu lookupOrder: {order}.\n"
        f"Phân tích risk: {risk}."
    )


def ask(
    question: str,
    *,
    order_id: str | None = None,
    session_id: str | None = None,
) -> AgentReply:
    """Send a question to the BaSau agent (Gemini + tools, or mock fallback)."""
    if not is_ai_enabled():
        from utils.mock_llm import ask as mock_ask

        return AgentReply(
            answer=mock_ask(question),
            model=settings.llm_model,
            session_id=session_id,
            provider="mock",
        )

    resolved_order_id = _extract_order_id(question, order_id)
    sid = session_id or str(uuid.uuid4())

    is_new_session = sid not in _sessions
    if is_new_session:
        session_state = SessionState(order_id=resolved_order_id)
        chat = _create_chat()
        _sessions[sid] = {"chat": chat, "state": session_state, "initialized": False}
    else:
        session_state = _sessions[sid]["state"]
        chat = _sessions[sid]["chat"]
        if resolved_order_id and not session_state.order_id:
            session_state.order_id = resolved_order_id

    message = question
    if is_new_session and resolved_order_id:
        message = f"{_build_order_context(resolved_order_id)}\n\nKhách hỏi: {question}"

    try:
        answer = _run_tool_loop(chat, message, session_state)
        _sessions[sid]["initialized"] = True
    except Exception as exc:
        err = str(exc).lower()
        if "client has been closed" in err or "client is closed" in err:
            logger.warning("gemini_client_closed — recreating session")
            _reset_genai_client()
            _sessions.pop(sid, None)
            chat = _create_chat()
            _sessions[sid] = {
                "chat": chat,
                "state": session_state,
                "initialized": False,
            }
            answer = _run_tool_loop(chat, message, session_state)
            _sessions[sid]["initialized"] = True
        else:
            logger.exception("agent_error")
            raise RuntimeError(f"Agent error: {exc}") from exc

    return AgentReply(
        answer=answer,
        model=settings.gemini_model,
        session_id=sid,
        escalated=session_state.escalated,
        provider="gemini",
    )
