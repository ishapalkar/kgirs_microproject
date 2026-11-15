"""Neo4j is not needed for the tests: a fake driver records what would be sent."""
from backend.graph import connection as conn
from backend.graph.connection import in_memory_graph


class FakeSession:
    def __init__(self, log): self.log = log
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def run(self, q, params=None, **kw):
        self.log.append((q, kw.get("batch") or (params or {})))
        class R:  # minimal result
            def __iter__(self): return iter([])
        return R()


class FakeDriver:
    def __init__(self): self.log = []
    def session(self, **kw): return FakeSession(self.log)
    def close(self): pass


def test_push_sends_every_node_and_edge(monkeypatch):
    m = conn.GraphConnectionManager()
    m._driver = FakeDriver()
    assert m.push_to_neo4j()
    sent_nodes = sum(len(b) for q, b in m._driver.log if "CREATE (n:" in q)
    sent_edges = sum(len(b) for q, b in m._driver.log if "CREATE (a)-[r:" in q)
    stats = in_memory_graph.stats()
    assert sent_nodes == stats["total_nodes"]
    assert sent_edges == stats["total_relationships"]
    # every property value is a type Neo4j can store
    for q, batch in m._driver.log:
        if "CREATE (n:" in q:
            for props in batch:
                assert all(isinstance(v, (str, int, float, bool, list)) for v in props.values())


def test_live_queries_are_validated_before_sending():
    m = conn.GraphConnectionManager()
    m._driver = FakeDriver()
    import pytest
    with pytest.raises(conn.UnsafeQueryError):
        m.run_cypher("MATCH (n) DELETE n")
    assert m._driver.log == []
