"""Domain logic and tool handler tests."""
from app.basau.domain import get_cancel_journey_phase, normalize_status, STATUS
from app.basau.prompt_loader import load_system_prompt
from app.basau.tools import lookup_order


def test_normalize_status_legacy():
    assert normalize_status("placed") == STATUS["ORDERED"]
    assert normalize_status("đã đặt hàng") == STATUS["ORDERED"]


def test_lookup_order_found():
    result = lookup_order({"order_id": "ORD-001"})
    assert result["order_id"] == "ORD-001"
    assert "cancel_journey_phase" in result
    assert "error" not in result


def test_lookup_order_not_found():
    result = lookup_order({"order_id": "ORD-9999"})
    assert result["error"] == "ORDER_NOT_FOUND"


def test_cancel_phase_mapping():
    order = {"status": "đã đặt hàng"}
    assert get_cancel_journey_phase(order) == "ordered"


def test_system_prompt_loads():
    prompt = load_system_prompt()
    assert "Trợ lý BaSau" in prompt
    assert len(prompt) > 200
