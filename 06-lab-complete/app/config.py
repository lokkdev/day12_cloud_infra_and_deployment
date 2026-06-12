"""Production config — 12-Factor: tất cả từ environment variables."""

import logging
import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    # Server
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    debug: bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")

    # App
    app_name: str = field(default_factory=lambda: os.getenv("APP_NAME", "Production AI Agent"))
    app_version: str = field(default_factory=lambda: os.getenv("APP_VERSION", "1.0.0"))

    # LLM — BaSau agent uses Gemini (Day06 Hackathon); mock fallback if unset
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "gpt-4o-mini"))
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))
    gemini_temperature: float = field(default_factory=lambda: float(os.getenv("GEMINI_TEMPERATURE", "0.3")))
    gemini_max_output_tokens: int = field(default_factory=lambda: int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "512")))
    data_json_path: str = field(default_factory=lambda: os.getenv("DATA_JSON_PATH", ""))

    # Security
    agent_api_key: str = field(default_factory=lambda: os.getenv("AGENT_API_KEY", "dev-key-change-me"))
    jwt_secret: str = field(default_factory=lambda: os.getenv("JWT_SECRET", "dev-jwt-secret"))
    allowed_origins: list = field(default_factory=lambda: os.getenv("ALLOWED_ORIGINS", "*").split(","))

    # Rate limiting
    rate_limit_per_minute: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_MINUTE", "20")))

    # Budget
    daily_budget_usd: float = field(default_factory=lambda: float(os.getenv("DAILY_BUDGET_USD", "5.0")))

    # Storage
    redis_url: str = field(default_factory=lambda: os.getenv("REDIS_URL", ""))

    def validate(self):
        logger = logging.getLogger(__name__)
        if self.environment == "production":
            if self.agent_api_key == "dev-key-change-me":
                raise ValueError("AGENT_API_KEY must be set in production!")
            if self.jwt_secret == "dev-jwt-secret":
                raise ValueError("JWT_SECRET must be set in production!")
        if not self.gemini_api_key and not self.openai_api_key:
            logger.warning("GEMINI_API_KEY not set — using mock LLM")
        return self


settings = Settings().validate()
