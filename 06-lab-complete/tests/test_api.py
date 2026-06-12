"""API endpoint tests."""
from unittest.mock import patch

from app.basau.agent import AgentReply


def test_root(client):
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["endpoints"]["health"] == "GET /health"


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["checks"]["agent"] == "basau-food"


def test_ready(client):
    res = client.get("/ready")
    assert res.status_code == 200
    assert res.json()["ready"] is True


def test_ask_requires_api_key(client):
    res = client.post("/ask", json={"question": "Hello"})
    assert res.status_code == 401


def test_ask_rejects_empty_question(client, api_headers):
    res = client.post("/ask", json={"question": ""}, headers=api_headers)
    assert res.status_code == 422


@patch("app.main.agent_ask")
def test_ask_success(mock_ask, client, api_headers):
    mock_ask.return_value = AgentReply(
        answer="Đơn đang được xử lý.",
        model="mock",
        session_id="sess-1",
        provider="mock",
    )
    res = client.post(
        "/ask",
        json={"question": "Đơn ORD-001 sao rồi?", "order_id": "ORD-001"},
        headers=api_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == "Đơn đang được xử lý."
    assert body["session_id"] == "sess-1"
