"""
Master Knowledge Graph Ingestion Pipeline
=========================================
Builds the unified HeatShield Knowledge Graph combining:
- 24 BMC Administrative Wards
- Real BMC Facilities (Hospitals, Dispensaries, Parks, Water Points, Cooling Shelters)
- USGS Landsat 8/9 C2 L2 LST & NDVI Observations
- WorldPop Demographics and Vulnerable Cohorts
- Maharashtra State Heat Wave Action Plan 2024, MCAP 2022, and IMD Criteria
"""

import json
import logging
import math
from pathlib import Path
from typing import Dict, Any, List

from backend.config import settings, RAW_DATA_DIR, PROCESSED_DATA_DIR
from backend.core.vulnerability_model import compute_ward_hvi, HVIWeights
from backend.graph.connection import in_memory_graph, graph_manager
from backend.graph.ontology import (
    LABEL_WARD, LABEL_LOCALITY, LABEL_HEAT_OBSERVATION, LABEL_HEAT_EVENT,
    LABEL_POPULATION_GROUP, LABEL_HOSPITAL, LABEL_PARK, LABEL_WATER_POINT,
    LABEL_COOLING_CENTRE, LABEL_HEAT_ADVISORY, LABEL_DOCUMENT, LABEL_ORGANIZATION,
    REL_HAS_HEAT_EXPOSURE, REL_LOCATED_IN, REL_HAS_POPULATION_GROUP, REL_HAS_FACILITY,
    REL_NEAR, REL_SERVES, REL_REPORTED_IN, REL_ISSUED_BY, REL_DOCUMENTED_IN
)
from backend.graph.transformer import extract_policy_entities_and_chunks
from backend.graph.vector_store import vector_store

