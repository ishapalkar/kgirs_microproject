"""
Settings for HeatShield Mumbai. Values come from environment variables or a .env file
in the project root (see .env.example).
"""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SOURCES_DIR = DATA_DIR / "sources"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
DOCUMENTS_DIR = DATA_DIR / "documents"


class Settings(BaseSettings):
    PROJECT_NAME: str = "HeatShield Mumbai"
    VERSION: str = "2.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # Neo4j (optional). If it is not reachable the in-memory graph is used.
    NEO4J_ENABLED: bool = True
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "heatshield123"
    NEO4J_DATABASE: str = "neo4j"

    # LLM (optional). "gemini" uses GEMINI_API_KEY. "openai" works with any
    # OpenAI-compatible server: OpenAI, Groq, OpenRouter, or a local Ollama.
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Document search
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"   # downloaded on first run if available

    # Heat Vulnerability Index default weights
    DEFAULT_WEIGHT_EXPOSURE: float = 0.40
    DEFAULT_WEIGHT_SENSITIVITY: float = 0.35
    DEFAULT_WEIGHT_ADAPTIVE_CAPACITY: float = 0.25

    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), env_file_encoding="utf-8", extra="ignore")


settings = Settings()
