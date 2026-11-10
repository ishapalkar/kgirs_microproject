"""
Unit tests for GraphRAG Hybrid Retrieval & Provenance Citations
"""

import pytest
from backend.graph.graphrag_engine import graphrag_engine


def test_graphrag_hotspot_query():
    query = "Which Mumbai wards have high surface temperatures and limited access to public facilities?"
    res = graphrag_engine.query(query)
    assert res.query == query
    assert len(res.answer) > 50
    assert len(res.reasoning_path) >= 2
    assert len(res.citations) > 0
    # Provenance citation should reference official documents
    titles = [c.document_title for c in res.citations]
    assert any("Heat Wave Action Plan" in t or "Mumbai Climate Action Plan" in t for t in titles)


def test_graphrag_hospital_query():
    query = "Which highly populated localities have limited nearby hospital access?"
    res = graphrag_engine.query(query)
    assert len(res.answer) > 50
    assert "hospital" in res.answer.lower() or "bed" in res.answer.lower()


def test_graphrag_heat_preparedness_query():
    query = "Which heat preparedness measures are recommended by Maharashtra's Heat Action Plan?"
    res = graphrag_engine.query(query)
    assert "Maharashtra" in res.answer or "Action Plan" in res.answer
    assert len(res.citations) > 0