logger = logging.getLogger("heatshield.ingestion")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def run_full_ingestion() -> Dict[str, Any]:
    """Runs end-to-end ingestion across all geospatial, demographic, facility, and document data."""
    logger.info("Starting HeatShield Master Ingestion...")

    # Load raw datasets
    with open(RAW_DATA_DIR / "opencity" / "mumbai_wards.geojson", "r", encoding="utf-8") as f:
        wards_geojson = json.load(f)

    with open(RAW_DATA_DIR / "opencity" / "bmc_facilities.json", "r", encoding="utf-8") as f:
        facilities_list = json.load(f)

    with open(RAW_DATA_DIR / "landsat" / "mumbai_thermal_hotspots.json", "r", encoding="utf-8") as f:
        hotspots_list = json.load(f)

    # 1. Map Facilities by Ward
    facilities_by_ward: Dict[str, List[Dict[str, Any]]] = {}
    for fac in facilities_list:
        wid = fac["ward_id"]
        facilities_by_ward.setdefault(wid, []).append(fac)

    # 2. Ingest Wards & Compute HVI
    ward_summaries = []
    default_weights = HVIWeights()

    for feat in wards_geojson["features"]:
        props = feat["properties"]
        wid = props["ward_id"]
        ward_facs = facilities_by_ward.get(wid, [])

        hosp_cnt = sum(1 for f in ward_facs if f["type"] == "Hospital")
        park_cnt = sum(1 for f in ward_facs if f["type"] == "Park")
        water_cnt = sum(1 for f in ward_facs if f["type"] == "WaterPoint")
        cooling_cnt = sum(1 for f in ward_facs if f["type"] == "CoolingCentre")

        raw_data = {
            "ward_id": wid,
            "ward_name": props["ward_name"],
            "mean_lst_celsius": props["mean_lst_celsius"],
            "max_lst_celsius": props["max_lst_celsius"],
            "mean_ndvi": props["mean_ndvi"],
            "population_total": props["population_total"],
            "population_density_per_sqkm": props["population_density_per_sqkm"],
            "children_under_5_pct": props["children_under_5_pct"],
            "elderly_60_plus_pct": props["elderly_60_plus_pct"],
            "slum_population_pct": props["slum_population_pct"],
            "hospitals_count": hosp_cnt,
            "parks_gardens_count": park_cnt,
            "water_points_count": water_cnt,
            "cooling_centres_count": cooling_cnt
        }

        hvi_res = compute_ward_hvi(raw_data, default_weights)
        ward_node_props = {**raw_data, **hvi_res.model_dump()}
        ward_summaries.append(ward_node_props)

        # Add to In-Memory Graph
        node_id = f"WARD-{wid}"
        in_memory_graph.add_node(node_id, LABEL_WARD, ward_node_props)

        # Ingest Population Groups for this Ward
        pop_groups = [
            (f"POP-{wid}-ELDERLY", "Elderly Citizens (60+)", "High Sensitivity", props["elderly_60_plus_pct"]),
            (f"POP-{wid}-CHILDREN", "Children (<5 Years)", "High Sensitivity", props["children_under_5_pct"]),
            (f"POP-{wid}-SLUM", "Informal Settlement Residents", "Extreme Socio-Economic Sensitivity", props["slum_population_pct"]),
            (f"POP-{wid}-LABOR", "Outdoor Construction & Informal Labor", "Extreme Occupational Exposure", 22.0)
        ]
        for pg_id, pg_name, pg_vuln, pg_share in pop_groups:
            in_memory_graph.add_node(pg_id, LABEL_POPULATION_GROUP, {
                "id": pg_id,
                "name": pg_name,
                "vulnerability_level": pg_vuln,
                "ward_id": wid,
                "population_share_pct": pg_share
            })
            in_memory_graph.add_edge(node_id, pg_id, REL_HAS_POPULATION_GROUP)

    # Save processed ward HVI rankings
    ward_summaries.sort(key=lambda x: x["hvi_score"], reverse=True)
    for rank, w in enumerate(ward_summaries, 1):
        w["rank"] = rank

    with open(PROCESSED_DATA_DIR / "mumbai_wards_hvi.json", "w", encoding="utf-8") as f:
        json.dump(ward_summaries, f, indent=2)

    # 3. Ingest Localities & Heat Observations (Hotspots)
    # Master Heat Event (May 2024 Pre-Monsoon Peak)
    event_id = "HEATEVENT-MUMBAI-2024-MAY"
    in_memory_graph.add_node(event_id, LABEL_HEAT_EVENT, {
        "id": event_id,
        "title": "May 2024 Mumbai Pre-Monsoon Severe Heat Event",
        "peak_lst_celsius": 45.3,
        "peak_t2m_celsius": 38.8,
        "imd_alert_level": "Orange",
        "season": "Pre-Monsoon Summer",
        "year": 2024
    })

    locality_nodes = []
    for idx, spot in enumerate(hotspots_list, 1):
        loc_id = f"LOC-{idx:03d}"
        obs_id = f"OBS-{idx:03d}"
        wid = spot["ward_id"]

        in_memory_graph.add_node(loc_id, LABEL_LOCALITY, {
            "id": loc_id,
            "name": spot["name"],
            "ward_id": wid,
            "lat": spot["lat"],
            "lon": spot["lon"],
            "surface_type": spot["surface_type"]
        })
        locality_nodes.append({"id": loc_id, "lat": spot["lat"], "lon": spot["lon"], "name": spot["name"]})

        in_memory_graph.add_node(obs_id, LABEL_HEAT_OBSERVATION, {
            "id": obs_id,
            "source": "USGS Landsat 8/9 C2 L2 TIRS-2 Band 10",
            "lst_celsius": spot["lst_celsius"],
            "ndvi": spot["ndvi"],
            "lat": spot["lat"],
            "lon": spot["lon"],
            "surface_type": spot["surface_type"]
        })

        # Edges
        in_memory_graph.add_edge(loc_id, f"WARD-{wid}", REL_LOCATED_IN)
        in_memory_graph.add_edge(loc_id, obs_id, REL_HAS_HEAT_EXPOSURE)
        in_memory_graph.add_edge(obs_id, event_id, REL_REPORTED_IN)

    # 4. Ingest Facilities & Spatial Distance Edges
    for fac in facilities_list:
        fid = fac["id"]
        ftype = fac["type"]
        wid = fac["ward_id"]
        in_memory_graph.add_node(fid, ftype, fac)
        in_memory_graph.add_edge(fid, f"WARD-{wid}", REL_LOCATED_IN)
        in_memory_graph.add_edge(f"WARD-{wid}", fid, REL_HAS_FACILITY)

        # Proximity edges to localities (within 3.5 km)
        for loc in locality_nodes:
            dist = haversine_km(fac["lat"], fac["lon"], loc["lat"], loc["lon"])
            if dist <= 3.5:
                in_memory_graph.add_edge(fid, loc["id"], REL_NEAR, {"distance_km": dist})

        # Link to Population Groups served
        if ftype in ("Hospital", "CoolingCentre"):
            in_memory_graph.add_edge(fid, f"POP-{wid}-ELDERLY", REL_SERVES)
            in_memory_graph.add_edge(fid, f"POP-{wid}-CHILDREN", REL_SERVES)
            in_memory_graph.add_edge(fid, f"POP-{wid}-SLUM", REL_SERVES)

    # 5. Ingest Documents, Policies & IMD Standards
    doc_files = [
        RAW_DATA_DIR / "documents" / "maharashtra_heat_action_plan_2024.md",
        RAW_DATA_DIR / "documents" / "mumbai_climate_action_plan_2022.md",
        RAW_DATA_DIR / "documents" / "imd_heatwave_guidelines.md"
    ]

    all_chunks = []
    for df in doc_files:
        if df.exists():
            nodes, rels, chunks = extract_policy_entities_and_chunks(df)
            for n in nodes:
                in_memory_graph.add_node(n["id"], n["label"], n["properties"])
            for r in rels:
                in_memory_graph.add_edge(r["source"], r["target"], r["rel_type"], r.get("properties"))
            all_chunks.extend(chunks)

    # Index into vector store
    vector_store.add_chunks(all_chunks)
    logger.info("Indexed %d document chunks in vector store", len(all_chunks))

    # Save unified Knowledge Graph snapshot
    subgraph = in_memory_graph.get_subgraph(limit=500)
    with open(PROCESSED_DATA_DIR / "knowledge_graph_snapshot.json", "w", encoding="utf-8") as f:
        json.dump(subgraph, f, indent=2)

    stats = in_memory_graph.get_stats()
    logger.info("Knowledge Graph Ingestion complete: %s", stats)

    # If live Neo4j is available, sync to Neo4j
    if graph_manager.connect():
        sync_to_live_neo4j()

    return stats


