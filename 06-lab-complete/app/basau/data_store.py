"""In-memory data store with runtime patches (ported from Day06 dataStore.js)."""
from __future__ import annotations

import json
import os
from pathlib import Path

_cache: dict | None = None
_cache_mtime: float = 0.0
_runtime_patches: dict[str, dict] = {}


def _data_path() -> Path:
    env_path = os.getenv("DATA_JSON_PATH", "")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parents[2] / "data" / "data.json"


def _apply_patches(data: dict) -> None:
    if not _runtime_patches:
        return
    for order in data.get("orders", []):
        patch = _runtime_patches.get(order.get("order_id"))
        if patch:
            order.update(patch)


def _load_from_disk() -> dict:
    global _cache, _cache_mtime
    path = _data_path()
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    _apply_patches(data)
    _cache = data
    _cache_mtime = path.stat().st_mtime
    return _cache


def get_data() -> dict:
    global _cache, _cache_mtime
    path = _data_path()
    mtime = path.stat().st_mtime if path.exists() else 0.0
    if _cache is None or mtime != _cache_mtime:
        _load_from_disk()
    return _cache  # type: ignore[return-value]


def patch_order(order_id: str, fields: dict) -> None:
    prev = _runtime_patches.get(order_id, {})
    _runtime_patches[order_id] = {**prev, **fields}
    if _cache:
        for order in _cache.get("orders", []):
            if order.get("order_id") == order_id:
                order.update(fields)
                break
