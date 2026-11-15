# Learn HeatShield Mumbai, part by part

This guide explains what every piece of the project does, in plain words, and why it is built that way.
Read it top to bottom once, then use the last section to practise for the viva.

---

## 1. The problem in one paragraph

Heat waves do not hurt every part of a city equally. A ward is in more danger when it is **hot**
(concrete, tin roofs, few trees), when its **people are easily harmed** (crowded slums, young children,
people who can't read a warning), and when there is **little help nearby** (few hospitals, parks or
drinking-water points). HeatShield puts these facts for all 24 BMC wards into one **knowledge graph**,
scores each ward, and lets you ask questions in English that are answered from the graph and from
policy documents (**GraphRAG**).

---

## 2. The big picture

```
data/sources/            real + estimated input files
      │  scripts/build_datasets.py   (joins them, assigns facilities to wards)
      ▼
data/processed/          wards.geojson, facilities.json, hotspots.json, provenance.json
      │  backend/ingestion/ingest_all.py   (runs when the backend starts)
      ▼
Knowledge graph  ──►  copied into Neo4j if Neo4j is running
      │
      ├── HVI scores        backend/core/vulnerability_model.py
      ├── Document search   backend/graph/vector_store.py + documents.py
      └── GraphRAG          backend/graph/graphrag_engine.py (+ llm.py)
      │
FastAPI  (backend/api/routes.py)  ──►  React dashboard (frontend/src)
```

---

## 3. The data, and how honest each piece is

Every dataset carries a label. The dashboard shows these labels too (page **Data & method**).

| Data | Status | Where it comes from |
| --- | --- | --- |
| 24 ward boundaries | **Real** | DataMeet's `BMC_Wards.geojson` on GitHub |
| Population, slum population, children 0–6, literacy | **Real** | Census 2011 ward table published by MCGM |
| Hospitals, parks, drinking-water points | **Real** | OpenStreetMap, downloaded with the Overpass API |
| Area, density, %, "per 100k people" | **Calculated** | From the real data above |
| Surface temperature, NDVI (vegetation) | **Estimate** | Hand-entered representative values |
| Heat hotspots | **Estimate** | Hand-entered localities |
| Cooling shelters | **Illustrative** | Examples only, not an official list |
| Policy documents | **Summary** | Team-written summaries of the official plans |

**Plain words:**

- *Census 2011* is still the newest census with ward-level numbers. The 24 wards add up to exactly
  12,442,373 people, Greater Mumbai's official total. A test checks this.
- *OpenStreetMap* is the "Wikipedia of maps". Volunteers add places, so coverage is uneven. In
  particular, there are only 76 drinking-water points, and "hospital" includes small nursing homes.
- *Point-in-polygon*: to decide which ward a hospital belongs to, we test whether its point lies inside
  each ward's polygon (`shapely`). Points outside every ward (Thane, Navi Mumbai) are dropped: 576 of them.
- *Geodesic area*: ward area is measured on the curved Earth (`pyproj`), not on a flat map. That's why
  M/East comes out at about 33 km², which matches published figures.
- *Why are temperatures estimates?* Computing real Land Surface Temperature means downloading Landsat
  images and averaging the thermal band inside each ward. That is the main next step (see §11).

To refresh OpenStreetMap data on your laptop:

```bash
python -m scripts.fetch_osm        # downloads hospitals / parks / water points
python -m scripts.build_datasets   # rebuilds data/processed/
```

---

## 4. The knowledge graph

A **knowledge graph** stores facts as **nodes** (things) and **relationships** (how things connect).
Both can have **properties** (key–value data).

```
(Hospital)-[:LOCATED_IN]->(Ward)<-[:ADJACENT_TO]-(Ward)
                            │
                [:HAS_POPULATION_GROUP]
                            ▼
                    (PopulationGroup)

(Document)-[:HAS_SECTION]->(Section)-[:MENTIONS]->(Ward)
(HeatAdvisory)-[:DEFINED_IN]->(Document)-[:ISSUED_BY]->(Organization)
```

| Node | How many | What it is |
| --- | --- | --- |
| Ward | 24 | Each BMC ward with census data, facility counts and HVI score |
| Hospital / Park / WaterPoint | 908 / 570 / 76 | OpenStreetMap places |
| CoolingCentre | 5 | Illustrative shelters |
| Locality | 13 | Heat hotspots (estimates) |
| PopulationGroup | 72 | Children 0–6, slum residents, non-literate residents, per ward |
| Document / Section | 3 / 19 | Policy documents and their sections |
| HeatAdvisory | 4 | Green, Yellow, Orange, Red alerts, parsed from the heat action plan |
| Organization | 3 | Who issued each document |

