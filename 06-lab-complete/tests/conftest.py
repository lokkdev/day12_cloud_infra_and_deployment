"""Pytest fixtures — set env before app imports."""
import os

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("AGENT_API_KEY", "test-api-key")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("GEMINI_API_KEY", "")

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def api_headers():
    return {"X-API-Key": "test-api-key"}
