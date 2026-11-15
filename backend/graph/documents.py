"""
Reads the policy documents in data/documents/ and turns them into:
  * search chunks (for the hybrid search index), and
  * graph nodes: Document, Section, Organization, HeatAdvisory, plus
    (Section)-[:MENTIONS]->(Ward) links found by matching ward codes and place names.

Supported formats: Markdown (.md, split on headings) and PDF (.pdf, split into ~900-character
passages). To use the official full-text plans, drop the PDFs into data/documents/ and add an
entry to manifest.json; they are picked up on the next start.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

from backend.config import DOCUMENTS_DIR
from backend.graph.vector_store import DocumentChunk

MAX_CHARS = 900
_ALERT = re.compile(r"\*\*(Green|Yellow|Orange|Red) Alert\s*\(([^)]*)\):\*\*\s*(.+)")


def _ward_patterns(wards: List[Dict]) -> List[Tuple[str, re.Pattern]]:
    """Regexes that recognise each ward by code ("M/East", "Ward L") or by place name ("Govandi")."""
    pats = []
    for w in wards:
        wid = w["ward_id"]
        terms = {re.escape(wid)}
        if "/" in wid:
            a, b = wid.split("/")
            terms.add(rf"{re.escape(a)}[/-]{b[0]}(?:{b[1:]})?\b")  # M/East, M-East, M/E
        places = [p.strip() for p in re.split(r"[/,]", w.get("ward_name", "")) if len(p.strip()) > 3]
        terms.update(re.escape(p) for p in places)
        if len(wid) == 1:  # single-letter wards need the word "Ward" to avoid false matches
            pattern = rf"\bWard\s+{wid}\b|" + "|".join(rf"\b{re.escape(p)}\b" for p in places)
        else:
            pattern = "|".join(rf"\b{t}" for t in terms)
        pats.append((wid, re.compile(pattern, re.IGNORECASE)))
    return pats


def _split_long(text: str) -> List[str]:
    if len(text) <= MAX_CHARS:
        return [text]
    parts, cur = [], ""
    for para in re.split(r"\n(?=\s*(?:[-*]|\d+\.)\s)|\n\n", text):
        if cur and len(cur) + len(para) > MAX_CHARS:
            parts.append(cur.strip())
            cur = ""
        cur += para + "\n"
    if cur.strip():
        parts.append(cur.strip())
    return parts


def _markdown_sections(text: str) -> List[Tuple[str, str]]:
    sections, title, buf = [], "Introduction", []
    for line in text.splitlines():
        if line.startswith("## "):
            if "".join(buf).strip():
                sections.append((title, "\n".join(buf).strip()))
            title, buf = line[3:].strip(), []
        elif line.startswith("# "):
            continue
        else:
            buf.append(line[4:] if line.startswith("### ") else line)
    if "".join(buf).strip():
        sections.append((title, "\n".join(buf).strip()))
    return sections


def _pdf_sections(path: Path) -> List[Tuple[str, str]]:
    from pypdf import PdfReader
    out = []
    for i, page in enumerate(PdfReader(str(path)).pages, 1):
        txt = re.sub(r"[ \t]+", " ", page.extract_text() or "").strip()
        if txt:
            out.append((f"Page {i}", txt))
    return out


def load_documents(wards: List[Dict]) -> Dict[str, list]:
    manifest = json.loads((DOCUMENTS_DIR / "manifest.json").read_text(encoding="utf-8"))
    patterns = _ward_patterns(wards)
    nodes, edges, chunks = [], [], []
    orgs: Dict[str, str] = {}

    for filename, meta in manifest.items():
        path = DOCUMENTS_DIR / filename
        if not path.exists():
            continue
        doc_id = meta["id"]
        nodes.append(("Document", doc_id, {"title": meta["title"], "name": meta["short"], "agency": meta["agency"],
                                           "year": meta["year"], "kind": meta.get("kind", "full text"),
                                           "file": filename}))
        org_id = orgs.setdefault(meta["agency"], f"ORG-{len(orgs) + 1}")
        edges.append((doc_id, org_id, "ISSUED_BY"))

        raw = path.read_text(encoding="utf-8") if path.suffix == ".md" else None
        sections = _markdown_sections(raw) if raw is not None else _pdf_sections(path)

        for s_idx, (title, body) in enumerate(sections, 1):
            for p_idx, piece in enumerate(_split_long(body), 1):
                cid = f"{doc_id}-S{s_idx}" + (f".{p_idx}" if p_idx > 1 else "")
                clean = re.sub(r"\*\*", "", piece)
                mentioned = [wid for wid, pat in patterns if pat.search(clean) or pat.search(title)]
                chunks.append(DocumentChunk(cid, doc_id, meta["title"], meta["short"], meta["agency"],
                                            title, clean, mentioned))
                nodes.append(("Section", cid, {"title": title, "name": title, "text": clean, "document_id": doc_id}))
                edges.append((doc_id, cid, "HAS_SECTION"))
                for wid in mentioned:
                    edges.append((cid, f"WARD-{wid}", "MENTIONS"))

        if raw:
            for m in _ALERT.finditer(raw):
                colour, tagline, desc = m.groups()
                aid = f"ADV-{colour.upper()}"
                nodes.append(("HeatAdvisory", aid, {"name": f"{colour} Alert", "stage": colour,
                                                    "tagline": tagline, "description": desc.strip()}))
                edges.append((aid, doc_id, "DEFINED_IN"))

    for name, oid in orgs.items():
        nodes.append(("Organization", oid, {"name": name}))
    return {"nodes": nodes, "edges": edges, "chunks": chunks}
