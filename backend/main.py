"""
HeatShield Mumbai – FastAPI Application Entrypoint
===================================================
Main application server for the GraphRAG-Based Urban Heatwave Vulnerability
and Shelter Intelligence System.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.api.routes_geospatial import router as geospatial_router
from backend.api.routes_vulnerability import router as vulnerability_router
from backend.api.routes_graphrag import router as graphrag_router
from backend.api.routes_evidence import router as evidence_router
from backend.graph.connection import graph_manager
from backend.ingestion.ingest_all import run_full_ingestion

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("heatshield")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup & shutdown events."""
    logger.info("Initializing HeatShield Mumbai Backend...")
    # Attempt connecting to Neo4j
    graph_manager.connect()
    # Ingest data & build graph if snapshot doesn't exist
    try:
        run_full_ingestion()
    except Exception as e:
        logger.error("Startup ingestion warning: %s", str(e))
    logger.info("HeatShield Mumbai is ready to serve queries.")
    yield
    # Shutdown
    graph_manager.close()
    logger.info("HeatShield Mumbai stopped.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "HeatShield Mumbai: GraphRAG-Based Urban Heatwave Vulnerability and Shelter Intelligence System. "
        "Integrates USGS Landsat 8/9 LST, ERA5-Land, WorldPop demographics, BMC OpenCity facilities, "
        "and Maharashtra State Heat Wave Action Plan 2024 via Neo4j Knowledge Graph & Hybrid Retrieval."
    ),
    lifespan=lifespan
)

# Enable CORS for local and production development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(geospatial_router, prefix=settings.API_V1_PREFIX)
app.include_router(vulnerability_router, prefix=settings.API_V1_PREFIX)
app.include_router(graphrag_router, prefix=settings.API_V1_PREFIX)
app.include_router(evidence_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_PREFIX}/health"
    }


@app.get(f"{settings.API_V1_PREFIX}/health")
def health_check():
    stats = graph_manager.get_graph_stats()
    return {
        "status": "healthy",
        "system": "HeatShield Mumbai",
        "version": settings.VERSION,
        "graph_status": stats
    }
