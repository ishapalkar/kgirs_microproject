"""
Builds the knowledge graph from the processed datasets and policy documents.

Steps
1. Load wards, facilities and hotspots from data/processed/ (run scripts/build_datasets.py
   first if those files are missing - it is done automatically here).
2. Score every ward with the Heat Vulnerability Index.
3. Create nodes and relationships (wards, neighbours, population groups, facilities,
   hotspots, documents, sections, advisories).
4. Index document chunks for hybrid search.
5. If Neo4j is reachable, copy the whole graph into it.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from shapely.geometry import shape

from backend.config import PROCESSED_DATA_DIR
from backend.core.vulnerability_model import compute_hvi
from backend.graph.connection import graph_manager, in_memory_graph
from backend.graph.documents import load_documents
from backend.graph.vector_store import doc_search

logger = logging.getLogger("heatshield.ingestion")


class DataStore:
    """Plain Python copies of the datasets, used by the REST endpoints."""
    wards_geojson: Dict[str, Any] = {}
    wards: List[Dict[str, Any]] = []          # with HVI fields, sorted by rank
    facilities: List[Dict[str, Any]] = []
    hotspots: List[Dict[str, Any]] = []
    provenance: Dict[str, Any] = {}
    search_method: str = ""


store = DataStore()


def _load_processed() -> None:
    if not (PROCESSED_DATA_DIR / "wards.geojson").exists():
        from scripts.build_datasets import build
        build()
    store.wards_geojson = json.loads((PROCESSED_DATA_DIR / "wards.geojson").read_text(encoding="utf-8"))
    store.facilities = json.loads((PROCESSED_DATA_DIR / "facilities.json").read_text(encoding="utf-8"))
    store.hotspots = json.loads((PROCESSED_DATA_DIR / "hotspots.json").read_text(encoding="utf-8"))
    store.provenance = json.loads((PROCESSED_DATA_DIR / "provenance.json").read_text(encoding="utf-8"))


def run_full_ingestion() -> Dict[str, Any]:
    _load_processed()
    g = in_memory_graph
    g.clear()

    # ---- Wards + HVI ------------------------------------------------------
    raw_wards = [f["properties"] for f in store.wards_geojson["features"]]
    store.wards = compute_hvi(raw_wards)
    scored = {w["ward_id"]: w for w in store.wards}
    for feat in store.wards_geojson["features"]:
        feat["properties"].update({k: scored[feat["properties"]["ward_id"]][k] for k in
                                   ("hvi_score", "hvi_rank", "vulnerability_category",
                                    "exposure_score", "sensitivity_score", "adaptive_capacity_score")})

    graph_fields = ("indicator_scores", "drivers", "priority_interventions")
    for w in store.wards:
        props = {k: v for k, v in w.items() if k not in graph_fields}
        props["name"] = f"Ward {w['ward_id']}"
        g.add_node(f"WARD-{w['ward_id']}", "Ward", props)

    # Neighbouring wards (polygons that touch)
    geoms = {f["properties"]["ward_id"]: shape(f["geometry"]).buffer(0.0005) for f in store.wards_geojson["features"]}
    ids = list(geoms)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if geoms[a].intersects(geoms[b]):
                g.add_edge(f"WARD-{a}", f"WARD-{b}", "ADJACENT_TO")
                g.add_edge(f"WARD-{b}", f"WARD-{a}", "ADJACENT_TO")

    # Population groups (Census 2011 counts)
    for w in store.wards:
        wid, pop = w["ward_id"], w["population_total"]
        groups = [
            ("CHILDREN", "Children 0-6", round(pop * w["children_0_6_pct"] / 100)),
            ("SLUM", "Slum residents", w["slum_population"]),
            ("NONLITERATE", "Non-literate residents", round(pop * w["illiteracy_pct"] / 100)),
        ]
        for key, name, count in groups:
            pid = f"POP-{wid}-{key}"
            g.add_node(pid, "PopulationGroup", {"name": name, "ward_id": wid, "count": count,
                                                "share_pct": round(count / pop * 100, 2)})
            g.add_edge(f"WARD-{wid}", pid, "HAS_POPULATION_GROUP")

    # ---- Facilities -------------------------------------------------------
    for f in store.facilities:
        g.add_node(f["id"], f["type"], f)
        g.add_edge(f["id"], f"WARD-{f['ward_id']}", "LOCATED_IN")

    # ---- Heat hotspots (estimates) ---------------------------------------
    for h in store.hotspots:
        g.add_node(h["id"], "Locality", h)
        g.add_edge(h["id"], f"WARD-{h['ward_id']}", "LOCATED_IN")

    # ---- Documents --------------------------------------------------------
    docs = load_documents(store.wards)
    for label, nid, props in docs["nodes"]:
        g.add_node(nid, label, props)
    for a, b, rel in docs["edges"]:
        g.add_edge(a, b, rel)
    doc_search.index(docs["chunks"])
    store.search_method = doc_search.method

    stats = g.stats()
    logger.info("Graph built: %d nodes, %d relationships", stats["total_nodes"], stats["total_relationships"])

    if graph_manager.connect():
        try:
            graph_manager.push_to_neo4j()
        except Exception as exc:  # pragma: no cover
            logger.warning("Could not copy graph into Neo4j (%s); using in-memory graph.", exc)
            graph_manager.close()
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(json.dumps(run_full_ingestion(), indent=2))
