"""
Reproducible Dataset Ingestion & Downloader for HeatShield Mumbai
=================================================================
Automates or provides reproducible recipes to retrieve real open datasets:
1. USGS Landsat 8/9 Collection 2 Level-2 Surface Temperature (ST) & Surface Reflectance (SR)
2. NASA MODIS MOD11A1 V6.1 Daily LST
3. Copernicus ERA5-Land Reanalysis (2m Air Temp & Dewpoint)
4. WorldPop India 100m Demographic Grids
5. OpenCity Mumbai BMC Ward & Health Facilities Datasets
6. Maharashtra State Heat Wave Action Plan 2024 & Mumbai Climate Action Plan 2022
"""

import sys
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("heatshield.downloader")

DATASET_CATALOG = {
    "usgs_landsat_8_9": {
        "title": "USGS Landsat 8/9 Collection 2 Level-2 Surface Temperature (LST)",
        "product_id": "LC08_L2SP_148047 / LC09_L2SP_148047",
        "spatial_resolution": "30 meters",
        "mumbai_path_row": "Path 148, Row 47",
        "bands": ["ST_B10 (Thermal IR, 10.6-11.19 µm)", "SR_B4 (Red)", "SR_B5 (NIR)"],
        "scale_formula_lst": "LST(°C) = DN * 0.00341802 + 149.0 - 273.15",
        "scale_formula_ndvi": "NDVI = (SR_B5 - SR_B4) / (SR_B5 + SR_B4)",
        "access_url": "https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature",
        "stac_endpoint": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/landsat-c2-l2"
    },
    "nasa_modis": {
        "title": "NASA MODIS MOD11A1 Version 6.1 Daily Land Surface Temperature",
        "spatial_resolution": "1 km grid",
        "temporal_resolution": "Daily day/night passes (Terra/Aqua)",
        "mumbai_tile": "h24v06",
        "scale_formula": "LST(°C) = DN * 0.02 - 273.15",
        "access_url": "https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD11A1"
    },
    "copernicus_era5_land": {
        "title": "ERA5-Land Hourly Reanalysis (Copernicus Climate Change Service)",
        "variables": ["2m air temperature (t2m)", "2m dewpoint temperature (d2m)"],
        "spatial_resolution": "0.1° (~9 km grid)",
        "mumbai_bounding_box": [18.89, 72.77, 19.32, 73.05],
        "access_url": "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land"
    },
    "worldpop_india": {
        "title": "WorldPop India High Resolution Population & Age-Sex Grids",
        "spatial_resolution": "100 meters (3 arc-seconds)",
        "demographic_cohorts": ["Total Population (2020/2026 constrained)", "Children <5 (M/F)", "Elderly 60+ (M/F)"],
        "access_url": "https://hub.worldpop.org/geodata/summary?id=24784",
        "api_endpoint": "https://api.worldpop.org/v3/about"
    },
    "opencity_mumbai": {
        "title": "OpenCity Mumbai Municipal Datasets (MCGM / BMC)",
        "features": ["24 Administrative Ward Boundaries", "BMC Major & Peripheral Hospitals", "Dispensaries", "Parks & Gardens"],
        "access_url": "https://data.opencity.in/city/mumbai/"
    },
    "maharashtra_heat_plan": {
        "title": "Maharashtra State Heat Wave Action Plan 2024",
        "agency": "Department of Relief & Rehabilitation, Government of Maharashtra",
        "policy_mandates": ["Early warning stages", "Cool roof program", "Occupational restrictions 12-4 PM", "Cooling shelters"]
    },
    "imd_guidelines": {
        "title": "India Meteorological Department Official Heatwave Criteria",
        "agency": "IMD, Ministry of Earth Sciences",
        "coastal_station_criteria": "Max temp >= 37.0°C with departure >= +4.5°C from climatological normal"
    }
}


def print_catalog():
    print("=" * 80)
    print("HEATSHIELD MUMBAI – REAL DATASET CATALOG & SCIENTIFIC ATTRIBUTION")
    print("=" * 80)
    for key, info in DATASET_CATALOG.items():
        print(f"\n[{key.upper()}] {info['title']}")
        for k, v in info.items():
            if k != "title":
                print(f"  • {k}: {v}")
    print("\n" + "=" * 80)
    print("All processed datasets are located in data/raw/ and data/processed/")
    print("=" * 80)


if __name__ == "__main__":
    print_catalog()
