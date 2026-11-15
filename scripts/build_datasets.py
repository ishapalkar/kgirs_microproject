"""
Build the processed datasets for HeatShield Mumbai from the files in data/sources/.

Run:  python -m scripts.build_datasets

Inputs (data/sources/)                      | Status
--------------------------------------------|-----------------------------------------------
bmc_wards_datameet.geojson                  | REAL  - 24 BMC ward boundaries (DataMeet, GitHub)
census_2011_wards.csv                       | REAL  - Census 2011 ward table published by MCGM
osm_facilities.tsv                          | REAL  - OpenStreetMap hospitals / parks / drinking water
ward_heat_estimates.json                    | ESTIMATE - hand-entered LST / NDVI per ward
heat_hotspots_estimates.json                | ESTIMATE - hand-entered hotspot localities
cooling_centres_illustrative.json           | ILLUSTRATIVE - example shelters, not an official list

Outputs (data/processed/)
- wards.geojson       real ward polygons + every ward attribute
- facilities.json     every facility, tagged with the ward it falls inside
- hotspots.json       hotspot localities (estimates)
- provenance.json     where each field comes from and how trustworthy it is
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from pyproj import Geod
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "sources"
OUT = ROOT / "data" / "processed"

# DataMeet uses short codes ("F/S"); the rest of the app uses long codes ("F/South").
SHORT_TO_LONG = {
    "F/S": "F/South", "F/N": "F/North", "G/S": "G/South", "G/N": "G/North",
    "H/E": "H/East", "H/W": "H/West", "K/E": "K/East", "K/W": "K/West",
    "M/E": "M/East", "M/W": "M/West", "P/S": "P/South", "P/N": "P/North",
    "R/S": "R/South", "R/C": "R/Central", "R/N": "R/North",
}
FACILITY_TYPES = {"H": "Hospital", "P": "Park", "W": "WaterPoint"}

GEOD = Geod(ellps="WGS84")


def long_code(short: str) -> str:
    return SHORT_TO_LONG.get(short, short)


def area_km2(geom) -> float:
    area, _ = GEOD.geometry_area_perimeter(geom)
    return round(abs(area) / 1e6, 2)


def load_census() -> dict:
    rows = {}
    with open(SRC / "census_2011_wards.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows[long_code(r["ward"])] = {k: (int(v) if k != "ward" else v) for k, v in r.items()}
    return rows


def load_osm() -> list[dict]:
    items = []
    with open(SRC / "osm_facilities.tsv", encoding="utf-8") as f:
        for kind, osm_id, name, lat, lon, beds, op_type in csv.reader(f, delimiter="\t"):
            ftype = FACILITY_TYPES[kind]
            items.append({
                "id": f"OSM-{osm_id}",
                "osm_id": osm_id,
                "name": name.strip() or {"WaterPoint": "Drinking water point", "Park": "Unnamed park",
                                         "Hospital": "Unnamed hospital"}[ftype],
                "type": ftype,
                "lat": float(lat),
                "lon": float(lon),
                "beds": int(beds) if beds.isdigit() else None,
                "operator_type": op_type or None,
                "source": "OpenStreetMap",
                "data_status": "real",
            })
    return items


def build() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    wards_src = json.loads((SRC / "bmc_wards_datameet.geojson").read_text(encoding="utf-8"))
    census = load_census()
    heat = json.loads((SRC / "ward_heat_estimates.json").read_text(encoding="utf-8"))

    polygons = []
    for feat in wards_src["features"]:
        wid = long_code(feat["properties"]["name"])
        polygons.append((wid, shape(feat["geometry"]), feat["geometry"]))

    # ---- Facilities: assign each point to the ward polygon that contains it ----
    def ward_of(lat: float, lon: float):
        p = Point(lon, lat)
        for wid, geom, _ in polygons:
            if geom.contains(p):
                return wid
        return None

    facilities = []
    dropped = 0
    for fac in load_osm():
        wid = ward_of(fac["lat"], fac["lon"])
        if wid is None:          # outside BMC limits (Thane, Navi Mumbai, sea...)
            dropped += 1
            continue
        fac["ward_id"] = wid
        facilities.append(fac)

    cooling = json.loads((SRC / "cooling_centres_illustrative.json").read_text(encoding="utf-8"))
    for c in cooling:
        facilities.append({
            "id": c["id"], "name": c["name"], "type": "CoolingCentre",
            "lat": c["lat"], "lon": c["lon"], "ward_id": c["ward_id"],
            "capacity_persons": c.get("capacity_persons"),
            "is_air_conditioned": c.get("is_air_conditioned"),
            "activation_trigger": c.get("activation_trigger"),
            "source": "Illustrative example (not an official BMC list)",
            "data_status": "illustrative",
        })

    # ---- Wards ----
    features = []
    for wid, geom, raw_geom in polygons:
        c = census[wid]
        h = heat[wid]
        area = area_km2(geom)
        pop = c["population"]
        counts = {t: sum(1 for f in facilities if f["ward_id"] == wid and f["type"] == t)
                  for t in ("Hospital", "Park", "WaterPoint", "CoolingCentre")}
        per100k = lambda n: round(n / pop * 100_000, 2)
        props = {
            "ward_id": wid,
            "ward_name": h["ward_name"],
            "zone": h["zone"],
            "area_km2": area,
            # Census 2011 (real)
            "population_total": pop,
            "households": c["households"],
            "population_density_per_sqkm": round(pop / area),
            "children_0_6_pct": round(c["age_0_6"] / pop * 100, 2),
            "slum_population": c["slum_population"],
            "slum_population_pct": round(c["slum_population"] / pop * 100, 2),
            "literacy_pct": round(c["literate"] / pop * 100, 2),
            "illiteracy_pct": round(c["illiterate"] / pop * 100, 2),
            "sex_ratio_f_per_1000m": round(c["female"] / c["male"] * 1000),
            # OpenStreetMap (real counts)
            "hospitals_count": counts["Hospital"],
            "parks_count": counts["Park"],
            "water_points_count": counts["WaterPoint"],
            "cooling_centres_count": counts["CoolingCentre"],
            "hospitals_per_100k": per100k(counts["Hospital"]),
            "parks_per_100k": per100k(counts["Park"]),
            "water_points_per_100k": per100k(counts["WaterPoint"]),
            # Heat layer (estimates)
            "mean_lst_celsius": h["mean_lst_celsius"],
            "max_lst_celsius": h["max_lst_celsius"],
            "mean_ndvi": h["mean_ndvi"],
            "air_temp_t2m_celsius": h["era5_t2m"],
            "relative_humidity_pct": h["era5_rh"],
        }
        features.append({"type": "Feature", "properties": props, "geometry": raw_geom})

    hotspots = json.loads((SRC / "heat_hotspots_estimates.json").read_text(encoding="utf-8"))
    for i, s in enumerate(hotspots, 1):
        s["id"] = f"HOT-{i:03d}"
        s["data_status"] = "estimate"

    provenance = {
        "statuses": {
            "real": "Taken directly from a published dataset.",
            "derived": "Calculated by this project from real data (e.g. density = population / polygon area).",
            "estimate": "Hand-entered representative value. Not computed from satellite imagery.",
            "illustrative": "Example records to demonstrate a feature. Not an official list.",
            "summary": "A shortened version of a longer official document.",
        },
        "fields": {
            "Ward boundaries": {"status": "real", "source": "DataMeet Municipal_Spatial_Data on GitHub (BMC_Wards.geojson)"},
            "Ward area": {"status": "derived", "source": "Geodesic area of each ward polygon"},
            "Population, households, slum population, children 0-6, literacy": {
                "status": "real", "source": "Census of India 2011, ward table published by the MCGM Public Health Department",
                "caveat": "Ward D's non-literate count is total minus literate, because the published row does not add up."},
            "Density, percentages, facilities per 100k people": {"status": "derived", "source": "Calculated from the rows above"},
            "Hospitals, parks, drinking-water points": {
                "status": "real", "source": "OpenStreetMap via the Overpass API (amenity=hospital, leisure=park, amenity=drinking_water)",
                "caveat": "Volunteer-mapped and uneven. Drinking-water points are sparse, and 'hospital' includes small nursing homes and clinics."},
            "Surface temperature, vegetation (NDVI), air temperature, humidity": {
                "status": "estimate", "source": "Hand-entered representative values, not processed from Landsat or ERA5"},
            "Heat hotspots": {"status": "estimate", "source": "Hand-entered localities with representative temperatures"},
            "Cooling shelters": {"status": "illustrative", "source": "Example shelters, not an official BMC list"},
            "Policy documents": {"status": "summary", "source": "Team-written summaries of the official plans, not the full text"},
        },
        "counts": {
            "wards": len(features),
            "facilities_total": len(facilities),
            "osm_points_outside_bmc_dropped": dropped,
            "by_type": {t: sum(1 for f in facilities if f["type"] == t)
                        for t in ("Hospital", "Park", "WaterPoint", "CoolingCentre")},
        },
    }

    (OUT / "wards.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    (OUT / "facilities.json").write_text(json.dumps(facilities, indent=1), encoding="utf-8")
    (OUT / "hotspots.json").write_text(json.dumps(hotspots, indent=1), encoding="utf-8")
    (OUT / "provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    return provenance["counts"]


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