**Why a graph and not a table?** Questions like *"which policy sections talk about wards that border
Dharavi?"* need several hops: ward → neighbours → sections that mention them. In a graph that is one
query; in tables it is several joins.

**Two links make it more than a spreadsheet:**

- `ADJACENT_TO`: two wards are neighbours if their polygons touch (computed with `shapely`).
- `MENTIONS`: a document section is linked to a ward when its text names the ward ("M/East", "Ward L")
  or one of its places ("Govandi", "Kurla"). This connects **text** to **data**, which is what makes
  GraphRAG possible.

### Neo4j and the in-memory engine

- If a **Neo4j** server is running, the backend copies the whole graph into it at start-up and runs
  every query there.
- If not, it uses an **in-memory graph** (NetworkX) queried with **GrandCypher**, a real open-source
  Cypher interpreter. It truly understands `MATCH`, `WHERE`, `RETURN`, `ORDER BY`, `LIMIT` and
  `COUNT/SUM/AVG/MIN/MAX`. (The original version only *pretended* to: it ignored `WHERE` and `ORDER BY`.)
- GrandCypher does not support `OPTIONAL MATCH`, `WITH`, `UNWIND` or arithmetic. When you use them,
  you get an error that says so, plus the suggestion to start Neo4j.

Run Neo4j with Docker:

```bash
docker run -d --name heatshield-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/heatshield123 neo4j:5
```

Then restart the backend. The sidebar's **System** box shows which engine is in use.

### Read-only safety

`ensure_read_only()` in `backend/graph/connection.py` rejects any query containing `CREATE`, `MERGE`,
`SET`, `DELETE`, `REMOVE`, `DROP`, `LOAD CSV`, `FOREACH` or `CALL`, and any query with two statements.
Words inside quotes are ignored, so `WHERE f.name CONTAINS 'Set'` is still allowed. With Neo4j, the
session is also opened in READ mode, a second layer of protection.

---

## 5. The Heat Vulnerability Index (HVI)

```
HVI = wE × Exposure  +  wS × Sensitivity  +  wA × (1 − Adaptive capacity)
default weights: wE = 0.40, wS = 0.35, wA = 0.25   (they always add up to 1)
```

| Part | Question it answers | Made of |
| --- | --- | --- |
| Exposure (E) | How much heat does the ward get? | 65% surface temperature, 35% lack of vegetation |
| Sensitivity (S) | How easily are its people harmed? | 35% density, 25% slum share, 25% children 0–6, 15% non-literate share |
| Adaptive capacity (A) | How much help is nearby? | 45% hospitals, 35% parks, 20% water points (all per 100k people) |

**Min–max scaling.** Each indicator is turned into a number from 0 to 1:
`(value − lowest ward) / (highest ward − lowest ward)`. So 0 means "lowest in Mumbai" and 1 means
"highest in Mumbai". This makes different units (°C, %, people/km²) comparable.

**Why `1 − A`?** More capacity means *less* vulnerability, so capacity has to pull the score down.

**Categories:** Critical ≥ 0.70, High ≥ 0.55, Moderate ≥ 0.40, Low below that.

**Result with the default weights:** M/East (Govandi), L (Kurla) and G/North (Dharavi) come out
Critical. That matches the Mumbai Human Development Report and the city's own climate plan. The model
was not tuned to get this answer; it comes from the census and OpenStreetMap numbers.

**Important limitation:** HVI ranks wards *against each other*. It is a planning tool, not a prediction
of any person's health risk.

On the **Ward rankings** page you can move the weights; the backend recalculates every ward and the
arrows show how many places each ward moved.

---

## 6. Document search (the "R" in RAG)

The three policy documents are cut into **chunks** (one per section). Each chunk is indexed twice:

1. **BM25**: a classic keyword ranking. It rewards chunks that contain the query's rare words, and it
   doesn't over-reward a word repeated many times. Good for exact terms like "M/East" or "37.0".
2. **Semantic vectors**: each chunk becomes a list of numbers, so similar meanings land close together.
   - With internet on first run, a small neural model (**BAAI/bge-small-en-v1.5**, via `fastembed`)
     is downloaded and used.
   - Without it, the app uses **LSA** (Latent Semantic Analysis): TF-IDF word counts compressed with
     SVD into "topics". Chunks about the same topic end up close even if they use different words.
   - Similarity = **cosine similarity** (the angle between two vectors).

