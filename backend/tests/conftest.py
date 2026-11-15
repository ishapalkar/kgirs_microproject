import os

import pytest

os.environ.setdefault("EMBEDDING_MODEL", "none")   # keep tests offline and fast
os.environ.setdefault("NEO4J_ENABLED", "false")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("OPENAI_API_KEY", "")


@pytest.fixture(scope="session", autouse=True)
def built_graph():
    from backend.graph.graphrag_engine import graphrag_engine
    from backend.ingestion.ingest_all import run_full_ingestion, store
    stats = run_full_ingestion()
    graphrag_engine.set_wards(store.wards)
    return stats
