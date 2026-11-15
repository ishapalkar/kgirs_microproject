from backend.graph import graphrag_engine as ge
from backend.graph.graphrag_engine import graphrag_engine
from backend.graph.vector_store import doc_search


def test_search_finds_relevant_section():
    top = doc_search.search("when is a heatwave declared for a coastal station", 3)
    assert any("Coastal" in r.chunk.section for r in top)


def test_most_vulnerable_matches_hvi_ranking():
    from backend.ingestion.ingest_all import store
    res = graphrag_engine.query("Which 3 wards are most vulnerable?")
    assert res.mode == "rules"
    assert [r["ward"] for r in res.cypher_rows] == [w["ward_id"] for w in store.wards[:3]]
    assert store.wards[0]["ward_id"] in res.answer


def test_entity_linking_by_place_name():
    e = graphrag_engine.link_entities("Compare Govandi and Colaba")
    assert {w["ward_id"] for w in e["wards"]} == {"M/East", "A"}


def test_ward_specific_question_uses_that_ward():
    res = graphrag_engine.query("How many parks are in Kurla?")
    assert res.cypher_rows[0]["ward"] == "L"
    assert "WARD-L" in res.highlight_node_ids


def test_answer_steps_and_subgraph_are_real():
    res = graphrag_engine.query("Tell me about Ward H/West")
    names = [s.name for s in res.steps]
    assert names[0] == "Link entities" and "Run Cypher" in names
    assert any(n["id"] == "WARD-H/West" for n in res.subgraph["nodes"])


def test_llm_path_with_fake_model(monkeypatch):
    class FakeLLM:
        available, provider, model_name = True, "fake", "fake-model"

        def generate_json(self, system, prompt):
            assert "GRAPH SCHEMA" in system
            return {"cypher": "MATCH (w:Ward) RETURN w.ward_id AS ward ORDER BY w.hvi_score DESC LIMIT 2", "why": "rank"}

        def generate(self, system, prompt, **kw):
            assert "GRAPH ROWS" in prompt and "M/East" in prompt
            return "**M/East** is most vulnerable [G]."

    monkeypatch.setattr(ge, "llm", FakeLLM())
    res = graphrag_engine.query("most vulnerable?")
    assert res.mode == "llm" and res.model == "fake-model"
    assert res.cypher_rows[0]["ward"] == "M/East"


def test_llm_repairs_a_broken_query(monkeypatch):
    calls = []

    class FakeLLM:
        available, provider, model_name = True, "fake", "fake-model"

        def generate_json(self, system, prompt):
            calls.append(prompt)
            if len(calls) == 1:
                return {"cypher": "MATCH (w:Ward) OPTIONAL MATCH (h)-[:LOCATED_IN]->(w) RETURN w"}
            assert "failed with" in prompt
            return {"cypher": "MATCH (w:Ward) RETURN COUNT(w) AS n"}

        def generate(self, system, prompt, **kw):
            return "24 wards [G]."

    monkeypatch.setattr(ge, "llm", FakeLLM())
    res = graphrag_engine.query("how many wards")
    assert res.cypher_rows == [{"n": 24}] and res.cypher_error is None
    assert any(s.name == "Repair Cypher (LLM)" for s in res.steps)
