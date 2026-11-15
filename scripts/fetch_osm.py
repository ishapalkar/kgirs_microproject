"""
Refresh data/sources/osm_facilities.tsv from OpenStreetMap (run on your own computer).

    python -m scripts.fetch_osm
    python -m scripts.build_datasets

Downloads every hospital, named park and drinking-water point inside Mumbai's bounding box
from the Overpass API and writes one tab-separated row per place:
    kind  osm_id  name  lat  lon  beds  operator_type
kind is H (hospital), P (park) or W (water point). build_datasets.py later drops the points
that fall outside the BMC ward polygons.
"""

import csv
import sys

import httpx

from backend.config import SOURCES_DIR

BBOX = "18.89,72.77,19.32,73.05"   # south, west, north, east
QUERY = f"""[out:json][timeout:180];
(
  nwr["amenity"="hospital"]({BBOX});
  nwr["leisure"="park"]["name"]({BBOX});
  node["amenity"="drinking_water"]({BBOX});
);
out center tags;"""
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def fetch() -> list:
    headers = {"User-Agent": "HeatShield-Mumbai student project (educational use)"}
    for url in MIRRORS:
        try:
            print(f"Querying {url} …")
            r = httpx.post(url, data={"data": QUERY}, headers=headers, timeout=240)
            r.raise_for_status()
            return r.json()["elements"]
        except Exception as exc:
            print(f"  failed: {exc}")
    sys.exit("All Overpass mirrors failed. Try again later.")


def main() -> None:
    rows = []
    for e in fetch():
        t = e.get("tags", {})
        lat = e.get("lat") or e.get("center", {}).get("lat")
        lon = e.get("lon") or e.get("center", {}).get("lon")
        if lat is None or lon is None:
            continue
        kind = "H" if t.get("amenity") == "hospital" else "P" if t.get("leisure") == "park" else "W"
        name = (t.get("name") or t.get("name:en") or "").replace("\t", " ").replace("\n", " ")[:70]
        if kind == "H" and not name:
            continue  # unnamed hospital points are mostly mapping noise
        rows.append([kind, f"{e['type'][0]}{e['id']}", name, round(lat, 4), round(lon, 4),
                     t.get("beds", ""), (t.get("operator:type") or t.get("healthcare") or "")[:12]])
    out = SOURCES_DIR / "osm_facilities.tsv"
    with open(out, "w", encoding="utf-8", newline="") as f:
        csv.writer(f, delimiter="\t", lineterminator="\n").writerows(rows)
    print(f"Wrote {len(rows)} places to {out}")


if __name__ == "__main__":
    main()
