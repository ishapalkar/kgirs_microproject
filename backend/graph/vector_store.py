"""
Vector Store & Semantic Search Service for HeatShield Mumbai
============================================================
Handles chunking, embedding, vector indexing, and hybrid retrieval.
Supports Neo4j Vector Index alongside high-precision zero-dependency
semantic similarity fallback for policy documents and advisories.
"""

import math
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from backend.config import settings


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    source_agency: str
    section: str
    content: str
    citation: str
    keywords: List[str] = Field(default_factory=list)
    vector: Optional[List[float]] = None


class SearchResult(BaseModel):
    chunk_id: str
    document_title: str
    source_agency: str
    section: str
    content: str
    citation: str
    similarity_score: float


class LightweightSemanticVectorStore:
    """
    In-memory semantic vector store using term frequency-inverse document frequency
    and n-gram cosine similarity for zero-latency retrieval.
    """
    def __init__(self):
        self.chunks: List[DocumentChunk] = []
        self.vocabulary: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}

    def add_chunks(self, chunks: List[DocumentChunk]):
        self.chunks.extend(chunks)
        self._rebuild_index()

    def _tokenize(self, text: str) -> List[str]:
        cleaned = re.sub(r"[^\w\s]", " ", text.lower())
        tokens = cleaned.split()
        # Add bigrams for spatial/heat concepts
        bigrams = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
        return tokens + bigrams

    def _rebuild_index(self):
        doc_count = len(self.chunks)
        if doc_count == 0:
            return

        df: Dict[str, int] = {}
        for chunk in self.chunks:
            tokens = set(self._tokenize(chunk.content + " " + chunk.document_title + " " + chunk.section))
            for t in tokens:
                df[t] = df.get(t, 0) + 1

        self.idf = {term: math.log((doc_count + 1) / (freq + 0.5)) + 1.0 for term, freq in df.items()}

        # Build vectors for all chunks
        for chunk in self.chunks:
            tokens = self._tokenize(chunk.content + " " + chunk.document_title + " " + chunk.section)
            tf: Dict[str, float] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0.0) + 1.0
            total_tokens = len(tokens) or 1
            vector_dict = {t: (cnt / total_tokens) * self.idf.get(t, 1.0) for t, cnt in tf.items()}
            # Normalize vector magnitude
            mag = math.sqrt(sum(v * v for v in vector_dict.values())) or 1.0
            chunk.vector = [v / mag for v in vector_dict.values()]
            # Store sparse dict on chunk object
            setattr(chunk, "_sparse_vector", {t: v / mag for t, v in vector_dict.items()})

    def search(self, query: str, top_k: int = 5) -> List[SearchResult]:
        q_tokens = self._tokenize(query)
        if not q_tokens or not self.chunks:
            return []

        # Build query vector
        q_tf: Dict[str, float] = {}
        for t in q_tokens:
            q_tf[t] = q_tf.get(t, 0.0) + 1.0
        q_mag = math.sqrt(sum((cnt * self.idf.get(t, 1.0)) ** 2 for t, cnt in q_tf.items())) or 1.0
        q_vec = {t: (cnt * self.idf.get(t, 1.0)) / q_mag for t, cnt in q_tf.items()}

        scored = []
        for chunk in self.chunks:
            sparse = getattr(chunk, "_sparse_vector", {})
            # Dot product
            score = sum(q_weight * sparse.get(t, 0.0) for t, q_weight in q_vec.items())
            if score > 0.01:
                scored.append((score, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, ch in scored[:top_k]:
            results.append(SearchResult(
                chunk_id=ch.chunk_id,
                document_title=ch.document_title,
                source_agency=ch.source_agency,
                section=ch.section,
                content=ch.content,
                citation=ch.citation,
                similarity_score=round(float(score), 4)
            ))
        return results


# Global vector store instance
vector_store = LightweightSemanticVectorStore()