The two rankings are merged with **Reciprocal Rank Fusion**:

```
score(chunk) = 1 / (60 + rank in BM25)  +  1 / (60 + rank in semantic search)
```

A chunk that ranks well in both lists wins. The **Documents** page shows both ranks for every result,
so you can show the examiner exactly how fusion works.

To use the full official plans instead of summaries: put the PDFs in `data/documents/`, add an entry
to `manifest.json`, and restart. PDFs are split page by page.

---

## 7. GraphRAG, step by step

Code: `backend/graph/graphrag_engine.py`. Every answer shows these steps with their timings in the UI.

1. **Link entities.** Find wards in the question by code ("H/West", "Ward L") or place name ("Govandi"
   → M/East, "Dharavi" → G/North). Also find facility types ("hospital", "park") and numbers ("top 3").
2. **Search documents.** Run hybrid search to get the 4 best policy passages.
3. **Write Cypher.**
   - *With an LLM key:* the LLM gets the graph schema (`SCHEMA_TEXT` in `ontology.py`), the linked
     entities and two examples, and writes one read-only Cypher query. This is called
     **text-to-Cypher**.
   - *Without a key:* a rule picks the intent (ranking, compare, neighbours, facility count, policy…)
     and fills in a ready-made query template with the linked wards.
4. **Run Cypher.** The query runs on Neo4j or GrandCypher. If it fails, the LLM sees the error message
   and gets **one chance to repair** its query (a simple self-correction loop).
5. **Write the answer.**
   - *LLM:* it may only use the query rows and the passages, must cite them as **[G]** (graph) and
     **[D1]…[D4]** (documents), and must flag estimates.
   - *Rules:* a template turns the rows into sentences and attaches a policy passage only if it
     mentions a ward in the answer.
6. **Sub-graph.** The nodes used (wards in the rows, the cited sections) plus their neighbours are sent
   to the UI and drawn with the used ones outlined.

**Why is this "Graph" RAG and not plain RAG?** Plain RAG only retrieves text. Here, numeric facts
(population, HVI, counts) come from a **structured graph query**, which is exact. Text comes from
retrieval. The `MENTIONS` links tie the two together.

**Turning on the LLM:** create `.env` from `.env.example` and set `GEMINI_API_KEY` (free at
aistudio.google.com/apikey). The default model name `gemini-flash-latest` is an alias Google keeps
pointing at its current Flash model, and the code falls back to other models if one is retired. Any
OpenAI-compatible server also works, including a local **Ollama**.

---

## 8. The API

All under `http://localhost:8000/api/v1`. Interactive docs: `http://localhost:8000/docs`.

| Endpoint | What it returns |
| --- | --- |
| `GET /overview` | Headline numbers for the Overview page, all computed from data |
| `GET /geo/wards` | Ward polygons with every attribute and HVI |
| `GET /geo/facilities?type=Hospital&ward=L` | Facilities, filterable |
| `GET /vulnerability/wards` | All wards, ranked |
| `POST /vulnerability/calculate` | Re-scores all wards with your weights |
| `GET /vulnerability/ward/{id}` | One ward + neighbours, population groups, document mentions |
| `POST /graphrag/query` | Full GraphRAG answer with steps, Cypher, rows, citations, sub-graph |
| `POST /graphrag/cypher` | Runs a read-only Cypher query |
| `GET /graphrag/schema` | The schema the LLM sees, plus counts |
| `GET /evidence/search?q=` | Hybrid search with both ranks |
| `POST /evidence/assess-heatwave` | Applies IMD coastal heatwave rules |
| `GET /provenance` | Where each dataset comes from |

---

## 9. The dashboard

React 19 + TypeScript + Tailwind, built with Vite. Pages live in `frontend/src/pages/`.

| Page | Shows | Explain it as |
| --- | --- | --- |
| Overview | City coloured by risk; headline computed live | "The problem" |
| Map | Real ward shapes; colour by HVI, heat, slums, density or hospitals; facility layers | "Where" |
| Ward rankings | Weight sliders, ranked table, ward profile | "How the score works" |
| Ask the graph | Question → steps → Cypher → rows → sources → sub-graph | "GraphRAG" |
| Knowledge graph | Explore nodes; double-click to expand | "What's inside" |
| Query lab | Run raw Cypher; writes are blocked | "Querying directly" |
| Documents | Hybrid search with ranks; document reader; IMD checker | "Retrieval" |
| Data & method | Provenance, formula, limitations, system status | "Honesty" |

