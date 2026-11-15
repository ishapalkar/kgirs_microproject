import pytest

from backend.graph.connection import CypherSyntaxError, UnsafeQueryError, ensure_read_only, graph_manager


@pytest.mark.parametrize("q", ["CREATE (n:X)", "MATCH (n) DETACH DELETE n", "MATCH (w:Ward) SET w.x = 1",
                               "MERGE (n:X)", "CALL db.labels()", "MATCH (n) RETURN n; MATCH (m) DELETE m"])
def test_writes_are_blocked(q):
    with pytest.raises(UnsafeQueryError):
        ensure_read_only(q)


def test_keywords_inside_strings_are_fine():
    ensure_read_only("MATCH (f:Hospital) WHERE f.name CONTAINS 'Set' RETURN f.name")


def test_where_order_limit_really_work():
    rows = graph_manager.run_cypher(
        "MATCH (w:Ward) WHERE w.hvi_score > 0.5 RETURN w.ward_id AS id, w.hvi_score AS s ORDER BY w.hvi_score DESC LIMIT 3")["rows"]
    assert len(rows) == 3
    assert rows[0]["s"] >= rows[1]["s"] >= rows[2]["s"] > 0.5


def test_count_and_aggregates():
    assert graph_manager.run_cypher("MATCH (w:Ward) RETURN count(*)")["rows"][0]["COUNT(w)"] == 24
    row = graph_manager.run_cypher("MATCH (w:Ward) RETURN avg(w.hvi_score) AS a, max(w.hvi_score) AS m")["rows"][0]
    assert 0 < row["a"] < row["m"] <= 1


def test_relationship_traversal():
    rows = graph_manager.run_cypher(
        "MATCH (p:Park)-[:LOCATED_IN]->(w:Ward {ward_id: 'L'}) RETURN count(p) AS parks")["rows"]
    assert rows[0]["parks"] > 0


def test_unsupported_syntax_gives_helpful_error():
    with pytest.raises(CypherSyntaxError, match="GrandCypher"):
        graph_manager.run_cypher("MATCH (w:Ward) OPTIONAL MATCH (h)-[:LOCATED_IN]->(w) RETURN w")
