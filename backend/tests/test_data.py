"""The processed data is real and internally consistent."""
from backend.ingestion.ingest_all import store


def test_24_real_wards_with_census_totals():
    assert len(store.wards) == 24
    assert sum(w["population_total"] for w in store.wards) == 12_442_373   # Census 2011, Greater Mumbai


def test_ward_polygons_are_real_shapes_not_boxes():
    for f in store.wards_geojson["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        vertices = sum(len(ring) for poly in polys for ring in poly)
        assert vertices > 50, f["properties"]["ward_id"]


def test_facilities_are_inside_their_ward():
    from shapely.geometry import Point, shape
    shapes = {f["properties"]["ward_id"]: shape(f["geometry"]) for f in store.wards_geojson["features"]}
    osm = [f for f in store.facilities if f["source"] == "OpenStreetMap"]
    assert len(osm) > 1000
    for f in osm[:200]:
        assert shapes[f["ward_id"]].contains(Point(f["lon"], f["lat"]))


def test_every_dataset_has_provenance_label():
    statuses = {v["status"] for v in store.provenance["fields"].values()}
    assert {"real", "derived", "estimate", "illustrative"} <= statuses
    assert all(f["data_status"] in ("real", "illustrative") for f in store.facilities)