def sync_to_live_neo4j():
    """Syncs in-memory graph nodes and edges to live Neo4j instance when connected."""
    logger.info("Syncing Knowledge Graph to live Neo4j instance...")
    driver = graph_manager._driver
    if not driver:
        return

    try:
        from backend.graph.ontology import CYPHER_CONSTRAINTS, CYPHER_INDEXES
        with driver.session(database=settings.NEO4J_DATABASE) as session:
            # Apply constraints & indexes
            for constraint in CYPHER_CONSTRAINTS:
                try:
                    session.run(constraint)
                except Exception:
                    pass
            for index in CYPHER_INDEXES:
                try:
                    session.run(index)
                except Exception:
                    pass

            # Sync nodes by label
            for label, node_dict in in_memory_graph.nodes_by_label.items():
                batch = list(node_dict.values())
                query = f"""
                UNWIND $batch AS props
                MERGE (n:{label} {{id: props.id}})
                SET n += props
                """
                session.run(query, {"batch": batch})

            # Sync relationships
            edges_batch = []
            for u, v, data in in_memory_graph.graph.edges(data=True):
                edges_batch.append({
                    "from_id": u,
                    "to_id": v,
                    "rel_type": data.get("rel_type", "RELATED_TO"),
                    "props": {k: v for k, v in data.items() if k not in ("rel_type", "key")}
                })

            for e in edges_batch:
                query = f"""
                MATCH (a {{id: $from_id}}), (b {{id: $to_id}})
                MERGE (a)-[r:{e['rel_type']}]->(b)
                SET r += $props
                """
                try:
                    session.run(query, {"from_id": e["from_id"], "to_id": e["to_id"], "props": e["props"]})
                except Exception:
                    pass
            logger.info("Successfully synced in-memory Knowledge Graph to live Neo4j!")
    except Exception as e:
        logger.warning("Could not sync to live Neo4j: %s", str(e))


if __name__ == "__main__":
    run_full_ingestion()
