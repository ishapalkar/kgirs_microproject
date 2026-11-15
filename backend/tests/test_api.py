from fastapi.testclient import TestClient

from backend.main import app


def test_overview_and_ward_endpoints():
    with TestClient(app) as c:
        ov = c.get("/api/v1/overview").json()
        assert ov["ward_count"] == 24 and ov["population_total"] == 12_442_373
        d = c.get("/api/v1/vulnerability/ward/M/East").json()
        assert d["ward_id"] == "M/East" and d["neighbours"]
        r = c.post("/api/v1/graphrag/cypher", json={"cypher": "MATCH (n) DETACH DELETE n"})
        assert r.status_code == 403
        r = c.post("/api/v1/vulnerability/calculate", json={"weight_exposure": 1, "weight_sensitivity": 0,
                                                            "weight_adaptive_capacity": 0})
        assert r.json()["wards"][0]["rank_change"] is not None
