"""
HeatShield Mumbai - FastAPI entry point.

    uvicorn backend.main:app --reload --port 8000

On start-up it builds the knowledge graph (and copies it into Neo4j if Neo4j is running).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router
from backend.config import settings
from backend.graph.connection import graph_manager
from backend.graph.graphrag_engine import graphrag_engine
from backend.ingestion.ingest_all import run_full_ingestion, store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("heatshield")


@asynccontextmanager
async def lifespan(app: FastAPI):
    stats = run_full_ingestion()
    graphrag_engine.set_wards(store.wards)
    logger.info("Ready: %s nodes on %s", stats["total_nodes"], graph_manager.engine_name)
    yield
    graph_manager.close()


app = FastAPI(
    title="HeatShield Mumbai API",
    version=settings.VERSION,
    description="Ward-level heat vulnerability for Mumbai, built on a knowledge graph with GraphRAG question answering.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "version": settings.VERSION, "docs": "/docs"}
