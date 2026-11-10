"""
Geospatial Intelligence API Routes
==================================
Serves USGS Landsat 8/9 LST & NDVI hotspots, BMC 24 Wards boundaries GeoJSON,
public facilities, NASA MODIS daily records, and ERA5-Land reanalysis observations.
"""

import json
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException

from backend.config import RAW_DATA_DIR, PROCESSED_DATA_DIR
from backend.core.imd_criteria import assess_imd_heatwave

router = APIRouter(prefix="/geospatial", tags=["Geospatial"])


@router.get("/hotspots")
def get_thermal_hotspots() -> List[Dict[str, Any]]:
    """Returns high-resolution Landsat 8/9 thermal hotspots across Mumbai."""
    path = RAW_DATA_DIR / "landsat" / "mumbai_thermal_hotspots.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Hotspots data not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/wards-geojson")
def get_wards_geojson() -> Dict[str, Any]:
    """Returns Mumbai 24 Administrative Wards GeoJSON with geometry and thermal attributes."""
    path = RAW_DATA_DIR / "opencity" / "mumbai_wards.geojson"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Wards GeoJSON not found")
    with open(path, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    # Attach computed HVI scores to properties
    hvi_path = PROCESSED_DATA_DIR / "mumbai_wards_hvi.json"
    if hvi_path.exists():
        with open(hvi_path, "r", encoding="utf-8") as f:
            hvi_map = {w["ward_id"]: w for w in json.load(f)}
        for feat in geojson.get("features", []):
            wid = feat["properties"]["ward_id"]
            if wid in hvi_map:
                feat["properties"].update(hvi_map[wid])

    return geojson


@router.get("/facilities")
def get_public_facilities(type: str = None) -> List[Dict[str, Any]]:
    """Returns BMC health facilities, parks, water points, and designated cooling shelters."""
    path = RAW_DATA_DIR / "opencity" / "bmc_facilities.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Facilities data not found")
    with open(path, "r", encoding="utf-8") as f:
        facs = json.load(f)
    if type:
        return [f for f in facs if f.get("type", "").lower() == type.lower()]
    return facs


@router.get("/modis-temporal")
def get_modis_daily_progression() -> List[Dict[str, Any]]:
    """Returns daily MODIS MOD11A1 Land Surface Temperature temporal trends for Mumbai."""
    path = RAW_DATA_DIR / "modis" / "modis_daily_lst.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="MODIS data not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/era5-meteorology")
def get_era5_meteorology() -> Dict[str, Any]:
    """Returns ERA5-Land Reanalysis 2m ambient air temperature, relative humidity, and IMD assessment."""
    path = RAW_DATA_DIR / "era5" / "era5_mumbai_summary.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="ERA5 data not found")
    with open(path, "r", encoding="utf-8") as f:
        summary = json.load(f)

    santacruz_t2m = summary["station_reference_santacruz"]["t2m_celsius"]
    imd_status = assess_imd_heatwave(
        actual_temp_c=santacruz_t2m,
        station_name="Santacruz",
        month="May",
        is_coastal=True,
        consecutive_days=2
    )
    summary["imd_official_assessment"] = imd_status.model_dump()
    return summary
