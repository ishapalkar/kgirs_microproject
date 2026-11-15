"""
REST API. Every number the dashboard shows comes from one of these endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.config import DOCUMENTS_DIR, settings
from backend.core.imd_criteria import HeatwaveAssessment, MUMBAI_IMD_NORMALS, assess_imd_heatwave
from backend.core.vulnerability_model import (CAPACITY_PARTS, CATEGORY_THRESHOLDS, EXPOSURE_PARTS,
                                              INDICATOR_LABELS, SENSITIVITY_PARTS, HVIWeights,
                                              compute_hvi, summarize_categories)
from backend.graph.connection import CypherSyntaxError, UnsafeQueryError, graph_manager, in_memory_graph
from backend.graph.graphrag_engine import GraphRAGResponse, graphrag_engine
from backend.graph.llm import llm
from backend.graph.ontology import SCHEMA_TEXT
from backend.graph.vector_store import doc_search
from backend.ingestion.ingest_all import store

router = APIRouter()


def _ward_or_404(ward_id: str) -> Dict[str, Any]:
    w = next((w for w in store.wards if w["ward_id"].lower() == ward_id.lower()), None)
    if not w:
        raise HTTPException(404, f"Unknown ward '{ward_id}'")
    return w


# --------------------------------------------------------------------------- #
# System
# --------------------------------------------------------------------------- #
@router.get("/health", tags=["system"])
def health() -> Dict[str, Any]:
    return {"status": "ok", "version": settings.VERSION, **system_status()}


def system_status() -> Dict[str, Any]:
    return {
        "graph_engine": graph_manager.engine_name,
        "neo4j_connected": graph_manager.is_live,
        "neo4j_error": None if graph_manager.is_live else graph_manager.last_error,
        "llm_available": llm.available,
        "llm_provider": llm.provider,
        "llm_model": llm.model_name,
        "search_method": doc_search.method,
    }


@router.get("/overview", tags=["system"])
def overview() -> Dict[str, Any]:
    """Headline numbers for the Overview page, all computed from the loaded data."""
    wards = store.wards
    pop = sum(w["population_total"] for w in wards)
    slum = sum(w["slum_population"] for w in wards)
    hottest = max(wards, key=lambda w: w["mean_lst_celsius"])
    coolest = min(wards, key=lambda w: w["mean_lst_celsius"])
    critical = [w for w in wards if w["vulnerability_category"] == "Critical"]
    pop_in_critical = sum(w["population_total"] for w in critical)
    fac_counts = store.provenance["counts"]["by_type"]
    stats = in_memory_graph.stats()
    return {
        "ward_count": len(wards),
        "population_total": pop,
        "slum_population_pct": round(slum / pop * 100, 1),
        "category_counts": summarize_categories(wards),
        "critical_wards": [{"ward_id": w["ward_id"], "ward_name": w["ward_name"], "hvi_score": w["hvi_score"]}
                           for w in critical],
        "population_in_critical": pop_in_critical,
        "population_in_critical_pct": round(pop_in_critical / pop * 100, 1),
        "top_wards": [{k: w[k] for k in ("ward_id", "ward_name", "hvi_score", "hvi_rank", "vulnerability_category",
                                         "exposure_score", "sensitivity_score", "adaptive_capacity_score")}
                      for w in wards[:5]],
        "hottest_ward": {"ward_id": hottest["ward_id"], "ward_name": hottest["ward_name"],
                         "mean_lst_celsius": hottest["mean_lst_celsius"], "max_lst_celsius": hottest["max_lst_celsius"]},
        "coolest_ward": {"ward_id": coolest["ward_id"], "ward_name": coolest["ward_name"],
                         "mean_lst_celsius": coolest["mean_lst_celsius"]},
        "lst_spread_celsius": round(hottest["mean_lst_celsius"] - coolest["mean_lst_celsius"], 1),
        "facilities": fac_counts,
        "graph": {"nodes": stats["total_nodes"], "relationships": stats["total_relationships"],
                  "labels": len(stats["nodes_by_label"]), "relationship_types": len(stats["relationships_by_type"])},
        "documents": sum(1 for n, d in in_memory_graph.nodes_with_label("Document")),
        "document_chunks": len(doc_search.chunks),
        "thresholds": [{"min": t, "label": l} for t, l in CATEGORY_THRESHOLDS],
        "status": system_status(),
    }


@router.get("/provenance", tags=["system"])
def provenance() -> Dict[str, Any]:
    return store.provenance


# --------------------------------------------------------------------------- #
# Geography
# --------------------------------------------------------------------------- #
@router.get("/geo/wards", tags=["geo"])
def wards_geojson() -> Dict[str, Any]:
    return store.wards_geojson


@router.get("/geo/facilities", tags=["geo"])
def facilities(type: Optional[str] = None, ward: Optional[str] = None,
               q: Optional[str] = None, limit: int = Query(5000, le=5000)) -> List[Dict[str, Any]]:
    out = store.facilities
    if type:
        types = set(type.split(","))
        out = [f for f in out if f["type"] in types]
    if ward:
        out = [f for f in out if f["ward_id"].lower() == ward.lower()]
    if q:
        ql = q.lower()
        out = [f for f in out if ql in f["name"].lower()]
    return out[:limit]


@router.get("/geo/hotspots", tags=["geo"])
def hotspots() -> List[Dict[str, Any]]:
    return store.hotspots


# --------------------------------------------------------------------------- #
# Vulnerability
# --------------------------------------------------------------------------- #
@router.get("/vulnerability/wards", tags=["vulnerability"])
def ward_scores() -> List[Dict[str, Any]]:
    return store.wards


@router.get("/vulnerability/method", tags=["vulnerability"])
def hvi_method() -> Dict[str, Any]:
    def parts(d):
        return [{"key": k, "label": INDICATOR_LABELS[k], "weight": v} for k, v in d.items()]
    return {
        "formula": "HVI = wE·E + wS·S + wA·(1 − A)",
        "default_weights": HVIWeights().model_dump(),
        "components": {"exposure": parts(EXPOSURE_PARTS), "sensitivity": parts(SENSITIVITY_PARTS),
                       "adaptive_capacity": parts(CAPACITY_PARTS)},
        "thresholds": [{"min": t, "label": l} for t, l in CATEGORY_THRESHOLDS],
        "note": "Every indicator is min-max scaled across the 24 wards, so scores rank wards relative to each other.",
    }


@router.post("/vulnerability/calculate", tags=["vulnerability"])
def recalculate(weights: HVIWeights) -> Dict[str, Any]:
    raw = [f["properties"] for f in store.wards_geojson["features"]]
    results = compute_hvi(raw, weights)
    baseline = {w["ward_id"]: w["hvi_rank"] for w in store.wards}
    for r in results:
        r["rank_change"] = baseline[r["ward_id"]] - r["hvi_rank"]
    return {"weights": weights.normalized().model_dump(), "category_counts": summarize_categories(results),
            "wards": results}


@router.get("/vulnerability/ward/{ward_id:path}", tags=["vulnerability"])
def ward_detail(ward_id: str) -> Dict[str, Any]:
    w = _ward_or_404(ward_id)
    node = f"WARD-{w['ward_id']}"
    g = in_memory_graph.graph
    neighbours = sorted({v[len("WARD-"):] for _, v, k in g.out_edges(node, keys=True) if k == "ADJACENT_TO"})
    mentions = []
    for u, _, k in g.in_edges(node, keys=True):
        if k == "MENTIONS":
            d = g.nodes[u]
            doc = g.nodes[d["document_id"]]
            mentions.append({"section_id": u, "section": d["title"], "document": doc.get("title"),
                             "excerpt": d["text"][:300]})
    groups = [dict(g.nodes[v]) for _, v, k in g.out_edges(node, keys=True) if k == "HAS_POPULATION_GROUP"]
    for gr in groups:
        gr.pop("__labels__", None)
    return {**w, "neighbours": neighbours, "document_mentions": mentions, "population_groups": groups,
            "hotspots": [h for h in store.hotspots if h["ward_id"] == w["ward_id"]]}


# --------------------------------------------------------------------------- #
# GraphRAG + Cypher
# --------------------------------------------------------------------------- #
class AskRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)


class CypherRequest(BaseModel):
    cypher: str = Field(..., min_length=3, max_length=4000)


@router.post("/graphrag/query", response_model=GraphRAGResponse, tags=["graphrag"])
def ask(req: AskRequest) -> GraphRAGResponse:
    return graphrag_engine.query(req.query)


@router.post("/graphrag/cypher", tags=["graphrag"])
def run_cypher(req: CypherRequest) -> Dict[str, Any]:
    try:
        result = graph_manager.run_cypher(req.cypher)
    except UnsafeQueryError as exc:
        raise HTTPException(403, str(exc))
    except CypherSyntaxError as exc:
        raise HTTPException(400, str(exc))
    result["record_count"] = len(result["rows"])
    result["rows"] = result["rows"][:500]
    return result


@router.get("/graphrag/schema", tags=["graphrag"])
def schema() -> Dict[str, Any]:
    return {"schema": SCHEMA_TEXT, **in_memory_graph.stats()}


@router.get("/graphrag/stats", tags=["graphrag"])
def graph_stats() -> Dict[str, Any]:
    return graph_manager.stats()


@router.get("/graphrag/subgraph", tags=["graphrag"])
def subgraph(ward: Optional[str] = None, labels: Optional[str] = None,
             limit: int = Query(120, ge=10, le=600)) -> Dict[str, Any]:
    """A readable slice of the graph: one ward and its surroundings, or a sample across all labels."""
    g = in_memory_graph
    if ward:
        w = _ward_or_404(ward)
        ids = g.neighbourhood([f"WARD-{w['ward_id']}"], max_nodes=limit, per_seed=limit)
        return g.to_vis(ids)
    wanted = set(labels.split(",")) if labels else None
    ids: List[str] = [f"WARD-{w['ward_id']}" for w in store.wards]
    per_label: Dict[str, int] = {}
    caps = {"Hospital": 30, "Park": 25, "WaterPoint": 12, "PopulationGroup": 24}
    for nid, d in g.graph.nodes(data=True):
        lbl = g.label_of(nid)
        if lbl == "Ward" or (wanted and lbl not in wanted):
            continue
        if per_label.get(lbl, 0) >= caps.get(lbl, 40):
            continue
        per_label[lbl] = per_label.get(lbl, 0) + 1
        ids.append(nid)
        if len(ids) >= limit:
            break
    return g.to_vis(ids)


@router.get("/graphrag/node/{node_id:path}", tags=["graphrag"])
def node_detail(node_id: str) -> Dict[str, Any]:
    g = in_memory_graph
    if node_id not in g.graph:
        raise HTTPException(404, "Node not found")
    ids = g.neighbourhood([node_id], max_nodes=40, per_seed=40)
    return g.to_vis(ids)


# --------------------------------------------------------------------------- #
# Evidence: documents, search, IMD
# --------------------------------------------------------------------------- #
@router.get("/evidence/documents", tags=["evidence"])
def documents() -> List[Dict[str, Any]]:
    g = in_memory_graph.graph
    out = []
    for nid, d in in_memory_graph.nodes_with_label("Document"):
        sections = [{"id": v, "title": g.nodes[v]["title"], "text": g.nodes[v]["text"],
                     "wards_mentioned": sorted(x[len("WARD-"):] for _, x, k in g.out_edges(v, keys=True) if k == "MENTIONS")}
                    for _, v, k in g.out_edges(nid, keys=True) if k == "HAS_SECTION"]
        out.append({"id": nid, "title": d["title"], "short": d["name"], "agency": d["agency"], "year": d["year"],
                    "kind": d.get("kind"), "sections": sections})
    return out


@router.get("/evidence/search", tags=["evidence"])
def search(q: str = Query(..., min_length=2), k: int = Query(5, ge=1, le=10)) -> Dict[str, Any]:
    return {"query": q, "method": doc_search.method, "results": [r.to_dict() for r in doc_search.search(q, k)]}


class HeatwaveCheckRequest(BaseModel):
    actual_max_temp_celsius: float = Field(..., ge=20.0, le=55.0)
    station_name: str = "Santacruz"
    month: str = "May"
    consecutive_days: int = Field(1, ge=1, le=14)


@router.get("/evidence/imd-normals", tags=["evidence"])
def imd_normals() -> Dict[str, Any]:
    return {"normals": MUMBAI_IMD_NORMALS, "coastal_threshold_celsius": 37.0,
            "heatwave_departure": [4.5, 6.4], "severe_departure": 6.5,
            "absolute_heatwave": 45.0, "absolute_severe": 47.0}


@router.post("/evidence/assess-heatwave", response_model=HeatwaveAssessment, tags=["evidence"])
def assess(req: HeatwaveCheckRequest) -> HeatwaveAssessment:
    return assess_imd_heatwave(actual_temp_c=req.actual_max_temp_celsius, station_name=req.station_name,
                               month=req.month, is_coastal=True, consecutive_days=req.consecutive_days)
