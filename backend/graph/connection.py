"""
Neo4j Driver Connection & In-Memory Graph Fallback Engine
=========================================================
Provides seamless Neo4j database connectivity with intelligent in-memory fallback.
If Neo4j is unreachable, all graph traversal, Cypher queries, and visualization
operate via an embedded NetworkX graph populated with real Mumbai data.
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple
import networkx as nx
from neo4j import GraphDatabase, Driver
from backend.config import settings

logger = logging.getLogger("heatshield.graph")


class InMemoryGraphEngine:
    """
    An embedded in-memory Knowledge Graph engine backed by NetworkX.
    Executes standard read-only Cypher-like queries, neighborhood traversals,
    and graph statistics when Neo4j is offline.
    """
    def __init__(self):
        self.graph = nx.MultiDiGraph()
        self.nodes_by_label: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.vector_documents: List[Dict[str, Any]] = []

    def add_node(self, node_id: str, label: str, properties: Dict[str, Any]):
        props = dict(properties)
        props["id"] = node_id
        props["label"] = label
        self.graph.add_node(node_id, **props)
        if label not in self.nodes_by_label:
            self.nodes_by_label[label] = {}
        self.nodes_by_label[label][node_id] = props

    def add_edge(self, source_id: str, target_id: str, rel_type: str, properties: Optional[Dict[str, Any]] = None):
        props = properties or {}
        props["type"] = rel_type
        self.graph.add_edge(source_id, target_id, key=rel_type, rel_type=rel_type, **props)

    def get_stats(self) -> Dict[str, Any]:
        node_counts = {lbl: len(nodes) for lbl, nodes in self.nodes_by_label.items()}
        rel_counts: Dict[str, int] = {}
        for _, _, data in self.graph.edges(data=True):
            rt = data.get("rel_type", "RELATED_TO")
            rel_counts[rt] = rel_counts.get(rt, 0) + 1

        return {
            "mode": "in_memory_fallback",
            "connected_to_neo4j": False,
            "total_nodes": self.graph.number_of_nodes(),
            "total_relationships": self.graph.number_of_edges(),
            "nodes_by_label": node_counts,
            "relationships_by_type": rel_counts,
        }

    def get_subgraph(self, limit: int = 150) -> Dict[str, Any]:
        """Returns node and edge dictionaries formatted for vis-network / force-graph."""
        nodes = []
        edges = []
        node_keys = list(self.graph.nodes())[:limit]
        node_set = set(node_keys)

        for nid in node_keys:
            ndata = dict(self.graph.nodes[nid])
            lbl = ndata.get("label", "Node")
            name = ndata.get("name") or ndata.get("ward_name") or ndata.get("title") or nid
            nodes.append({
                "id": nid,
                "label": name,
                "group": lbl,
                "properties": ndata
            })

        for u, v, data in self.graph.edges(data=True):
            if u in node_set and v in node_set:
                edges.append({
                    "from": u,
                    "to": v,
                    "label": data.get("rel_type", "RELATED"),
                    "properties": {k: v for k, v in data.items() if k not in ("rel_type", "key")}
                })
                if len(edges) >= limit * 2:
                    break

        return {"nodes": nodes, "edges": edges}

    def execute_cypher_readonly(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Interprets common read-only Cypher query patterns in-memory.
        Handles:
        - MATCH (w:Ward) RETURN w.ward_id, w.ward_name, ...
        - MATCH (h:Hospital) WHERE ... RETURN ...
        - MATCH (w:Ward)-[:HAS_FACILITY]->(f) RETURN ...
        - MATCH (n) RETURN count(n)
        """
        c = cypher.strip()
        c_upper = c.upper()

        # Simple node label pattern: MATCH (n:Label) RETURN ...
        match_node = re.search(r"MATCH\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)\s*\)", c, re.IGNORECASE)
        match_rel = re.search(r"MATCH\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)\s*\)\s*-\s*\[\s*:?\s*([a-zA-Z0-9_]*)\s*\]\s*->\s*\(\s*([a-zA-Z0-9_]+)\s*:?\s*([a-zA-Z0-9_]*)\s*\)", c, re.IGNORECASE)

        results = []

        if match_rel:
            src_var, src_label, rel_type, tgt_var, tgt_label = match_rel.groups()
            for u, v, data in self.graph.edges(data=True):
                u_data = self.graph.nodes[u]
                v_data = self.graph.nodes[v]
                if u_data.get("label") == src_label:
                    if not rel_type or data.get("rel_type") == rel_type:
                        if not tgt_label or v_data.get("label") == tgt_label:
                            record = {
                                f"{src_var}_id": u,
                                f"{src_var}_name": u_data.get("ward_name") or u_data.get("name") or u,
                                "relationship": data.get("rel_type"),
                                f"{tgt_var}_id": v,
                                f"{tgt_var}_name": v_data.get("name") or v_data.get("ward_name") or v,
                                f"{tgt_var}_type": v_data.get("label")
                            }
                            # Include properties
                            for k, val in v_data.items():
                                if k not in record:
                                    record[f"{tgt_var}_{k}"] = val
                            results.append(record)

        elif match_node:
            var_name, label = match_node.groups()
            nodes = self.nodes_by_label.get(label, {})
            for nid, props in nodes.items():
                record = {}
                for k, v in props.items():
                    record[f"{var_name}.{k}"] = v
                    record[k] = v
                results.append(record)

        else:
            # Fallback: general node scan
            for nid, data in self.graph.nodes(data=True):
                results.append({"node_id": nid, "label": data.get("label"), "name": data.get("name") or data.get("ward_name") or nid})

        # Apply basic limit if present
        limit_match = re.search(r"LIMIT\s+(\d+)", c, re.IGNORECASE)
        if limit_match:
            limit_val = int(limit_match.group(1))
            results = results[:limit_val]

        return results


