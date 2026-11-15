"""
Knowledge-graph ontology: the node labels, relationship types and their properties.

`SCHEMA_TEXT` is the same information written for the LLM, so it knows exactly which
labels and properties exist when it writes Cypher.
"""

LABEL_WARD = "Ward"
LABEL_POPULATION_GROUP = "PopulationGroup"
LABEL_HOSPITAL = "Hospital"
LABEL_PARK = "Park"
LABEL_WATER_POINT = "WaterPoint"
LABEL_COOLING_CENTRE = "CoolingCentre"
LABEL_LOCALITY = "Locality"
LABEL_HEAT_ADVISORY = "HeatAdvisory"
LABEL_DOCUMENT = "Document"
LABEL_SECTION = "Section"
LABEL_ORGANIZATION = "Organization"

ALL_LABELS = [
    LABEL_WARD, LABEL_POPULATION_GROUP, LABEL_HOSPITAL, LABEL_PARK, LABEL_WATER_POINT,
    LABEL_COOLING_CENTRE, LABEL_LOCALITY, LABEL_HEAT_ADVISORY, LABEL_DOCUMENT,
    LABEL_SECTION, LABEL_ORGANIZATION,
]

REL_LOCATED_IN = "LOCATED_IN"
REL_ADJACENT_TO = "ADJACENT_TO"
REL_HAS_POPULATION_GROUP = "HAS_POPULATION_GROUP"
REL_HAS_SECTION = "HAS_SECTION"
REL_MENTIONS = "MENTIONS"
REL_ISSUED_BY = "ISSUED_BY"
REL_DEFINED_IN = "DEFINED_IN"

FACILITY_LABELS = [LABEL_HOSPITAL, LABEL_PARK, LABEL_WATER_POINT, LABEL_COOLING_CENTRE]

CYPHER_CONSTRAINTS = [
    f"CREATE CONSTRAINT {lbl.lower()}_id IF NOT EXISTS FOR (n:{lbl}) REQUIRE n.id IS UNIQUE"
    for lbl in ALL_LABELS
]

SCHEMA_TEXT = """
NODE LABELS AND PROPERTIES
(:Ward) 24 BMC administrative wards
    id ('WARD-M/East'), ward_id ('A','B','C','D','E','F/South','F/North','G/South','G/North','H/East','H/West',
    'K/East','K/West','L','M/East','M/West','N','P/South','P/North','R/South','R/Central','R/North','S','T'),
    ward_name (localities, e.g. 'Govandi / Mankhurd / Shivaji Nagar'), zone, area_km2,
    population_total, households, population_density_per_sqkm, children_0_6_pct, slum_population,
    slum_population_pct, literacy_pct, illiteracy_pct,
    hospitals_count, parks_count, water_points_count, cooling_centres_count,
    hospitals_per_100k, parks_per_100k, water_points_per_100k,
    mean_lst_celsius, max_lst_celsius, mean_ndvi (estimates),
    hvi_score (0-1), hvi_rank (1 = most vulnerable), vulnerability_category ('Critical','High','Moderate','Low'),
    exposure_score, sensitivity_score, adaptive_capacity_score
(:Hospital) id, name, ward_id, lat, lon, beds (often null), operator_type
(:Park) id, name, ward_id, lat, lon
(:WaterPoint) id, name, ward_id, lat, lon
(:CoolingCentre) id, name, ward_id, lat, lon, capacity_persons, is_air_conditioned  (illustrative examples)
(:Locality) id, name, ward_id, lat, lon, lst_celsius, ndvi, surface_type   (heat hotspots, estimates)
(:PopulationGroup) id, name ('Children 0-6','Slum residents','Non-literate residents'), ward_id, count, share_pct
(:HeatAdvisory) id, name ('Green Alert' ... 'Red Alert'), stage, description
(:Document) id, title, agency, year
(:Section) id, title, text, document_id
(:Organization) id, name

RELATIONSHIPS
(:Hospital|Park|WaterPoint|CoolingCentre|Locality)-[:LOCATED_IN]->(:Ward)
(:Ward)-[:ADJACENT_TO]->(:Ward)            (wards that share a border; stored in both directions)
(:Ward)-[:HAS_POPULATION_GROUP]->(:PopulationGroup)
(:Document)-[:HAS_SECTION]->(:Section)
(:Section)-[:MENTIONS]->(:Ward)
(:Document)-[:ISSUED_BY]->(:Organization)
(:HeatAdvisory)-[:DEFINED_IN]->(:Document)
""".strip()
