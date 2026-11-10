"""
Unit tests for Knowledge Graph Ontology, Read-Only Cypher, and Fallback Engine
"""

import pytest
from backend.graph.ontology import is_cypher_read_only
from backend.graph.connection import in_memory_graph, graph_manager


def test_cypher_read_only_validation():
    # Allowed read-only queries
    assert is_cypher_read_only("MATCH (w:Ward) RETURN w.ward_id") is True
    assert is_cypher_read_only("MATCH (h:Hospital)-[:LOCATED_IN]->(w:Ward) RETURN h.name, w.ward_name") is True
    assert is_cypher_read_only("RETURN 1 AS val") is True

    # Blocked write/destroy queries
    assert is_cypher_read_only("CREATE (n:Test {name: 'fake'})") is False
    assert is_cypher_read_only("MATCH (n) DELETE n") is False
    assert is_cypher_read_only("MATCH (n) DETACH DELETE n") is False
    assert is_cypher_read_only("MATCH (w:Ward) SET w.name = 'Hacked'") is False
    assert is_cypher_read_only("DROP CONSTRAINT ward_id_unique") is False


def test_in_memory_graph_traversal():
    stats = in_memory_graph.get_stats()
    assert stats["total_nodes"] > 0
    assert stats["total_relationships"] > 0
    assert "Ward" in stats["nodes_by_label"]
    assert "Hospital" in stats["nodes_by_label"]


def test_in_memory_cypher_execution():
    query = "MATCH (w:Ward) RETURN w.ward_id, w.ward_name LIMIT 5"
    results = in_memory_graph.execute_cypher_readonly(query)
    assert len(results) == 5
    assert "w.ward_id" in results[0] or "ward_id" in results[0]
