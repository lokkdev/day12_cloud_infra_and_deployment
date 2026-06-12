"""Pytest fixtures — set env before app imports."""

import os

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("AGENT_API_KEY", "test-api-key")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("GEMINI_API_KEY", "")

import pytest
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def api_headers():
    return {"X-API-Key": "test-api-key"}
