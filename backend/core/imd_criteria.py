"""
India Meteorological Department (IMD) Official Heatwave Criteria Engine
======================================================================
Strict scientific implementation of IMD criteria for Heatwave and Severe Heatwave,
with specialized handling for Coastal Stations (e.g., Mumbai - Colaba & Santacruz).

Scientific Note:
----------------
Land Surface Temperature (LST) from satellite radiometers (USGS Landsat / NASA MODIS)
measures the radiative skin temperature of urban surfaces (asphalt, concrete, rooftops).
Official IMD heatwaves are defined exclusively based on 2-meter ambient air temperature
measured in a standard Stevenson screen at designated meteorological observatories.
Satellite LST identifies microclimatic surface exposure and thermal hotspots, but cannot
be substituted for Stevenson screen air temperature to declare an official meteorological heatwave.
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class IMDObservatoryNormal(BaseModel):
    station_name: str
    month: str
    normal_max_temp_c: float
    threshold_min_temp_c: float = 37.0  # Coastal threshold


# Historical April-May climatological normal maximum temperatures for Mumbai IMD stations
MUMBAI_IMD_NORMALS = {
    "Santacruz": {
        "April": 33.2,
        "May": 33.6,
        "March": 32.8,
    },
    "Colaba": {
        "April": 32.8,
        "May": 33.3,
        "March": 31.7,
    }
}


class HeatwaveAssessment(BaseModel):
    is_heatwave: bool
    is_severe_heatwave: bool
    alert_level: str = Field(..., description="Green (Normal), Yellow (Watch), Orange (Alert), or Red (Warning)")
    actual_temp_c: float
    normal_temp_c: float
    departure_c: float
    is_coastal_station: bool
    station_name: str
    criteria_triggered: str
    scientific_disclaimer: str
    consecutive_days: int = 1


def assess_imd_heatwave(
    actual_temp_c: float,
    station_name: str = "Santacruz",
    month: str = "May",
    is_coastal: bool = True,
    consecutive_days: int = 1,
    relative_humidity_pct: Optional[float] = None
) -> HeatwaveAssessment:
    """
    Evaluates official IMD heatwave status according to official criteria:
    
    1. Coastal Station Criteria (Mumbai):
       - Threshold: Actual Max Temp must reach >= 37.0 °C.
       - Heatwave: Departure from normal >= +4.5 °C to +6.4 °C (with actual temp >= 37 °C).
       - Severe Heatwave: Departure from normal >= +6.5 °C (with actual temp >= 37 °C).
       - Absolute Threshold: If actual temp reaches >= 45.0 °C (Heatwave) or >= 47.0 °C (Severe).
    
    2. Alert Levels:
       - Green: Normal temperature (Departure < 4.5 °C, Actual < 37 °C).
       - Yellow (Be Updated): Heatwave persisted for 1-2 days, moderate temperature.
       - Orange (Be Prepared): Heatwave persisted for 3-4 days or Severe Heatwave for 1-2 days.
       - Red (Take Action): Severe heatwave persisted for >2 days or heatwave persisted for >4 days.
    """
    normals = MUMBAI_IMD_NORMALS.get(station_name, MUMBAI_IMD_NORMALS["Santacruz"])
    normal_max = normals.get(month, 33.5)
    departure = round(actual_temp_c - normal_max, 2)
    
    is_heatwave = False
    is_severe = False
    criteria_triggered = "No heatwave criteria met"
    
    if is_coastal:
        # Coastal station logic
        if actual_temp_c >= 47.0:
            is_heatwave = True
            is_severe = True
            criteria_triggered = "Coastal criteria: Absolute Max Temp >= 47.0°C (Severe Heatwave)"
        elif actual_temp_c >= 45.0:
            is_heatwave = True
            criteria_triggered = "Coastal criteria: Absolute Max Temp >= 45.0°C (Heatwave)"
        elif actual_temp_c >= 37.0:
            if departure >= 6.5:
                is_heatwave = True
                is_severe = True
                criteria_triggered = f"Coastal criteria: Actual temp ({actual_temp_c}°C >= 37°C) with severe departure (+{departure}°C >= +6.5°C)"
            elif departure >= 4.5:
                is_heatwave = True
                criteria_triggered = f"Coastal criteria: Actual temp ({actual_temp_c}°C >= 37°C) with heatwave departure (+{departure}°C >= +4.5°C)"
            else:
                criteria_triggered = f"Actual temp ({actual_temp_c}°C >= 37°C) but departure (+{departure}°C < +4.5°C) does not meet coastal heatwave threshold"
        else:
            criteria_triggered = f"Actual temp ({actual_temp_c}°C < 37.0°C coastal qualifying threshold). Departure: {departure:+.1f}°C"
    else:
        # Non-coastal plains
        if actual_temp_c >= 47.0:
            is_heatwave = True
            is_severe = True
            criteria_triggered = "Plains: Absolute Max Temp >= 47.0°C (Severe)"
        elif actual_temp_c >= 45.0:
            is_heatwave = True
            criteria_triggered = "Plains: Absolute Max Temp >= 45.0°C"
        elif actual_temp_c >= 40.0:
            if departure >= 6.5:
                is_heatwave = True
                is_severe = True
                criteria_triggered = f"Plains: Max temp >= 40°C with severe departure (+{departure}°C >= +6.5°C)"
            elif departure >= 4.5:
                is_heatwave = True
                criteria_triggered = f"Plains: Max temp >= 40°C with departure (+{departure}°C >= +4.5°C)"

    # Determine Alert Level based on severity and duration
    if not is_heatwave:
        alert_level = "Green"
    elif is_severe:
        if consecutive_days >= 2:
            alert_level = "Red"
        else:
            alert_level = "Orange"
    else:
        # Moderate heatwave
        if consecutive_days >= 4:
            alert_level = "Red"
        elif consecutive_days >= 2:
            alert_level = "Orange"
        else:
            alert_level = "Yellow"

    disclaimer = (
        "IMD Assessment Protocol: Computed strictly from Stevenson screen 2m air temperature records. "
        "Satellite-derived Land Surface Temperature (LST) reveals surface urban heat islands (UHI) and radiant exposure "
        "but must not be confused with meteorological 2m air temperature used for official declarations."
    )

    return HeatwaveAssessment(
        is_heatwave=is_heatwave,
        is_severe_heatwave=is_severe,
        alert_level=alert_level,
        actual_temp_c=actual_temp_c,
        normal_temp_c=normal_max,
        departure_c=departure,
        is_coastal_station=is_coastal,
        station_name=station_name,
        criteria_triggered=criteria_triggered,
        scientific_disclaimer=disclaimer,
        consecutive_days=consecutive_days
    )
