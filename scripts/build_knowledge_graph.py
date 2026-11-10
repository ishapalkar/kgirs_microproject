"""
Knowledge Graph Construction Script
===================================
Runs end-to-end ingestion and prints ontology node and relationship statistics.
"""

from backend.ingestion.ingest_all import run_full_ingestion


def main():
    print("=" * 70)
    print("BUILDING HEATSHIELD MUMBAI NEO4J KNOWLEDGE GRAPH")
    print("=" * 70)
    stats = run_full_ingestion()
    print("\nKnowledge Graph Build Complete!")
    print(f"Total Nodes: {stats.get('total_nodes')}")
    print(f"Total Relationships: {stats.get('total_relationships')}")
    print("\nNodes by Label:")
    for lbl, count in stats.get("nodes_by_label", {}).items():
        print(f"  • {lbl}: {count}")
    print("\nRelationships by Type:")
    for rt, count in stats.get("relationships_by_type", {}).items():
        print(f"  • {rt}: {count}")
    print("=" * 70)


if __name__ == "__main__":
    main()