**Presentation mode** (button at top right) makes text larger and adds a bar with one talking point
per page. Use ← and → to move between pages.

**Design choices:**
- Colour: a cool grey base with a single teal for anything you can click. The four risk colours are
  used only for vulnerability, and always next to a word (Critical, High…), never colour alone.
  All text passes WCAG AA contrast in light and dark mode.
- Type: Bricolage Grotesque for headings, Public Sans for text (a typeface made for civic and
  government sites), JetBrains Mono only for code. The fonts are bundled, so the demo works offline.
- Accessibility: every control works with the keyboard and has a visible focus ring. The map and
  graph have keyboard alternatives (dropdowns), and motion is reduced when the OS asks for it.

---

## 10. Running it

```bash
# backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                          # open http://localhost:5173

# tests
pytest backend/tests -q              # 30 tests
```

---

## 11. Limitations and next steps (say these before the examiner does)

1. **Real surface temperature.** Download a cloud-free May Landsat 8/9 Collection 2 Level-2 scene
   (path 148, row 47) and compute the mean of band ST_B10 inside each ward polygon
   (`LST °C = DN × 0.00341802 + 149.0 − 273.15`). Same for NDVI from bands 4 and 5. This replaces the
   only estimated input to the index.
2. **Official cooling-centre list** from BMC disaster management, replacing the illustrative ones.
3. **Full policy texts** instead of summaries (just drop the PDFs in).
4. **Newer population** (WorldPop 2020 grids) to update Census 2011.
5. **Validation**: compare HVI with ward-level heat-illness hospital admissions, if BMC data can be obtained.

---

## 12. Viva practice

**Q: What is a knowledge graph, and why did you use one?**
Nodes for things, relationships for how they connect, properties for data. Our questions hop across
connections (ward → neighbours → documents that mention them), which a graph answers in one query.

**Q: What is GraphRAG? How is it different from RAG?**
RAG retrieves text passages and lets an LLM answer from them. GraphRAG also retrieves *structured facts*
from a knowledge graph. We do both: Cypher for exact numbers, hybrid search for policy text, and the
answer cites each.

**Q: What does text-to-Cypher mean? What if the LLM writes a bad query?**
The LLM is given the schema and writes Cypher. Every query passes a read-only check first. If it
errors, the error goes back to the LLM for one repair. If the LLM is unavailable, rule-based templates
take over.

**Q: How do you stop someone deleting the graph through the query lab?**
A validator blocks write keywords and multiple statements before anything runs, and Neo4j sessions are
opened read-only. The tests prove `DETACH DELETE`, `CREATE`, `SET`, `MERGE` and `CALL` are rejected.

**Q: Explain BM25, embeddings and reciprocal rank fusion.**
BM25 scores keyword matches, weighting rare words more. Embeddings or LSA place texts with similar
meaning close together, compared by cosine similarity. RRF adds `1/(60 + rank)` from each list, so
agreement between the two methods wins.

**Q: How is HVI calculated? Why min–max scaling?**
Weighted sum of exposure, sensitivity and (1 − capacity). Min–max turns different units into 0–1 so
they can be added. It makes the index relative to the other Mumbai wards.

**Q: Why are M/East, L and G/North Critical?**
They have the hottest surfaces (estimates), very high slum shares (84.9%, 84.0% and 60.4%), and low
adaptive capacity (0.13 to 0.21). M/East has one of the lowest hospital ratios in the city: 2.9 per
100,000 people. The ward profile's "Main reasons" lists the drivers for any ward.

**Q: Satellite surface temperature vs IMD air temperature?**
Surface (skin) temperature of roofs and roads can be over 45 °C while shaded air is 37 °C. IMD declares
heatwaves only from air temperature at stations: at least 37 °C and 4.5 °C above normal for coastal
stations. The IMD checker on the Documents page applies these rules.

**Q: How do you know a hospital is in a given ward?**
Point-in-polygon test against the real ward boundary. A test re-checks 200 of them.

**Q: Which parts of your data are not real?**
Surface temperature, NDVI and hotspots are estimates; cooling shelters are illustrative; documents are
summaries. They are labelled in the app and in `data/processed/provenance.json`.

**Q: What happens if Neo4j is not running?**
The same graph is held in memory and queried with GrandCypher, so the demo never breaks. The System box
shows which engine answered.