# Global in-memory engine instance
in_memory_graph = InMemoryGraphEngine()


class GraphConnectionManager:
    """Manages active Neo4j driver connection with transparent fallback."""
    def __init__(self):
        self._driver: Optional[Driver] = None
        self._is_live_neo4j: bool = False

    def connect(self) -> bool:
        try:
            driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
                connection_timeout=2.0
            )
            # Verify connectivity
            with driver.session(database=settings.NEO4J_DATABASE) as session:
                session.run("RETURN 1 AS test").single()
            self._driver = driver
            self._is_live_neo4j = True
            logger.info("Successfully connected to live Neo4j database at %s", settings.NEO4J_URI)
            return True
        except Exception as e:
            self._driver = None
            self._is_live_neo4j = False
            logger.warning("Neo4j connection could not be established: %s. Operating in High-Fidelity In-Memory Graph Fallback mode.", str(e))
            return False

    def is_live(self) -> bool:
        return self._is_live_neo4j

    def close(self):
        if self._driver:
            self._driver.close()
            self._driver = None
            self._is_live_neo4j = False

    def execute_read_cypher(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Executes read-only Cypher query against Neo4j or In-Memory graph."""
        if self._is_live_neo4j and self._driver:
            try:
                with self._driver.session(database=settings.NEO4J_DATABASE) as session:
                    result = session.run(cypher, params or {})
                    return [record.data() for record in result]
            except Exception as e:
                logger.error("Error executing Cypher on live Neo4j: %s. Falling back to in-memory.", str(e))

        return in_memory_graph.execute_cypher_readonly(cypher, params)

    def get_graph_stats(self) -> Dict[str, Any]:
        if self._is_live_neo4j and self._driver:
            try:
                with self._driver.session(database=settings.NEO4J_DATABASE) as session:
                    n_count = session.run("MATCH (n) RETURN count(n) AS cnt").single()["cnt"]
                    r_count = session.run("MATCH ()-[r]->() RETURN count(r) AS cnt").single()["cnt"]
                    labels = session.run("CALL db.labels() YIELD label RETURN label").values()
                    return {
                        "mode": "live_neo4j",
                        "connected_to_neo4j": True,
                        "uri": settings.NEO4J_URI,
                        "total_nodes": n_count,
                        "total_relationships": r_count,
                        "labels": [lbl[0] for lbl in labels]
                    }
            except Exception as e:
                logger.warning("Live Neo4j stats query failed: %s", str(e))

        return in_memory_graph.get_stats()

    def get_subgraph(self, limit: int = 150) -> Dict[str, Any]:
        if self._is_live_neo4j and self._driver:
            try:
                query = """
                MATCH (n)
                OPTIONAL MATCH (n)-[r]->(m)
                RETURN n, r, m
                LIMIT $limit
                """
                with self._driver.session(database=settings.NEO4J_DATABASE) as session:
                    records = session.run(query, {"limit": limit}).data()
                    nodes = {}
                    edges = []
                    for rec in records:
                        n = rec.get("n")
                        m = rec.get("m")
                        r = rec.get("r")
                        if n:
                            nid = n.get("id") or str(n.id)
                            lbl = list(n.labels)[0] if n.labels else "Node"
                            nodes[nid] = {"id": nid, "label": n.get("name") or n.get("ward_name") or nid, "group": lbl, "properties": dict(n)}
                        if m:
                            mid = m.get("id") or str(m.id)
                            lbl_m = list(m.labels)[0] if m.labels else "Node"
                            nodes[mid] = {"id": mid, "label": m.get("name") or m.get("ward_name") or mid, "group": lbl_m, "properties": dict(m)}
                        if r and n and m:
                            edges.append({
                                "from": n.get("id") or str(n.id),
                                "to": m.get("id") or str(m.id),
                                "label": r.type,
                                "properties": dict(r)
                            })
                    return {"nodes": list(nodes.values()), "edges": edges}
            except Exception as e:
                logger.warning("Failed live Neo4j subgraph fetch: %s", str(e))

        return in_memory_graph.get_subgraph(limit)


graph_manager = GraphConnectionManager()
