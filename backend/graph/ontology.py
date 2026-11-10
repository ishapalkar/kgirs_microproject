"""
Knowledge Graph Ontology for HeatShield Mumbai
==============================================
Defines the node labels, relationship types, property schemas,
and Neo4j DDL statements (constraints, indexes, and vector indexes).
"""

from typing import List, Dict, Any
from pydantic import BaseModel, Field


# Canonical Node Labels
LABEL_WARD = "Ward"
LABEL_LOCALITY = "Locality"
LABEL_HEAT_OBSERVATION = "HeatObservation"
LABEL_HEAT_EVENT = "HeatEvent"
LABEL_POPULATION_GROUP = "PopulationGroup"
LABEL_HOSPITAL = "Hospital"
LABEL_PARK = "Park"
LABEL_WATER_POINT = "WaterPoint"
LABEL_COOLING_CENTRE = "CoolingCentre"
LABEL_HEAT_ADVISORY = "HeatAdvisory"
LABEL_DOCUMENT = "Document"
LABEL_ORGANIZATION = "Organization"

# Canonical Relationship Types
REL_HAS_HEAT_EXPOSURE = "HAS_HEAT_EXPOSURE"
REL_LOCATED_IN = "LOCATED_IN"
REL_HAS_POPULATION_GROUP = "HAS_POPULATION_GROUP"
REL_HAS_FACILITY = "HAS_FACILITY"
REL_NEAR = "NEAR"
REL_SERVES = "SERVES"
REL_REPORTED_IN = "REPORTED_IN"
REL_ISSUED_BY = "ISSUED_BY"
REL_DOCUMENTED_IN = "DOCUMENTED_IN"
REL_APPLIES_TO = "APPLIES_TO"


# Neo4j Schema Constraints & Indexes
CYPHER_CONSTRAINTS = [
    "CREATE CONSTRAINT ward_id_unique IF NOT EXISTS FOR (w:Ward) REQUIRE w.ward_id IS UNIQUE",
    "CREATE CONSTRAINT locality_name_unique IF NOT EXISTS FOR (l:Locality) REQUIRE l.name IS UNIQUE",
    "CREATE CONSTRAINT hospital_id_unique IF NOT EXISTS FOR (h:Hospital) REQUIRE h.id IS UNIQUE",
    "CREATE CONSTRAINT park_id_unique IF NOT EXISTS FOR (p:Park) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT water_point_id_unique IF NOT EXISTS FOR (wp:WaterPoint) REQUIRE wp.id IS UNIQUE",
    "CREATE CONSTRAINT cooling_centre_id_unique IF NOT EXISTS FOR (c:CoolingCentre) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT advisory_id_unique IF NOT EXISTS FOR (a:HeatAdvisory) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
    "CREATE CONSTRAINT heat_event_id_unique IF NOT EXISTS FOR (e:HeatEvent) REQUIRE e.id IS UNIQUE",
]

CYPHER_INDEXES = [
    "CREATE INDEX ward_hvi_score_idx IF NOT EXISTS FOR (w:Ward) ON (w.hvi_score)",
    "CREATE INDEX ward_mean_lst_idx IF NOT EXISTS FOR (w:Ward) ON (w.mean_lst_celsius)",
    "CREATE INDEX locality_lst_idx IF NOT EXISTS FOR (l:Locality) ON (l.mean_lst_celsius)",
    "CREATE INDEX facility_ward_idx IF NOT EXISTS FOR (f:Hospital) ON (f.ward_id)",
    "CREATE INDEX cooling_centre_active_idx IF NOT EXISTS FOR (c:CoolingCentre) ON (c.is_officially_designated)",
]

# Read-only Cypher query validation
DISALLOWED_CYPHER_KEYWORDS = [
    "CREATE", "MERGE", "DELETE", "DETACH", "DROP", "SET", "REMOVE",
    "CALL dbms", "CALL apoc.schema", "ALTER", "GRANT", "REVOKE"
]


def is_cypher_read_only(query: str) -> bool:
    """Ensures a user-supplied Cypher query cannot modify the database."""
    query_upper = query.upper().strip()
    if not query_upper.startswith("MATCH") and not query_upper.startswith("RETURN") and not query_upper.startswith("WITH") and not query_upper.startswith("SHOW"):
        return False
    for keyword in DISALLOWED_CYPHER_KEYWORDS:
        # Check as whole keyword or token
        if f" {keyword} " in f" {query_upper} " or query_upper.startswith(keyword):
            return False
    return True
