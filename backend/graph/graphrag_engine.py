"""
GraphRAG engine
===============

Answers a natural-language question in five traceable steps:

  1. Link entities   Find wards / places / facility types named in the question.
  2. Retrieve text   Hybrid search (BM25 + semantic) over the policy documents.
  3. Write Cypher    LLM turns the question into a read-only Cypher query using the graph
                     schema (or, with no LLM key, a rule picks a parameterised template).
  4. Run Cypher      The query runs on Neo4j or the in-memory graph. If it fails, the LLM
                     sees the error and gets one chance to fix it.
  5. Answer          LLM writes the answer from the query rows + retrieved passages only,
                     citing them as [G] and [D1]..[Dn] (or a template does it, no LLM).

Every step is recorded with its timing and output, and the nodes touched by the answer
are returned so the UI can draw the exact sub-graph used.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from backend.graph.connection import (CypherSyntaxError, GRANDCYPHER_LIMITS, UnsafeQueryError,
                                      graph_manager, in_memory_graph)
from backend.graph.documents import _ward_patterns
from backend.graph.llm import LLMError, llm
from backend.graph.ontology import SCHEMA_TEXT
from backend.graph.vector_store import SearchResult, doc_search

MAX_ROWS_TO_LLM = 40


# --------------------------------------------------------------------------- #
# Response models
# --------------------------------------------------------------------------- #
class Citation(BaseModel):
    key: str
    document_title: str
    section: str
    excerpt: str
    score: float


class Step(BaseModel):
    name: str
    detail: str
    duration_ms: float
    data: Dict[str, Any] = Field(default_factory=dict)


class GraphRAGResponse(BaseModel):
    query: str
    answer: str
    mode: str                       # "llm" or "rules"
    model: Optional[str] = None
    steps: List[Step]
    cypher: Optional[str] = None
    cypher_rows: List[Dict[str, Any]] = Field(default_factory=list)
    cypher_error: Optional[str] = None
    citations: List[Citation]
    linked_entities: Dict[str, Any]
    subgraph: Dict[str, Any]
    highlight_node_ids: List[str]
    engine: str


# --------------------------------------------------------------------------- #
# Vocabulary for entity linking and the rule-based path
# --------------------------------------------------------------------------- #
FACILITY_WORDS = {
    "Hospital": r"hospital|medical|health ?care|clinic|doctor|treatment|bed",
    "Park": r"park|green|garden|tree|vegetation|open space",
    "WaterPoint": r"water|drinking|pyau|hydrat|tap",
    "CoolingCentre": r"cooling|shelter|refuge",
}
PER_100K = {"Hospital": "hospitals_per_100k", "Park": "parks_per_100k", "WaterPoint": "water_points_per_100k"}
COUNT_FIELD = {"Hospital": "hospitals_count", "Park": "parks_count", "WaterPoint": "water_points_count",
               "CoolingCentre": "cooling_centres_count"}
DEMOGRAPHIC_FIELDS = [
    (r"slum|informal", "slum_population_pct", "slum population share (%)"),
    (r"child|kid|infant|young", "children_0_6_pct", "children aged 0–6 (%)"),
    (r"litera|education|school", "illiteracy_pct", "non-literate share (%)"),
    (r"dens|crowd|packed", "population_density_per_sqkm", "people per km²"),
    (r"populat|people|resident|largest", "population_total", "population (Census 2011)"),
]
WARD_COLUMNS = ("w.ward_id AS ward, w.ward_name AS area, w.hvi_score AS hvi, w.hvi_rank AS rank, "
                "w.vulnerability_category AS category")


def _rx(pattern: str, text: str) -> bool:
    return re.search(pattern, text, re.IGNORECASE) is not None


def _q(value: str) -> str:
    return '"' + value.replace('"', '\\"') + '"'


# --------------------------------------------------------------------------- #
# Engine
# --------------------------------------------------------------------------- #
class GraphRAGEngine:
    def __init__(self) -> None:
        self._patterns: List[Tuple[str, re.Pattern]] = []

    def set_wards(self, wards: List[Dict[str, Any]]) -> None:
        self._patterns = _ward_patterns(wards)

    # ------------------------------------------------------------- pipeline
    def query(self, question: str) -> GraphRAGResponse:
        steps: List[Step] = []
        question = question.strip()

        # 1. Entity linking
        t = time.perf_counter()
        entities = self.link_entities(question)
        steps.append(Step(
            name="Link entities",
            detail=self._describe_entities(entities),
            duration_ms=_ms(t), data=entities))

        # 2. Document retrieval
        t = time.perf_counter()
        hits = doc_search.search(question, top_k=4)
        citations = [Citation(key=f"D{i}", document_title=h.chunk.document_title, section=h.chunk.section,
                              excerpt=_excerpt(h.chunk.content), score=round(h.score, 4))
                     for i, h in enumerate(hits, 1)]
        steps.append(Step(
            name="Search documents",
            detail=f"Hybrid search ({doc_search.method} + BM25) returned {len(hits)} passages.",
            duration_ms=_ms(t),
            data={"results": [{"key": c.key, "section": c.section, "document": c.document_title,
                               "bm25_rank": h.bm25_rank, "semantic_rank": h.semantic_rank, "score": c.score}
                              for c, h in zip(citations, hits)]}))

        # 3 + 4. Cypher generation and execution
        mode = "llm" if llm.available else "rules"
        cypher, rows, error, intent = None, [], None, None
        if mode == "llm":
            try:
                cypher, rows, error, gen_steps = self._llm_cypher(question, entities)
                steps.extend(gen_steps)
            except LLMError as exc:
                steps.append(Step(name="Write Cypher (LLM)", detail=f"LLM call failed: {exc}. Falling back to rules.",
                                  duration_ms=0))
                mode = "rules"
        if mode == "rules":
            t = time.perf_counter()
            intent, cypher = self._rule_cypher(question, entities)
            steps.append(Step(name="Write Cypher (rules)",
                              detail=f"Detected intent '{intent}'." + ("" if cypher else " No graph query needed."),
                              duration_ms=_ms(t), data={"intent": intent, "cypher": cypher}))
            if cypher:
                t = time.perf_counter()
                rows, error = self._run(cypher)
                steps.append(Step(name="Run Cypher", detail=_run_detail(rows, error), duration_ms=_ms(t),
                                  data={"engine": graph_manager.engine_name}))

        # 5. Answer
        t = time.perf_counter()
        answer = None
        if mode == "llm":
            try:
                answer = self._llm_answer(question, cypher, rows, error, hits)
                steps.append(Step(name="Write answer (LLM)",
                                  detail=f"{llm.model_name} wrote the answer from {len(rows)} rows and {len(hits)} passages.",
                                  duration_ms=_ms(t)))
            except LLMError as exc:
                steps.append(Step(name="Write answer (LLM)", detail=f"LLM failed: {exc}. Using template.",
                                  duration_ms=_ms(t)))
                intent = intent or self._rule_cypher(question, entities)[0]
        if answer is None:
            t = time.perf_counter()
            answer = self._template_answer(intent or "general", question, entities, rows, error, hits)
            steps.append(Step(name="Write answer (template)",
                              detail="Built the answer from the query rows and top passage (no LLM configured).",
                              duration_ms=_ms(t)))

        # Sub-graph actually used
        highlight = self._nodes_from(entities, rows, hits)
        sub_ids = in_memory_graph.neighbourhood(highlight, max_nodes=70, per_seed=6)
        return GraphRAGResponse(
            query=question, answer=answer, mode=mode, model=llm.model_name if mode == "llm" else None,
            steps=steps, cypher=cypher, cypher_rows=rows[:50], cypher_error=error, citations=citations,
            linked_entities=entities, subgraph=in_memory_graph.to_vis(sub_ids), highlight_node_ids=highlight,
            engine=graph_manager.engine_name)

    # -------------------------------------------------------- entity linking
    def link_entities(self, question: str) -> Dict[str, Any]:
        wards = []
        for wid, pat in self._patterns:
            m = pat.search(question)
            if m:
                wards.append({"ward_id": wid, "matched": m.group(0)})
        bare = re.findall(r"\bward\s+([A-Za-z](?:/[A-Za-z]+)?)\b", question, re.IGNORECASE)
        known = {w for w, _ in self._patterns}
        for b in bare:
            cand = b.upper() if len(b) == 1 else b[0].upper() + b[1:]
            if "/" in cand:
                a, rest = cand.split("/")
                cand = next((k for k in known if k.startswith(a + "/" + rest[:1].upper())), cand)
            if cand in known and cand not in [w["ward_id"] for w in wards]:
                wards.append({"ward_id": cand, "matched": f"Ward {b}"})
        facilities = [ft for ft, rx in FACILITY_WORDS.items() if _rx(rx, question)]
        top_n = re.search(r"\b(?:top|first|best|worst)\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:most|least|wards)\b", question, re.I)
        return {"wards": wards, "facility_types": facilities,
                "top_n": int(next(g for g in top_n.groups() if g)) if top_n else None}

    @staticmethod
    def _describe_entities(e: Dict[str, Any]) -> str:
        parts = []
        if e["wards"]:
            parts.append("wards " + ", ".join(f"{w['ward_id']} (from “{w['matched']}”)" for w in e["wards"]))
        if e["facility_types"]:
            parts.append("facility types " + ", ".join(e["facility_types"]))
        if e["top_n"]:
            parts.append(f"limit {e['top_n']}")
        return "Found " + "; ".join(parts) + "." if parts else "No specific ward or facility named."

    # ------------------------------------------------------------- execution
    def _run(self, cypher: str) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        try:
            return graph_manager.run_cypher(cypher)["rows"], None
        except (UnsafeQueryError, CypherSyntaxError) as exc:
            return [], str(exc)

    # ---------------------------------------------------------------- LLM path
    def _dialect_note(self) -> str:
        if graph_manager.is_live:
            return "The database is Neo4j 5, so full Cypher is available."
        return ("The database is an in-memory GrandCypher engine. " + GRANDCYPHER_LIMITS +
                " Use double-quoted strings. Always give aggregates an alias, e.g. COUNT(h) AS hospitals.")

    def _llm_cypher(self, question: str, entities: Dict[str, Any]):
        steps: List[Step] = []
        system = (
            "You translate questions about heat vulnerability in Mumbai into ONE read-only Cypher query.\n"
            f"GRAPH SCHEMA\n{SCHEMA_TEXT}\n\nDIALECT\n{self._dialect_note()}\n\n"
            "RULES\n- Read-only: MATCH/WHERE/RETURN/ORDER BY/LIMIT only.\n"
            "- Return readable columns with aliases (ward, area, hvi, ...), never whole nodes.\n"
            "- Use the exact ward_id strings listed in the schema.\n- Default LIMIT 10 unless the user asks otherwise.\n"
            "- If the question is only about policy text (alert levels, recommendations, IMD criteria) and needs no "
            "graph data, return null for cypher.\n"
            'Reply as JSON: {"cypher": "<query or null>", "why": "<one sentence>"}'
        )
        examples = (
            'Q: Which 5 wards are most vulnerable?\n'
            'A: {"cypher": "MATCH (w:Ward) RETURN w.ward_id AS ward, w.ward_name AS area, w.hvi_score AS hvi ORDER BY w.hvi_score DESC LIMIT 5", "why": "rank wards by HVI"}\n'
            'Q: How many parks are in Kurla?\n'
            'A: {"cypher": "MATCH (p:Park)-[:LOCATED_IN]->(w:Ward {ward_id: \\"L\\"}) RETURN COUNT(p) AS parks", "why": "Kurla is ward L"}\n'
        )
        linked = ", ".join(f"{w['matched']} = ward_id {w['ward_id']}" for w in entities["wards"]) or "none"
        prompt = f"{examples}\nLinked entities: {linked}\nQ: {question}\nA:"

        t = time.perf_counter()
        out = llm.generate_json(system, prompt)
        cypher = (out.get("cypher") or "").strip() or None
        steps.append(Step(name="Write Cypher (LLM)", detail=out.get("why") or "LLM proposed a query.",
                          duration_ms=_ms(t), data={"model": llm.model_name, "cypher": cypher}))
        if not cypher:
            return None, [], None, steps

        t = time.perf_counter()
        rows, error = self._run(cypher)
        steps.append(Step(name="Run Cypher", detail=_run_detail(rows, error), duration_ms=_ms(t),
                          data={"engine": graph_manager.engine_name}))
        if error:
            t = time.perf_counter()
            fix = llm.generate_json(system, f"{prompt}\n\nYour query:\n{cypher}\nfailed with:\n{error}\n"
                                            "Return a corrected query in the same JSON format.")
            fixed = (fix.get("cypher") or "").strip() or None
            if fixed:
                rows2, error2 = self._run(fixed)
                steps.append(Step(name="Repair Cypher (LLM)", detail="Query failed, so the LLM saw the error and "
                                  "rewrote it. " + _run_detail(rows2, error2), duration_ms=_ms(t),
                                  data={"cypher": fixed}))
                if not error2:
                    return fixed, rows2, None, steps
        return cypher, rows, error, steps

    def _llm_answer(self, question: str, cypher: Optional[str], rows: List[Dict[str, Any]],
                    error: Optional[str], hits: List[SearchResult]) -> str:
        passages = "\n\n".join(f"[D{i}] {h.chunk.document_title} — {h.chunk.section}\n{h.chunk.content}"
                               for i, h in enumerate(hits, 1)) or "(no passages)"
        table = _rows_as_text(rows[:MAX_ROWS_TO_LLM]) if rows else "(no rows)"
        system = (
            "You are HeatShield, an assistant for Mumbai heat-wave planning. Answer ONLY from the graph rows and "
            "passages given. Cite graph facts as [G] and passages as [D1], [D2]. Do not invent numbers or names. "
            "If the data cannot answer the question, say so plainly. Write in short, plain sentences (or a short "
            "bulleted list for rankings). Note when a figure is an estimate: surface temperature, NDVI and hotspot "
            "temperatures are estimates; population data is Census 2011; facility counts come from OpenStreetMap. "
            "Keep it under 180 words. Use Markdown bold for ward names."
        )
        prompt = (f"QUESTION\n{question}\n\nCYPHER\n{cypher or '(none)'}\n"
                  f"{'QUERY ERROR: ' + error if error else ''}\n\nGRAPH ROWS [G]\n{table}\n\nPASSAGES\n{passages}")
        return llm.generate(system, prompt, temperature=0.2).strip()

    # -------------------------------------------------------------- rule path
    def _rule_cypher(self, q: str, e: Dict[str, Any]) -> Tuple[str, Optional[str]]:
        wards = [w["ward_id"] for w in e["wards"]]
        n = e["top_n"] or 5
        fac = e["facility_types"]
        ql = q.lower()

        if _rx(r"\b(alert|action plan|recommend|measure|should|guideline|imd|declared|criteria|policy|directive)\b", ql) \
                and not wards and not _rx(r"\bward|which\b.*\b(hot|vulnerab)", ql):
            if _rx(r"alert|stage|level", ql):
                colour = re.search(r"\b(green|yellow|orange|red)\b", ql)
                where = f'WHERE a.stage = {_q(colour.group(1).title())} ' if colour else ""
                return "advisories", ("MATCH (a:HeatAdvisory)-[:DEFINED_IN]->(d:Document) " + where +
                                      "RETURN a.name AS alert, a.tagline AS meaning, a.description AS description, "
                                      "d.name AS source")
            return "policy", None

        if len(wards) >= 2 or _rx(r"\bcompare|versus|\bvs\b", ql) and wards:
            ids = ", ".join(_q(w) for w in wards)
            return "compare", (f"MATCH (w:Ward) WHERE w.ward_id IN [{ids}] RETURN {WARD_COLUMNS}, "
                               "w.population_total AS population, w.slum_population_pct AS slum_pct, "
                               "w.mean_lst_celsius AS surface_temp_c, w.hospitals_per_100k AS hospitals_per_100k, "
                               "w.parks_per_100k AS parks_per_100k ORDER BY w.hvi_score DESC")

        if wards and _rx(r"neighbo|adjacent|border|next to|nearby ward|surround", ql):
            return "neighbours", (f"MATCH (a:Ward)-[:ADJACENT_TO]->(w:Ward) WHERE a.ward_id = {_q(wards[0])} "
                                  f"RETURN {WARD_COLUMNS} ORDER BY w.hvi_score DESC")

        if wards and fac:
            ft = fac[0]
            if _rx(r"how many|number|count", ql):
                return "facility_count", (f"MATCH (f:{ft})-[:LOCATED_IN]->(w:Ward) WHERE w.ward_id = {_q(wards[0])} "
                                          f"RETURN w.ward_id AS ward, COUNT(f) AS {ft.lower()}s")
            return "facility_list", (f"MATCH (f:{ft})-[:LOCATED_IN]->(w:Ward) WHERE w.ward_id = {_q(wards[0])} "
                                     f"RETURN f.name AS name, f.lat AS lat, f.lon AS lon LIMIT {max(n, 10)}")

        if wards:
            return "ward_profile", (f"MATCH (w:Ward) WHERE w.ward_id = {_q(wards[0])} RETURN {WARD_COLUMNS}, "
                                    "w.population_total AS population, w.population_density_per_sqkm AS density, "
                                    "w.slum_population_pct AS slum_pct, w.children_0_6_pct AS children_pct, "
                                    "w.mean_lst_celsius AS surface_temp_c, w.hospitals_count AS hospitals, "
                                    "w.parks_count AS parks, w.water_points_count AS water_points, "
                                    "w.exposure_score AS exposure, w.sensitivity_score AS sensitivity, "
                                    "w.adaptive_capacity_score AS capacity")

        if fac and fac[0] in PER_100K and _rx(r"few|least|lack|limited|low|poor|shortage|under|worst|access", ql):
            f = PER_100K[fac[0]]
            return "facility_gap", (f"MATCH (w:Ward) RETURN {WARD_COLUMNS}, w.{f} AS per_100k, "
                                    f"w.{COUNT_FIELD[fac[0]]} AS total ORDER BY w.{f} ASC LIMIT {n}")
        if fac and _rx(r"most|highest|best|many|top", ql) and fac[0] in PER_100K:
            f = PER_100K[fac[0]]
            return "facility_best", (f"MATCH (w:Ward) RETURN {WARD_COLUMNS}, w.{f} AS per_100k, "
                                     f"w.{COUNT_FIELD[fac[0]]} AS total ORDER BY w.{f} DESC LIMIT {n}")
        if fac and _rx(r"how many|number|count|total", ql):
            return "facility_total", f"MATCH (f:{fac[0]}) RETURN COUNT(f) AS total"

        for rx, field, _ in DEMOGRAPHIC_FIELDS:
            if _rx(rx, ql):
                order = "ASC" if _rx(r"least|lowest|fewest|smallest", ql) else "DESC"
                return f"demographic:{field}", (f"MATCH (w:Ward) RETURN {WARD_COLUMNS}, w.{field} AS value "
                                                f"ORDER BY w.{field} {order} LIMIT {n}")

        if _rx(r"hot|temperature|lst|heat island|surface", ql):
            return "hottest", (f"MATCH (w:Ward) RETURN {WARD_COLUMNS}, w.mean_lst_celsius AS surface_temp_c, "
                               f"w.mean_ndvi AS ndvi ORDER BY w.mean_lst_celsius DESC LIMIT {n}")

        order = "ASC" if _rx(r"least|lowest|safest|best", ql) else "DESC"
        return "ranking", (f"MATCH (w:Ward) RETURN {WARD_COLUMNS}, w.exposure_score AS exposure, "
                           f"w.sensitivity_score AS sensitivity, w.adaptive_capacity_score AS capacity "
                           f"ORDER BY w.hvi_score {order} LIMIT {n}")

    def _template_answer(self, intent: str, q: str, e: Dict[str, Any], rows: List[Dict[str, Any]],
                         error: Optional[str], hits: List[SearchResult]) -> str:
        # Attach the best passage only if it talks about a ward in this answer.
        answer_wards = {w["ward_id"] for w in e["wards"]} | {str(r.get("ward")) for r in rows[:10]}
        top_idx = next((i for i, h in enumerate(hits) if answer_wards & set(h.chunk.wards_mentioned)), None)
        top_doc = hits[top_idx].chunk if top_idx is not None else None
        doc_line = (f"\n\n**Related policy** [D{top_idx + 1}] *{top_doc.document_title}, {top_doc.section}*: "
                    f"{_excerpt(top_doc.content, 320)}" if top_doc else "")
        if error:
            return f"The graph query failed: {error}{doc_line}"
        if intent == "policy":
            if not hits:
                return "I couldn't find anything about that in the policy documents."
            body = "\n\n".join(f"**[D{i}] {h.chunk.document_title} — {h.chunk.section}**\n{_excerpt(h.chunk.content, 420)}"
                               for i, h in enumerate(hits[:2], 1))
            return "Here is what the policy documents say:\n\n" + body
        if not rows:
            return "The graph query returned no results for that question." + doc_line

        def ward_line(r: Dict[str, Any], extra: str = "") -> str:
            return (f"- **Ward {r['ward']}** ({r['area']}): HVI {r['hvi']:.2f}, {r['category']}"
                    + (f", {extra}" if extra else "") + " [G]")

        if intent == "advisories":
            lines = [f"- **{r['alert']}** ({r['meaning']}): {r['description']}" for r in rows]
            order = {"Green": 0, "Yellow": 1, "Orange": 2, "Red": 3}
            lines.sort(key=lambda s: order.get(s.split("**")[1].split()[0], 9))
            head = (f"The heat action plan defines {len(rows)} alert levels [G]:" if len(rows) > 1
                    else "From the heat action plan [G]:")
            extra = ""
            if len(rows) == 1 and hits:
                h = next((h for h in hits if "directive" in h.chunk.section.lower()), hits[0])
                k = hits.index(h) + 1
                extra = f"\n\n**What BMC must do** [D{k}] *{h.chunk.section}*: {_excerpt(h.chunk.content, 520)}"
            return head + "\n\n" + "\n".join(lines) + extra
        if intent == "ranking":
            head = "Least" if _rx(r"least|lowest|safest|best", q) else "Most"
            lines = [ward_line(r, f"exposure {r['exposure']:.2f}, sensitivity {r['sensitivity']:.2f}, "
                                  f"capacity {r['capacity']:.2f}") for r in rows]
            return f"{head} heat-vulnerable wards by HVI:\n\n" + "\n".join(lines) + doc_line
        if intent == "hottest":
            lines = [ward_line(r, f"surface ≈ {r['surface_temp_c']}°C, NDVI {r['ndvi']}") for r in rows]
            return ("Wards with the hottest surfaces (temperatures are estimates, not satellite measurements):\n\n"
                    + "\n".join(lines) + doc_line)
        if intent.startswith("demographic:"):
            field = intent.split(":", 1)[1]
            label = next(lbl for _, f, lbl in DEMOGRAPHIC_FIELDS if f == field)
            lines = [ward_line(r, f"{label}: {r['value']:,}") for r in rows]
            return f"Wards ranked by {label} (Census 2011):\n\n" + "\n".join(lines) + doc_line
        if intent in ("facility_gap", "facility_best"):
            ft = e["facility_types"][0]
            word = {"Hospital": "hospitals", "Park": "parks", "WaterPoint": "drinking-water points"}[ft]
            lines = [ward_line(r, f"{r['per_100k']} {word} per 100k people ({r['total']} total)") for r in rows]
            head = "fewest" if intent == "facility_gap" else "most"
            return (f"Wards with the {head} {word} per person (OpenStreetMap counts, Census 2011 population):\n\n"
                    + "\n".join(lines) + doc_line)
        if intent == "facility_total":
            return f"The graph holds **{list(rows[0].values())[0]}** {e['facility_types'][0]} nodes inside BMC limits [G]."
        if intent == "facility_count":
            k = [c for c in rows[0] if c != "ward"][0]
            return f"**Ward {rows[0]['ward']}** has **{rows[0][k]}** {k} in the graph (OpenStreetMap) [G]." + doc_line
        if intent == "facility_list":
            names = ", ".join(r["name"] for r in rows[:12])
            return (f"{e['facility_types'][0]} locations in **Ward {e['wards'][0]['ward_id']}** "
                    f"(showing {min(len(rows), 12)}) [G]: {names}." + doc_line)
        if intent == "neighbours":
            lines = [ward_line(r) for r in rows]
            return f"Wards bordering **Ward {e['wards'][0]['ward_id']}**:\n\n" + "\n".join(lines)
        if intent == "compare":
            lines = [ward_line(r, f"population {r['population']:,}, slum {r['slum_pct']}%, surface ≈ "
                                  f"{r['surface_temp_c']}°C, {r['hospitals_per_100k']} hospitals/100k, "
                                  f"{r['parks_per_100k']} parks/100k") for r in rows]
            return "Side-by-side comparison:\n\n" + "\n".join(lines) + doc_line
        if intent == "ward_profile":
            r = rows[0]
            return (f"**Ward {r['ward']} ({r['area']})** is ranked **#{r['rank']} of 24** with HVI "
                    f"**{r['hvi']:.2f} ({r['category']})** [G].\n\n"
                    f"- Population {r['population']:,} (Census 2011), {r['density']:,} people/km²; "
                    f"{r['slum_pct']}% live in slums; {r['children_pct']}% are children aged 0–6.\n"
                    f"- Surface temperature ≈ {r['surface_temp_c']}°C (estimate).\n"
                    f"- Facilities (OpenStreetMap): {r['hospitals']} hospitals, {r['parks']} parks, "
                    f"{r['water_points']} drinking-water points.\n"
                    f"- Scores: exposure {r['exposure']:.2f}, sensitivity {r['sensitivity']:.2f}, "
                    f"adaptive capacity {r['capacity']:.2f}." + doc_line)
        return _rows_as_text(rows[:10]) + doc_line

    # --------------------------------------------------------- sub-graph ids
    def _nodes_from(self, e: Dict[str, Any], rows: List[Dict[str, Any]], hits: List[SearchResult]) -> List[str]:
        ids: List[str] = [f"WARD-{w['ward_id']}" for w in e["wards"]]
        g = in_memory_graph.graph
        for r in rows[:15]:
            for k, v in r.items():
                if not isinstance(v, str):
                    continue
                if f"WARD-{v}" in g and (k.endswith("ward") or k.endswith("ward_id")):
                    ids.append(f"WARD-{v}")
                elif v in g:
                    ids.append(v)
            name = r.get("name") or r.get("f.name") or r.get("alert")
            if name:
                for nid, d in g.nodes(data=True):
                    if d.get("name") == name:
                        ids.append(nid)
                        break
        for h in hits[:3]:
            ids += [h.chunk.chunk_id, h.chunk.document_id]
        return [i for i in dict.fromkeys(ids) if i in g]


# --------------------------------------------------------------------------- #
def _ms(t: float) -> float:
    return round((time.perf_counter() - t) * 1000, 1)


def _excerpt(text: str, n: int = 260) -> str:
    text = re.sub(r"(^|\n)\s*(?:[-*]|\d+\.)\s+", r"\1", text)   # drop list markers
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[: n].rsplit(" ", 1)[0] + "…"


def _run_detail(rows: List[Dict[str, Any]], error: Optional[str]) -> str:
    return f"Query failed: {error}" if error else f"Query returned {len(rows)} row{'s' if len(rows) != 1 else ''} on {graph_manager.engine_name}."


def _rows_as_text(rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return ""
    cols = list(rows[0].keys())
    lines = [" | ".join(cols)]
    for r in rows:
        lines.append(" | ".join(str(r.get(c)) for c in cols))
    return "\n".join(lines)


graphrag_engine = GraphRAGEngine()
