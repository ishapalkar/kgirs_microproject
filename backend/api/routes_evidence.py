"""
Evidence and Policy Document API Routes
=======================================
Provides authenticated document provenance, policy texts, IMD coastal criteria,
and interactive heatwave assessment for evidence-backed transparency.
"""

from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config import RAW_DATA_DIR
from backend.core.imd_criteria import assess_imd_heatwave, HeatwaveAssessment

router = APIRouter(prefix="/evidence", tags=["Evidence & Provenance"])


class HeatwaveCheckRequest(BaseModel):
    actual_max_temp_celsius: float = Field(..., ge=20.0, le=55.0)
    station_name: str = Field("Santacruz", description="Santacruz or Colaba")
    month: str = Field("May", description="Month name: March, April, or May")
    consecutive_days: int = Field(1, ge=1, le=14)


@router.get("/documents")
def get_policy_documents() -> List[Dict[str, Any]]:
    """Returns metadata and text for all official source documents ingested into HeatShield."""
    docs_dir = RAW_DATA_DIR / "documents"
    docs = []
    for file_path in docs_dir.glob("*.md"):
        content = file_path.read_text(encoding="utf-8")
        title_line = content.split("\n")[0].replace("#", "").strip()
        docs.append({
            "filename": file_path.name,
            "title": title_line,
            "char_count": len(content),
            "content": content
        })
    return docs


@router.get("/imd-criteria")
def get_imd_criteria_overview() -> Dict[str, Any]:
    """Returns official IMD criteria rules for coastal vs plain stations and the LST distinction."""
    return {
        "coastal_station_rules": {
            "qualifying_threshold_celsius": 37.0,
            "heatwave_departure_celsius": ">= +4.5°C to +6.4°C (provided actual >= 37.0°C)",
            "severe_heatwave_departure_celsius": ">= +6.5°C (provided actual >= 37.0°C)",
            "absolute_threshold_heatwave_celsius": 45.0,
            "absolute_threshold_severe_celsius": 47.0
        },
        "mumbai_observatories_normal_max_temp": {
            "Santacruz": {"March": 32.8, "April": 33.2, "May": 33.6},
            "Colaba": {"March": 31.7, "April": 32.8, "May": 33.3}
        },
        "scientific_distinction_lst_vs_t2m": (
            "Land Surface Temperature (LST) from USGS Landsat / NASA MODIS measures the skin radiant temperature "
            "of concrete, asphalt, and rooftops. Official IMD heatwaves are defined exclusively from Stevenson screen "
            "2-meter ambient air temperature. Satellite LST identifies microclimatic heat hotspots and exposure differentials, "
            "but must not be substituted for Stevenson screen air temperature to declare an official meteorological heatwave."
        )
    }


@router.post("/assess-heatwave", response_model=HeatwaveAssessment)
def evaluate_heatwave_status(request: HeatwaveCheckRequest) -> HeatwaveAssessment:
    """Interactively checks whether a given air temperature triggers an official IMD coastal heatwave."""
    return assess_imd_heatwave(
        actual_temp_c=request.actual_max_temp_celsius,
        station_name=request.station_name,
        month=request.month,
        is_coastal=True,
        consecutive_days=request.consecutive_days
    )
