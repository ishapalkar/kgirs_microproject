"""
Graph storage and Cypher execution.

Two back-ends, same interface:

1. Neo4j (preferred). Used automatically when a Neo4j server is reachable at
   NEO4J_URI. Queries run on the real database.
2. In-memory graph (fallback). A NetworkX MultiDiGraph queried with GrandCypher,
   an open-source Cypher interpreter. It really parses MATCH / WHERE / RETURN /
   ORDER BY / LIMIT / COUNT, so results are genuine query results, not canned text.

Every query passes through `ensure_read_only` first, so nothing a user (or the LLM)
types can modify the graph.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, Iterable, List, Optional

import networkx as nx
from grandcypher import GrandCypher
from neo4j import Driver, GraphDatabase

from backend.config import settings

logger = logging.getLogger("heatshield.graph")

LABELS_KEY = "__labels__"

# --------------------------------------------------------------------------- #
# Read-only guard
# --------------------------------------------------------------------------- #
_WRITE_WORDS = re.compile(
    r"\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|LOAD\s+CSV|FOREACH|ALTER|GRANT|REVOKE|DENY)\b",
    re.IGNORECASE,
)
_CALL_WORD = re.compile(r"\bCALL\b", re.IGNORECASE)
_STRING_LITERAL = re.compile(r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"")


class UnsafeQueryError(ValueError):
    """Raised when a query tries to write to the graph."""


class CypherSyntaxError(ValueError):
    """Raised when the query cannot be parsed or executed."""


def ensure_read_only(cypher: str) -> str:
    """Raise UnsafeQueryError if the query could modify data. Returns the cleaned query."""
    q = cypher.strip().rstrip(";").strip()
    if not q:
        raise UnsafeQueryError("Empty query.")
    if ";" in _STRING_LITERAL.sub("", q):
        raise UnsafeQueryError("Only one statement per query is allowed.")
    # Ignore words inside string literals, e.g. WHERE f.name CONTAINS 'Set'
    code_only = _STRING_LITERAL.sub("''", q)
    bad = _WRITE_WORDS.search(code_only)
    if bad:
        raise UnsafeQueryError(f"Write operation '{bad.group(0).upper()}' is not allowed. The query lab is read-only.")
    if _CALL_WORD.search(code_only):
        raise UnsafeQueryError("Procedure calls (CALL ...) are disabled in the query lab.")
    return q


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _clean_value(v: Any) -> Any:
    """Make values JSON-friendly and strip internal keys from node dicts."""
    if isinstance(v, dict):
        return {k: _clean_value(x) for k, x in v.items() if k != LABELS_KEY}
    if isinstance(v, (set, frozenset)):
        return sorted(v)
    if isinstance(v, (list, tuple)):
        return [_clean_value(x) for x in v]
    return v


def _columns_to_rows(result: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
    """GrandCypher returns {column: [values]}; convert to [{column: value}]."""
    if not result:
        return []
    cols = list(result.keys())
    n = max(len(v) for v in result.values()) if result else 0
    rows = []
    for i in range(n):
        rows.append({str(c): _clean_value(result[c][i] if i < len(result[c]) else None) for c in cols})
    return rows


_AGG = re.compile(r"\b(count|avg|sum|min|max)\s*\(", re.IGNORECASE)
_COUNT_STAR = re.compile(r"COUNT\(\s*\*\s*\)", re.IGNORECASE)
_FIRST_VAR = re.compile(r"\(\s*([A-Za-z_][A-Za-z0-9_]*)")

GRANDCYPHER_LIMITS = (
    "The in-memory engine (GrandCypher) supports MATCH, WHERE (=, <>, <, >, AND, OR, NOT, IN, CONTAINS, "
    "STARTS WITH), RETURN, DISTINCT, ORDER BY, SKIP, LIMIT and COUNT/SUM/AVG/MIN/MAX. It does not support "
    "OPTIONAL MATCH, WITH, UNWIND, arithmetic in RETURN, or functions like toLower(). Start Neo4j for full Cypher."
)


def to_grandcypher(cypher: str) -> str:
    """Smooth over small dialect differences so common Cypher runs on GrandCypher."""
    q = re.sub(r"'((?:[^'\\]|\\.)*)'", lambda m: '"' + m.group(1).replace('"', '\\"') + '"', cypher)
    first = _FIRST_VAR.search(q)
    if first:
        q = _COUNT_STAR.sub(f"COUNT({first.group(1)})", q)
    q = _AGG.sub(lambda m: m.group(1).upper() + "(", q)
    return q


def display_name(props: Dict[str, Any], fallback: str) -> str:
    return (props.get("name") or props.get("ward_name") or props.get("title") or fallback)


# --------------------------------------------------------------------------- #
# In-memory graph
# --------------------------------------------------------------------------- #
class InMemoryGraph:
    def __init__(self) -> None:
        self.graph = nx.MultiDiGraph()

    # ---- building ---------------------------------------------------------
    def clear(self) -> None:
        self.graph = nx.MultiDiGraph()

    def add_node(self, node_id: str, label: str, properties: Dict[str, Any]) -> None:
        props = {k: v for k, v in properties.items() if v is not None}
        props["id"] = node_id
        self.graph.add_node(node_id, **props, **{LABELS_KEY: {label}})

    def add_edge(self, source: str, target: str, rel_type: str, properties: Optional[Dict[str, Any]] = None) -> None:
        if source not in self.graph or target not in self.graph:
            return
        self.graph.add_edge(source, target, key=rel_type, **(properties or {}), **{LABELS_KEY: {rel_type}})

    # ---- reading ----------------------------------------------------------
    def label_of(self, node_id: str) -> str:
        labels = self.graph.nodes[node_id].get(LABELS_KEY) or {"Node"}
        return next(iter(labels))

    def nodes_with_label(self, label: str) -> Iterable[tuple]:
        for nid, data in self.graph.nodes(data=True):
            if label in (data.get(LABELS_KEY) or ()):
                yield nid, data

    def run(self, cypher: str) -> List[Dict[str, Any]]:
        return _columns_to_rows(GrandCypher(self.graph).run(cypher))

    def stats(self) -> Dict[str, Any]:
        node_counts: Dict[str, int] = {}
        for _, d in self.graph.nodes(data=True):
            for lbl in d.get(LABELS_KEY) or ["Node"]:
                node_counts[lbl] = node_counts.get(lbl, 0) + 1
        rel_counts: Dict[str, int] = {}
        for _, _, d in self.graph.edges(data=True):
            for lbl in d.get(LABELS_KEY) or ["RELATED_TO"]:
                rel_counts[lbl] = rel_counts.get(lbl, 0) + 1
        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_relationships": self.graph.number_of_edges(),
            "nodes_by_label": dict(sorted(node_counts.items(), key=lambda x: -x[1])),
            "relationships_by_type": dict(sorted(rel_counts.items(), key=lambda x: -x[1])),
        }

    def to_vis(self, node_ids: Iterable[str], include_edges_between: bool = True) -> Dict[str, Any]:
        """Format a set of nodes (and the edges among them) for vis-network."""
        ids = [n for n in dict.fromkeys(node_ids) if n in self.graph]
        id_set = set(ids)
        nodes = []
        for nid in ids:
            data = self.graph.nodes[nid]
            nodes.append({
                "id": nid,
                "label": display_name(data, nid),
                "group": self.label_of(nid),
                "properties": _clean_value(dict(data)),
            })
        edges = []
        if include_edges_between:
            for u, v, k, d in self.graph.edges(keys=True, data=True):
                if u in id_set and v in id_set:
                    edges.append({"from": u, "to": v, "label": k,
                                  "properties": _clean_value({a: b for a, b in d.items() if a != LABELS_KEY})})
        return {"nodes": nodes, "edges": edges}

    def neighbourhood(self, seeds: Iterable[str], max_nodes: int = 80, per_seed: int = 12) -> List[str]:
        """Seeds plus up to `per_seed` direct neighbours each (both directions)."""
        out: List[str] = []
        for s in seeds:
            if s in self.graph and s not in out:
                out.append(s)
        for s in list(out):
            nbrs = list(self.graph.successors(s)) + list(self.graph.predecessors(s))
            for n in nbrs[:per_seed]:
                if n not in out:
                    out.append(n)
                if len(out) >= max_nodes:
                    return out
        return out


in_memory_graph = InMemoryGraph()


# --------------------------------------------------------------------------- #
# Connection manager (Neo4j or in-memory)
# --------------------------------------------------------------------------- #
class GraphConnectionManager:
    def __init__(self) -> None:
        self._driver: Optional[Driver] = None
        self.last_error: Optional[str] = None

    # ---- lifecycle --------------------------------------------------------
    def connect(self) -> bool:
        if not settings.NEO4J_ENABLED:
            self.last_error = "Neo4j disabled in settings (NEO4J_ENABLED=false)."
            return False
        try:
            driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
                connection_timeout=2.0,
            )
            driver.verify_connectivity()
            self._driver = driver
            self.last_error = None
            logger.info("Connected to Neo4j at %s", settings.NEO4J_URI)
            return True
        except Exception as exc:  # pragma: no cover - depends on environment
            self._driver = None
            self.last_error = str(exc).splitlines()[0]
            logger.warning("Neo4j unavailable (%s). Using the in-memory graph.", self.last_error)
            return False

    def close(self) -> None:
        if self._driver:
            self._driver.close()
            self._driver = None

    @property
    def is_live(self) -> bool:
        return self._driver is not None

    @property
    def engine_name(self) -> str:
        return "Neo4j" if self.is_live else "In-memory (GrandCypher)"

    # ---- queries ----------------------------------------------------------
    def run_cypher(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Validate and run a read-only query. Returns rows, columns, timing and engine."""
        q = ensure_read_only(cypher)
        start = time.perf_counter()
        if self.is_live:
            try:
                with self._driver.session(database=settings.NEO4J_DATABASE, default_access_mode="READ") as session:
                    result = session.run(q, params or {})
                    rows = [_clean_value(r.data()) for r in result]
            except Exception as exc:
                raise CypherSyntaxError(str(exc).strip().splitlines()[0]) from exc
        else:
            if params:
                for k, v in params.items():  # GrandCypher has no parameters; inline safely
                    lit = repr(v) if not isinstance(v, str) else "'" + v.replace("'", "\\'") + "'"
                    q = re.sub(rf"\${k}\b", lit, q)
            try:
                rows = in_memory_graph.run(to_grandcypher(q))
            except Exception as exc:
                first_line = str(exc).strip().splitlines()[0] if str(exc).strip() else type(exc).__name__
                raise CypherSyntaxError(f"{first_line}. {GRANDCYPHER_LIMITS}") from exc
        elapsed = (time.perf_counter() - start) * 1000
        columns = list(rows[0].keys()) if rows else []
        return {"rows": rows, "columns": columns, "execution_time_ms": round(elapsed, 2), "engine": self.engine_name}

    def stats(self) -> Dict[str, Any]:
        base = in_memory_graph.stats()
        if self.is_live:
            try:
                with self._driver.session(database=settings.NEO4J_DATABASE) as s:
                    base["total_nodes"] = s.run("MATCH (n) RETURN count(n) AS c").single()["c"]
                    base["total_relationships"] = s.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]
            except Exception as exc:  # pragma: no cover
                logger.warning("Neo4j stats failed: %s", exc)
        base.update({
            "engine": self.engine_name,
            "connected_to_neo4j": self.is_live,
            "neo4j_uri": settings.NEO4J_URI,
            "neo4j_error": None if self.is_live else self.last_error,
        })
        return base

    # ---- syncing ----------------------------------------------------------
    def push_to_neo4j(self) -> bool:
        """Copy the in-memory graph into Neo4j (wipes the target database first)."""
        if not self.is_live:
            return False
        from backend.graph.ontology import CYPHER_CONSTRAINTS
        g = in_memory_graph.graph
        with self._driver.session(database=settings.NEO4J_DATABASE) as s:
            s.run("MATCH (n) DETACH DELETE n")
            for stmt in CYPHER_CONSTRAINTS:
                try:
                    s.run(stmt)
                except Exception:
                    pass
            by_label: Dict[str, List[Dict[str, Any]]] = {}
            for nid, d in g.nodes(data=True):
                props = {k: v for k, v in _clean_value(dict(d)).items() if isinstance(v, (str, int, float, bool, list))}
                by_label.setdefault(in_memory_graph.label_of(nid), []).append(props)
            for label, batch in by_label.items():
                s.run(f"UNWIND $batch AS p CREATE (n:`{label}`) SET n = p", batch=batch)
            # Group by (relationship, source label, target label) so MATCH can use the id constraints.
            by_rel: Dict[tuple, List[Dict[str, Any]]] = {}
            for u, v, k, d in g.edges(keys=True, data=True):
                props = {a: b for a, b in d.items() if a != LABELS_KEY and isinstance(b, (str, int, float, bool))}
                key = (k, in_memory_graph.label_of(u), in_memory_graph.label_of(v))
                by_rel.setdefault(key, []).append({"a": u, "b": v, "p": props})
            for (rel, la, lb), batch in by_rel.items():
                s.run(
                    f"UNWIND $batch AS e MATCH (a:`{la}` {{id: e.a}}) MATCH (b:`{lb}` {{id: e.b}}) "
                    f"CREATE (a)-[r:`{rel}`]->(b) SET r = e.p",
                    batch=batch,
                )
        logger.info("Pushed %d nodes / %d edges to Neo4j", g.number_of_nodes(), g.number_of_edges())
        return True


graph_manager = GraphConnectionManager()
