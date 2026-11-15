"""
Document search (the "retrieval" in GraphRAG).

Policy documents are split into chunks, and every chunk is indexed two ways:

1. BM25 keyword index. Good at exact words: ward codes like "M/East", "ORS", "37.0".
2. Dense semantic vectors. Good at meaning: "staying cool" matches "cooling shelter".
   - Uses a small sentence-embedding model (fastembed, BAAI/bge-small-en-v1.5) when it can
     be downloaded (needs internet the first time, ~70 MB).
   - Otherwise uses LSA (TF-IDF + truncated SVD), a classic semantic method that needs
     no download.

The two ranked lists are merged with Reciprocal Rank Fusion (RRF):
    score(chunk) = sum over lists of 1 / (60 + rank_in_list)
which is a standard, parameter-light way to combine rankings from different scorers.
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np
from rank_bm25 import BM25Okapi

from backend.config import settings

logger = logging.getLogger("heatshield.search")

RRF_K = 60
_TOKEN = re.compile(r"[a-z0-9]+(?:/[a-z0-9]+)?")
_STOP = set("""a an the of and or to in on for with by is are was were be been as at from that this these those it its
which into than then there their they them we our you your not no can may must will shall should would could""".split())


def tokenize(text: str) -> List[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


@dataclass
class DocumentChunk:
    chunk_id: str
    document_id: str
    document_title: str
    document_short: str
    agency: str
    section: str
    content: str
    wards_mentioned: List[str] = field(default_factory=list)

    @property
    def citation(self) -> str:
        return f"{self.document_short}, {self.section}"


@dataclass
class SearchResult:
    chunk: DocumentChunk
    score: float
    bm25_rank: Optional[int]
    semantic_rank: Optional[int]

    def to_dict(self) -> Dict:
        c = self.chunk
        return {
            "chunk_id": c.chunk_id, "document_id": c.document_id, "document_title": c.document_title,
            "agency": c.agency, "section": c.section, "content": c.content, "citation": c.citation,
            "wards_mentioned": c.wards_mentioned, "score": round(self.score, 4),
            "bm25_rank": self.bm25_rank, "semantic_rank": self.semantic_rank,
        }


class HybridSearch:
    def __init__(self) -> None:
        self.chunks: List[DocumentChunk] = []
        self.bm25: Optional[BM25Okapi] = None
        self.dense: Optional[np.ndarray] = None
        self.method: str = "none"
        self._embedder = None
        self._lsa = None  # (vectorizer, svd)

    # ------------------------------------------------------------------ build
    def index(self, chunks: List[DocumentChunk], load_embeddings: bool = True) -> None:
        """Build BM25 + LSA right away; upgrade to neural embeddings in the background."""
        self.chunks = chunks
        texts = [f"{c.section}. {c.content}" for c in chunks]
        self.bm25 = BM25Okapi([tokenize(t) for t in texts])
        self._embedder = None
        self.dense = self._build_lsa(texts)
        logger.info("Indexed %d chunks (BM25 + %s)", len(chunks), self.method)
        if load_embeddings and settings.EMBEDDING_MODEL.lower() not in ("", "none", "off"):
            threading.Thread(target=self._upgrade_to_embeddings, args=(texts,), daemon=True).start()

    def _upgrade_to_embeddings(self, texts: List[str]) -> None:
        try:
            from fastembed import TextEmbedding
            embedder = TextEmbedding(settings.EMBEDDING_MODEL)
            vecs = _unit(np.array(list(embedder.embed(texts)), dtype=np.float32))
            if len(vecs) == len(self.chunks):          # index unchanged meanwhile
                self._embedder, self.dense = embedder, vecs
                self.method = f"neural embeddings ({settings.EMBEDDING_MODEL})"
                logger.info("Document search upgraded to %s", self.method)
        except Exception as exc:
            logger.info("Embedding model unavailable (%s). Staying on LSA.", str(exc).splitlines()[0][:120])

    def _build_lsa(self, texts: List[str]) -> Optional[np.ndarray]:
        try:
            from sklearn.decomposition import TruncatedSVD
            from sklearn.feature_extraction.text import TfidfVectorizer
            vec = TfidfVectorizer(tokenizer=tokenize, lowercase=False, ngram_range=(1, 2), sublinear_tf=True, token_pattern=None)
            tfidf = vec.fit_transform(texts)
            k = max(2, min(64, tfidf.shape[0] - 1, tfidf.shape[1] - 1))
            svd = TruncatedSVD(n_components=k, random_state=42)
            vecs = svd.fit_transform(tfidf)
            self._lsa = (vec, svd)
            self.method = f"LSA ({k} latent topics)"
            return _unit(vecs.astype(np.float32))
        except Exception as exc:  # pragma: no cover
            logger.warning("LSA failed: %s", exc)
            self.method = "BM25 only"
            return None

    def _embed_query(self, query: str) -> Optional[np.ndarray]:
        if self._embedder is not None:
            return _unit(np.array(list(self._embedder.query_embed([query])), dtype=np.float32))[0]
        if self._lsa is not None:
            vec, svd = self._lsa
            return _unit(svd.transform(vec.transform([query])).astype(np.float32))[0]
        return None

    # ----------------------------------------------------------------- search
    def search(self, query: str, top_k: int = 4) -> List[SearchResult]:
        if not self.chunks or self.bm25 is None:
            return []
        n = len(self.chunks)
        bm = self.bm25.get_scores(tokenize(query))
        bm_order = [i for i in np.argsort(-bm) if bm[i] > 0]

        sem_order: List[int] = []
        qv = self._embed_query(query)
        if qv is not None and self.dense is not None:
            sims = self.dense @ qv
            sem_order = [i for i in np.argsort(-sims) if sims[i] > 0.05]

        fused: Dict[int, float] = {}
        bm_rank = {i: r for r, i in enumerate(bm_order, 1)}
        sem_rank = {i: r for r, i in enumerate(sem_order, 1)}
        for i in range(n):
            s = 0.0
            if i in bm_rank:
                s += 1 / (RRF_K + bm_rank[i])
            if i in sem_rank:
                s += 1 / (RRF_K + sem_rank[i])
            if s:
                fused[i] = s
        ranked = sorted(fused, key=lambda i: -fused[i])[:top_k]
        return [SearchResult(self.chunks[i], fused[i], bm_rank.get(i), sem_rank.get(i)) for i in ranked]


def _unit(m: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return m / norms


doc_search = HybridSearch()
