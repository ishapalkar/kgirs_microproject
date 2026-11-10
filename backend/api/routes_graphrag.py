"""
GraphRAG & Knowledge Graph API Routes
=====================================
Provides endpoints for:
1. Natural-language GraphRAG query with hybrid retrieval & source citations.
2. Safe, read-only Cypher query execution for custom analytics.
3. Interactive Knowledge Graph subgraph data for network visualization.
4. Schema statistics and node/edge metrics.
"""

import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.graph.graphrag_engine import graphrag_engine, GraphRAGResponse
from backend.graph.connection import graph_manager, in_memory_graph
from backend.graph.ontology import is_cypher_read_only

router = APIRouter(prefix="/graphrag", tags=["GraphRAG"])


class GraphQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Natural language question")


class CypherQueryRequest(BaseModel):
    cypher: str = Field(..., min_length=5, description="Cypher query (read-only MATCH statements)")


class CypherQueryResponse(BaseModel):
    query: str
    execution_time_ms: float
    record_count: int
    columns: List[str]
    records: List[Dict[str, Any]]
    is_live_neo4j: bool
    warning: Optional[str] = None


@router.post("/query", response_model=GraphRAGResponse)
def execute_natural_language_query(request: GraphQueryRequest) -> GraphRAGResponse:
    """Executes a natural language GraphRAG query with vector search + graph traversal + source citations."""
    try:
        return graphrag_engine.query(request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GraphRAG query execution failed: {str(e)}")


@router.post("/cypher", response_model=CypherQueryResponse)
def execute_custom_cypher(request: CypherQueryRequest) -> CypherQueryResponse:
    """
    Executes a custom read-only Cypher query against Neo4j (or the embedded in-memory graph).
    Strictly validates that modifying keywords (CREATE, DELETE, SET, DROP) are rejected.
    """
    cypher = request.cypher.strip()
    if not is_cypher_read_only(cypher):
        raise HTTPException(
            status_code=400,
            detail="Forbidden query. Only read-only queries starting with MATCH or RETURN are permitted."
        )

    start_time = time.time()
    try:
        records = graph_manager.execute_read_cypher(cypher)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        columns = list(records[0].keys()) if records else []
        is_live = graph_manager.is_live()

        warning = None
        if not is_live:
            warning = "Query executed via High-Fidelity Embedded Graph Engine (Neo4j server is currently offline)."

        return CypherQueryResponse(
            query=cypher,
            execution_time_ms=elapsed_ms,
            record_count=len(records),
            columns=columns,
            records=records[:100],  # Limit response to 100 records
            is_live_neo4j=is_live,
            warning=warning
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cypher execution error: {str(e)}")


@router.get("/subgraph")
def get_graph_subgraph(limit: int = 150) -> Dict[str, Any]:
    """Returns nodes and edges formatted for force-directed and vis-network graph visualization."""
    return graph_manager.get_subgraph(limit=limit)


@router.get("/stats")
def get_graph_statistics() -> Dict[str, Any]:
    """Returns node counts, relationship counts, and Neo4j connectivity status."""
    return graph_manager.get_graph_stats()
