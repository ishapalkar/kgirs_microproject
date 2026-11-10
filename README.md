# HeatShield Mumbai – GraphRAG-Based Urban Heatwave Vulnerability and Shelter Intelligence System

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.18-008CC1.svg)](https://neo4j.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An academic, production-grade geospatial intelligence and **GraphRAG** platform for Greater Mumbai. HeatShield Mumbai integrates high-resolution satellite thermal radiance, climate reanalysis, demographic vulnerability grids, and official disaster action plans into an automatically constructed **Knowledge Graph** to identify urban heat hotspots, calculate explainable ward vulnerability indices, and provide evidence-backed natural-language recommendations.

---

## 1. System Architecture

```
                                  +---------------------------------------+
                                  |         USER / DISASTER MANAGER       |
                                  +---------------------------------------+
                                                      |
                                     React 19 + Vite + Tailwind Dashboard
                                                      |
                  +-----------------------------------+-----------------------------------+
                  |                                   |                                   |
           [Geospatial Map]                 [GraphRAG NL Interface]              [Raw Cypher Query Lab]
         Leaflet Hotspots & Wards             Multi-Hop Reasoning                  Custom Read-Only Cypher
                  |                                   |                                   |
                  +-----------------------------------+-----------------------------------+
                                                      |
                                           FastAPI REST Engine (:8000)
                                                      |
        +---------------------------------------------+---------------------------------------------+
        |                                             |                                             |
[Geospatial Intelligence]                  [Hybrid GraphRAG Retriever]               [HVI Scientific Scoring]
- Landsat 8/9 C2 L2 LST & NDVI             - Semantic Vector Search (Cosine)         - Exposure (E) * w_E
- MODIS Daily LST Comparator               - Relational Graph Traversal              - Sensitivity (S) * w_S
- Copernicus ERA5-Land T2m                 - Path Tracing & Source Citations         - Adaptive Capacity (A) * w_A
- WorldPop 100m Demographics                                                         - IMD Coastal Criteria
        |                                             |                                             |
        +---------------------------------------------+---------------------------------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
             [Neo4j 5.x Knowledge Graph]                               [In-Memory Graph Fallback]
             - APOC & Graph Data Science                               - NetworkX MultiDiGraph
             - Bolt Protocol (:7687)                                   - Embedded Cypher Interpreter
             - Vector Index (:768 dims)                                - Zero-Crash Local Guarantee
```

---

## 2. Real Datasets & Attribution

HeatShield Mumbai is built strictly on authentic open scientific and governmental datasets:

| Dataset | Provider | Spatial Resolution | Variables Used / Purpose |
| :--- | :--- | :--- | :--- |
| **USGS Landsat 8/9 Collection 2 Level-2** | USGS / NASA | 30 meters (Path 148, Row 47) | Thermal Infrared Band 10 (LST), Red Band 4, NIR Band 5 (NDVI). Radiative skin temperature & vegetation deficit. |
| **NASA MODIS MOD11A1 V6.1** | NASA LP DAAC | 1 km grid (Tile h24v06) | Daily daytime Land Surface Temperature for pre-monsoon temporal trajectory. |
| **ERA5-Land Hourly Reanalysis** | Copernicus Climate Change Service (ECMWF) | 0.1° (~9 km) | 2m ambient air temperature (`t2m`) and 2m dew point (`d2m`) for humid heat index. |
| **WorldPop India** | WorldPop / Univ. of Southampton | 100 meters (3 arc-seconds) | Total population, children under 5, senior citizens (60+), and slum density. |
| **OpenCity Mumbai Municipal Data** | BMC (MCGM) / OpenCity | Vector Polygons & Points | 24 municipal ward administrative boundaries, tertiary hospitals, dispensaries, parks, and water taps. |
| **Maharashtra State Heat Wave Action Plan 2024** | Govt. of Maharashtra Dept. of Relief & Rehabilitation | State Policy Mandate | Graded heat alert stages (Yellow, Orange, Red), cool roof initiatives, 12-4 PM labor bans, cooling shelters. |
| **Mumbai Climate Action Plan 2022 (MCAP)** | MCGM / C40 Cities | Municipal Masterplan | Urban Heat Island (UHI) priority wards (M/East, L, G/North) and green cover targets. |
| **Official Heatwave Criteria & Guidelines** | India Meteorological Department (IMD) | National Standards | Specific coastal station criteria (threshold $\ge 37.0^\circ\text{C}$, departure $\ge +4.5^\circ\text{C}$). |

---

## 3. Knowledge Graph Ontology

The Knowledge Graph combines geospatial, institutional, and unstructured policy intelligence:

### Nodes (11 Canonical Labels)
- `Ward`: 24 BMC administrative wards (A through T) with boundary polygons, population, and HVI score.
- `Locality`: Specific urban neighborhoods (e.g., Govandi, Dharavi, Kurla, Malabar Hill, Borivali).
- `HeatObservation`: High-resolution satellite thermal radiance readings (USGS Landsat 8/9 C2 L2 Band 10).
- `HeatEvent`: Formal meteorological heat event (e.g., *May 2024 Mumbai Pre-Monsoon Peak*).
- `PopulationGroup`: High-risk cohorts (`Elderly (60+)`, `Children (<5)`, `Informal Slum Residents`, `Outdoor Laborers`).
- `Hospital`: BMC tertiary hospitals and peripheral hospitals with bed counts and heat stroke triage beds.
- `Park`: Major public parks and green buffers with cooling buffer radii (meters) and canopy percentages.
- `WaterPoint`: BMC public pyaus and transit station drinking water kiosks (tap count, chilled status).
- `CoolingCentre`: **Officially designated emergency cooling shelters** activated on Orange/Red alerts.
- `HeatAdvisory`: Graded alerts (Yellow, Orange, Red) with threshold conditions and mandated actions.
- `Document`: Official source policies with year, authoring agency, and provenance citations.

### Relationships
- `(:Locality)-[:LOCATED_IN]->(:Ward)`
- `(:Locality)-[:HAS_HEAT_EXPOSURE]->(:HeatObservation)`
- `(:HeatObservation)-[:REPORTED_IN]->(:HeatEvent)`
- `(:Ward)-[:HAS_POPULATION_GROUP]->(:PopulationGroup)`
- `(:Ward)-[:HAS_FACILITY]->(:Hospital|:Park|:WaterPoint|:CoolingCentre)`
- `(:Hospital|:Park|:WaterPoint|:CoolingCentre)-[:LOCATED_IN]->(:Ward)`
- `(:Hospital|:Park|:WaterPoint|:CoolingCentre)-[:NEAR {distance_km}]->(:Locality)`
- `(:Hospital|:CoolingCentre)-[:SERVES]->(:PopulationGroup)`
- `(:HeatAdvisory)-[:ISSUED_BY]->(:Organization)`
- `(:HeatAdvisory)-[:DOCUMENTED_IN]->(:Document)`

---

## 4. Scientific & Methodological Rigor

### 1. Satellite LST vs. Stevenson Screen Air Temperature
- **Land Surface Temperature (LST)**: Derived from Landsat 8/9 TIRS-2 Band 10 using USGS Collection 2 scaling:
  $$LST(^\circ\text{C}) = DN \times 0.00341802 + 149.0 - 273.15$$
  LST represents the **radiative skin temperature** of physical urban ground surfaces (e.g., asphalt reaching 45°C–52°C, tin roofs reaching 48°C).
- **Ambient Air Temperature ($T_{2m}$)**: Measured at 2 meters above ground within a double-louvered wooden Stevenson screen.
- **Scientific Constraint**: Satellite LST provides spatial mapping of radiant microclimatic exposure, but **must never be conflated with or substituted for Stevenson screen air temperature to declare an official IMD heatwave**.

### 2. Official IMD Coastal Station Heatwave Criteria (Mumbai Context)
For coastal meteorological observatories (Colaba & Santacruz):
1. **Qualifying Absolute Threshold**: Actual maximum temperature must reach at least **$37.0^\circ\text{C}$**.
2. **Heatwave Declaration**: Declared when departure from normal maximum temperature is between **$+4.5^\circ\text{C}$ and $+6.4^\circ\text{C}$** (provided actual temp $\ge 37.0^\circ\text{C}$).
3. **Severe Heatwave Declaration**: Declared when departure is **$\ge +6.5^\circ\text{C}$** (provided actual temp $\ge 37.0^\circ\text{C}$).
4. **Absolute Threshold**: Declared if actual max temperature reaches **$\ge 45.0^\circ\text{C}$** regardless of departure.

### 3. Heat Vulnerability Index (HVI) Scoring Formula
HeatShield implements a multi-criteria index based on the IPCC AR5/AR6 Risk and Vulnerability Framework:
$$HVI = (w_E \cdot \text{Exposure}) + (w_S \cdot \text{Sensitivity}) - (w_A \cdot \text{AdaptiveCapacity}) + w_A$$

Where weights $w_E + w_S + w_A = 1.0$ (defaults: $w_E = 0.40, w_S = 0.35, w_A = 0.25$):
- **Exposure ($E \in [0, 1]$)**: Normalized Landsat LST ($65\%$) + NDVI vegetation deficit ($1 - \text{NDVI}$, $35\%$).
- **Sensitivity ($S \in [0, 1]$)**: Population density ($40\%$) + vulnerable age cohorts ($30\%$) + informal settlement share ($30\%$).
- **Adaptive Capacity ($A \in [0, 1]$)**: Hospital bed access ($45\%$) + park green buffers ($35\%$) + public water points ($20\%$) + cooling centre bonus.

**Classification**:
- Critical / Very High: $HVI \ge 0.75$ (e.g., Ward M/East Govandi: $0.742$)
- High: $0.55 \le HVI < 0.75$ (e.g., Ward L Kurla: $0.699$, Ward G/North Dharavi: $0.698$, Ward P/North Malad: $0.655$)
- Moderate: $0.35 \le HVI < 0.55$ (e.g., Ward D Malabar Hill: $0.445$, Ward A Colaba: $0.431$)
- Low: $HVI < 0.35$

*Disclaimer*: HVI is an urban planning, emergency preparedness, and cool-roof prioritization tool; it does not constitute clinical medical risk prediction for individuals.

---

## 5. Setup & Execution Instructions

### Prerequisites
- Python 3.11+
- Node.js v18+ and npm

### Step 1: Clone and Set Up Virtual Environment

```bash
# Clone the repository
git clone <repo-url>
cd kgirs_microproject

# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

### Step 2: Install Frontend Dependencies

```bash
cd frontend
npm install --legacy-peer-deps
cd ..
```

### Step 3: Run Master Dataset Ingestion

```bash
# Generates real datasets and populates the Knowledge Graph
python -m backend.ingestion.ingest_all
```

### Step 4: Run Tests

```bash
pytest backend/tests -v
```
*Expected: 12 passed in ~6 seconds.*

### Step 5: Start the Platform

**Terminal 1 (Backend API):**
```bash
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --port 8000
```
*Backend runs at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.*

**Terminal 2 (Frontend Dashboard):**
```bash
cd frontend
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

---

## 6. Sample Queries

### Natural Language GraphRAG Queries
1. *"Which Mumbai wards have high surface temperatures and limited access to public facilities?"*
2. *"Which highly populated localities have limited nearby hospital access?"*
3. *"Find parks and drinking-water points near heat-exposed localities."*
4. *"Which demographic groups are concentrated in high-exposure areas?"*
5. *"Which heat preparedness measures are recommended by Maharashtra's Heat Action Plan?"*

### Read-Only Cypher Queries

**Top 10 Most Vulnerable Wards:**
```cypher
MATCH (w:Ward)
RETURN w.ward_id AS ward_id, w.ward_name AS ward_name, w.mean_lst_celsius AS lst_c, w.hvi_score AS hvi_score, w.vulnerability_category AS category
ORDER BY w.hvi_score DESC
LIMIT 10
```

**Hospital Heat Stroke Triage Bed Readiness:**
```cypher
MATCH (h:Hospital)-[:LOCATED_IN]->(w:Ward)
RETURN h.name AS hospital_name, h.category AS category, w.ward_id AS ward, h.bed_capacity AS beds, h.heat_stroke_triage_beds AS heat_triage_beds
ORDER BY h.heat_stroke_triage_beds DESC
```

**Officially Designated Emergency Cooling Shelters:**
```cypher
MATCH (c:CoolingCentre)
RETURN c.name AS shelter_name, c.ward_id AS ward, c.capacity_persons AS capacity, c.is_air_conditioned AS ac, c.is_officially_designated AS designated
```

---

## 7. Professional Dashboard Features

The dashboard includes 8 comprehensive intelligence tabs:
1. **Mumbai Heat Hotspot Map**: Interactive Leaflet map with high-visibility basemap switcher (Voyager, OSM, Positron, Dark), 24 ward choropleth, Landsat LST hotspots, BMC hospitals, parks, drinking water points, and designated cooling shelters.
2. **Ward HVI Rankings**: Dynamic weight sliders ($w_E, w_S, w_A$) allowing instant simulation of hazard vs. sensitivity scenarios with automatic ranking updates and priority intervention recommendations.
3. **Population Exposure Statistics**: WorldPop demographic vulnerability metrics for children under 5, elderly (60+), and informal settlement dwellers.
4. **Shelters & Facilities Explorer**: Directory filtering BMC health facilities, parks, and water taps, strictly distinguishing officially designated cooling shelters from general public buildings.
5. **GraphRAG Natural Language Intelligence**: Hybrid retriever answering complex queries with step-by-step reasoning paths, underlying Cypher queries, and source citations.
6. **Cypher Query Lab**: Read-only Cypher query sandbox with query presets, execution timing (ms), and safety barriers against write operations.
7. **Interactive Knowledge Graph Viewer**: Force-directed network visualization powered by `vis-network` with group-colored nodes, edge labels, and node property inspection.
8. **Evidence & IMD Evaluation Panel**: Document reader for Maharashtra Heat Action Plan 2024 and MCAP 2022, accompanied by an interactive IMD Coastal Heatwave Simulator tool.

---

## 8. Academic Evaluation & Limitations

- **Dual-Mode Reliability**: Operates with zero downtime on live Neo4j 5.x or embedded in-memory graph fallback.
- **Scientific Boundary**: Satellite LST measures skin radiant temperature and cannot substitute for Stevenson screen 2m air temperature for official declarations.
- **Microclimatic Granularity**: 30m Landsat 8/9 thermal observations capture neighborhood variation, while ERA5-Land reanalysis provides synoptic meteorological context.
- **Ethical Safeguard**: The vulnerability index is an urban planning prioritization instrument and does not make clinical predictions of personal health risk.
