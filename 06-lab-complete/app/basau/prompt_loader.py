"""Load system prompt from Day06 SYSTEM_PROMPT.md."""

from __future__ import annotations

import os
import re
from pathlib import Path


def _prompt_path() -> Path:
    env_path = os.getenv("SYSTEM_PROMPT_PATH", "")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parents[2] / "ai-model" / "SYSTEM_PROMPT.md"


def load_system_prompt() -> str:
    md = _prompt_path().read_text(encoding="utf-8")
    match = re.search(r"```text\n([\s\S]*?)\n```", md)
    if not match:
        raise ValueError("Không tìm thấy system prompt trong SYSTEM_PROMPT.md")
    return match.group(1).strip()
