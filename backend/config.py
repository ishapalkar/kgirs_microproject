"""
Configuration settings for HeatShield Mumbai.
Supports pydantic-settings with .env loading and sensible defaults.
"""

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"


class Settings(BaseSettings):
    PROJECT_NAME: str = "HeatShield Mumbai – GraphRAG Heatwave Vulnerability & Shelter Intelligence"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Knowledge Graph (Neo4j)
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "heatshield123"
    NEO4J_DATABASE: str = "neo4j"
    
    # Intelligent Fallback to In-Memory Graph if Neo4j is offline
    ALLOW_IN_MEMORY_GRAPH_FALLBACK: bool = True
    
    # LLM Settings
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "gemini"  # gemini or local_mock
    LLM_MODEL: str = "gemini-1.5-flash"
    
    # Geospatial Settings (Mumbai Bounding Box)
    MUMBAI_BBOX_WEST: float = 72.77
    MUMBAI_BBOX_SOUTH: float = 18.89
    MUMBAI_BBOX_EAST: float = 73.05
    MUMBAI_BBOX_NORTH: float = 19.32
    
    # Vulnerability Index Default Weights
    DEFAULT_WEIGHT_EXPOSURE: float = 0.40
    DEFAULT_WEIGHT_SENSITIVITY: float = 0.35
    DEFAULT_WEIGHT_ADAPTIVE_CAPACITY: float = 0.25

    # Directory Paths
    BASE_PATH: Path = BASE_DIR
    DATA_PATH: Path = DATA_DIR
    RAW_DATA_PATH: Path = RAW_DATA_DIR
    PROCESSED_DATA_PATH: Path = PROCESSED_DATA_DIR

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
