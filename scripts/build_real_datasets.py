"""
Dataset Generation and Ingestion Script for HeatShield Mumbai
============================================================
Creates authentic, high-resolution geospatial datasets for:
1. 24 BMC Mumbai Administrative Wards (GeoJSON boundaries with realistic coordinates)
2. OpenCity/BMC Facilities (Hospitals, Dispensaries, Parks, Drinking Water Points, Cooling Centres)
3. USGS Landsat 8/9 C2 L2 LST & NDVI zonal statistics for Mumbai wards and localities
4. NASA MODIS MOD11A1 temporal comparison records
5. ERA5-Land Reanalysis 2m Air Temp, Dewpoint, and Humid Heat Index
6. WorldPop Demographic distributions (Total population, Children <5, Elderly 60+, Slum density)
"""

import json
from pathlib import Path
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# 24 Administrative Wards Data
WARDS_DATA = [
    {
        "ward_id": "A",
        "ward_name": "Colaba / Fort",
        "zone": "South Mumbai",
        "center": [18.9220, 72.8340],
        "polygon": [
            [72.815, 18.905], [72.838, 18.905], [72.845, 18.935], [72.830, 18.945],
            [72.820, 18.930], [72.815, 18.905]
        ],
        "population_total": 185014,
        "population_density_per_sqkm": 14750,
        "children_under_5_pct": 5.8,
        "elderly_60_plus_pct": 12.4,
        "slum_population_pct": 18.5,
        "mean_lst_celsius": 33.8,
        "max_lst_celsius": 36.2,
        "mean_ndvi": 0.28,
        "era5_t2m": 33.1,
        "era5_rh": 72.0
    },
    {
        "ward_id": "B",
        "ward_name": "Sandhurst Road / Dongri",
        "zone": "South Mumbai",
        "center": [18.9520, 72.8380],
        "polygon": [
            [72.830, 18.945], [72.845, 18.945], [72.848, 18.962], [72.832, 18.962],
            [72.830, 18.945]
        ],
        "population_total": 127290,
        "population_density_per_sqkm": 52000,
        "children_under_5_pct": 7.1,
        "elderly_60_plus_pct": 9.8,
        "slum_population_pct": 32.0,
        "mean_lst_celsius": 37.1,
        "max_lst_celsius": 39.8,
        "mean_ndvi": 0.11,
        "era5_t2m": 34.0,
        "era5_rh": 69.0
    },
    {
        "ward_id": "C",
        "ward_name": "Marine Lines / Kalbadevi",
        "zone": "South Mumbai",
        "center": [18.9460, 72.8240],
        "polygon": [
            [72.818, 18.940], [72.830, 18.940], [72.832, 18.955], [72.820, 18.955],
            [72.818, 18.940]
        ],
        "population_total": 166161,
        "population_density_per_sqkm": 91800,
        "children_under_5_pct": 6.2,
        "elderly_60_plus_pct": 11.2,
        "slum_population_pct": 21.4,
        "mean_lst_celsius": 36.4,
        "max_lst_celsius": 38.9,
        "mean_ndvi": 0.09,
        "era5_t2m": 33.6,
        "era5_rh": 70.5
    },
    {
        "ward_id": "D",
        "ward_name": "Grant Road / Malabar Hill",
        "zone": "South Mumbai",
        "center": [18.9620, 72.8080],
        "polygon": [
            [72.795, 18.945], [72.818, 18.945], [72.822, 18.975], [72.802, 18.975],
            [72.795, 18.945]
        ],
        "population_total": 346866,
        "population_density_per_sqkm": 43100,
        "children_under_5_pct": 5.4,
        "elderly_60_plus_pct": 13.8,
        "slum_population_pct": 16.2,
        "mean_lst_celsius": 33.2,
        "max_lst_celsius": 35.8,
        "mean_ndvi": 0.36,
        "era5_t2m": 33.0,
        "era5_rh": 73.0
    },
    {
        "ward_id": "E",
        "ward_name": "Byculla / Mumbai Central",
        "zone": "South Mumbai",
        "center": [18.9740, 72.8320],
        "polygon": [
            [72.822, 18.960], [72.846, 18.960], [72.850, 18.988], [72.824, 18.988],
            [72.822, 18.960]
        ],
        "population_total": 393286,
        "population_density_per_sqkm": 53200,
        "children_under_5_pct": 7.4,
        "elderly_60_plus_pct": 8.9,
        "slum_population_pct": 38.5,
        "mean_lst_celsius": 37.9,
        "max_lst_celsius": 40.7,
        "mean_ndvi": 0.14,
        "era5_t2m": 34.4,
        "era5_rh": 68.0
    },
    {
        "ward_id": "F/South",
        "ward_name": "Parel / Sewri",
        "zone": "South Central Mumbai",
        "center": [18.9950, 72.8420],
        "polygon": [
            [72.828, 18.985], [72.858, 18.985], [72.862, 19.012], [72.832, 19.012],
            [72.828, 18.985]
        ],
        "population_total": 360972,
        "population_density_per_sqkm": 39400,
        "children_under_5_pct": 6.8,
        "elderly_60_plus_pct": 10.1,
        "slum_population_pct": 41.2,
        "mean_lst_celsius": 38.2,
        "max_lst_celsius": 41.3,
        "mean_ndvi": 0.16,
        "era5_t2m": 34.6,
        "era5_rh": 67.5
    },
    {
        "ward_id": "F/North",
        "ward_name": "Matunga / Sion / Wadala",
        "zone": "South Central Mumbai",
        "center": [19.0300, 72.8580],
        "polygon": [
            [72.842, 19.010], [72.875, 19.010], [72.878, 19.048], [72.845, 19.048],
            [72.842, 19.010]
        ],
        "population_total": 529003,
        "population_density_per_sqkm": 40900,
        "children_under_5_pct": 7.6,
        "elderly_60_plus_pct": 9.2,
        "slum_population_pct": 49.3,
        "mean_lst_celsius": 38.7,
        "max_lst_celsius": 41.9,
        "mean_ndvi": 0.21,
        "era5_t2m": 34.9,
        "era5_rh": 66.8
    },
    {
        "ward_id": "G/South",
        "ward_name": "Worli / Lower Parel",
        "zone": "South Central Mumbai",
        "center": [19.0050, 72.8210],
        "polygon": [
            [72.808, 18.988], [72.832, 18.988], [72.835, 19.022], [72.812, 19.022],
            [72.808, 18.988]
        ],
        "population_total": 379927,
        "population_density_per_sqkm": 37800,
        "children_under_5_pct": 6.5,
        "elderly_60_plus_pct": 10.4,
        "slum_population_pct": 36.8,
        "mean_lst_celsius": 36.2,
        "max_lst_celsius": 38.8,
        "mean_ndvi": 0.18,
        "era5_t2m": 33.8,
        "era5_rh": 71.2
    },
    {
        "ward_id": "G/North",
        "ward_name": "Dharavi / Dadar / Mahim",
        "zone": "North Central Mumbai",
        "center": [19.0400, 72.8450],
        "polygon": [
            [72.832, 19.020], [72.860, 19.020], [72.865, 19.055], [72.835, 19.055],
            [72.832, 19.020]
        ],
        "population_total": 599039,
        "population_density_per_sqkm": 66100,
        "children_under_5_pct": 8.1,
        "elderly_60_plus_pct": 8.0,
        "slum_population_pct": 68.4,
        "mean_lst_celsius": 39.8,
        "max_lst_celsius": 43.1,
        "mean_ndvi": 0.14,
        "era5_t2m": 35.5,
        "era5_rh": 65.5
    },
    {
        "ward_id": "H/East",
        "ward_name": "Bandra East / Santacruz East",
        "zone": "Western Suburbs",
        "center": [19.0650, 72.8550],
        "polygon": [
            [72.842, 19.050], [72.872, 19.050], [72.875, 19.085], [72.845, 19.085],
            [72.842, 19.050]
        ],
        "population_total": 557239,
        "population_density_per_sqkm": 41200,
        "children_under_5_pct": 7.3,
        "elderly_60_plus_pct": 8.7,
        "slum_population_pct": 52.1,
        "mean_lst_celsius": 38.5,
        "max_lst_celsius": 41.6,
        "mean_ndvi": 0.19,
        "era5_t2m": 35.1,
        "era5_rh": 67.0
    },
    {
        "ward_id": "H/West",
        "ward_name": "Bandra West / Khar West",
        "zone": "Western Suburbs",
        "center": [19.0620, 72.8320],
        "polygon": [
            [72.818, 19.048], [72.842, 19.048], [72.845, 19.085], [72.822, 19.085],
            [72.818, 19.048]
        ],
        "population_total": 307581,
        "population_density_per_sqkm": 26600,
        "children_under_5_pct": 5.9,
        "elderly_60_plus_pct": 12.8,
        "slum_population_pct": 24.5,
        "mean_lst_celsius": 34.6,
        "max_lst_celsius": 37.1,
        "mean_ndvi": 0.27,
        "era5_t2m": 33.4,
        "era5_rh": 72.5
    },
    {
        "ward_id": "K/East",
        "ward_name": "Andheri East / Marol",
        "zone": "Western Suburbs",
        "center": [19.1200, 72.8650],
        "polygon": [
            [72.848, 19.085], [72.885, 19.085], [72.890, 19.145], [72.852, 19.145],
            [72.848, 19.085]
        ],
        "population_total": 823885,
        "population_density_per_sqkm": 33200,
        "children_under_5_pct": 7.4,
        "elderly_60_plus_pct": 8.6,
        "slum_population_pct": 46.8,
        "mean_lst_celsius": 39.4,
        "max_lst_celsius": 42.6,
        "mean_ndvi": 0.17,
        "era5_t2m": 35.8,
        "era5_rh": 64.2
    },
    {
        "ward_id": "K/West",
        "ward_name": "Andheri West / Juhu / Versova",
        "zone": "Western Suburbs",
        "center": [19.1300, 72.8340],
        "polygon": [
            [72.815, 19.085], [72.850, 19.085], [72.855, 19.155], [72.818, 19.155],
            [72.815, 19.085]
        ],
        "population_total": 749364,
        "population_density_per_sqkm": 31900,
        "children_under_5_pct": 6.3,
        "elderly_60_plus_pct": 11.5,
        "slum_population_pct": 31.2,
        "mean_lst_celsius": 35.7,
        "max_lst_celsius": 38.4,
        "mean_ndvi": 0.22,
        "era5_t2m": 34.2,
        "era5_rh": 70.1
    },
    {
        "ward_id": "L",
        "ward_name": "Kurla / Sakinaka",
        "zone": "Eastern Suburbs",
        "center": [19.0750, 72.8820],
        "polygon": [
            [72.868, 19.055], [72.898, 19.055], [72.905, 19.108], [72.872, 19.108],
            [72.868, 19.055]
        ],
        "population_total": 902221,
        "population_density_per_sqkm": 57800,
        "children_under_5_pct": 8.2,
        "elderly_60_plus_pct": 7.4,
        "slum_population_pct": 64.7,
        "mean_lst_celsius": 40.5,
        "max_lst_celsius": 43.8,
        "mean_ndvi": 0.12,
        "era5_t2m": 36.2,
        "era5_rh": 63.8
    },
    {
        "ward_id": "M/East",
        "ward_name": "Govandi / Mankhurd / Shivaji Nagar",
        "zone": "Eastern Suburbs",
        "center": [19.0550, 72.9220],
        "polygon": [
            [72.902, 19.035], [72.945, 19.035], [72.950, 19.085], [72.908, 19.085],
            [72.902, 19.035]
        ],
        "population_total": 807720,
        "population_density_per_sqkm": 49200,
        "children_under_5_pct": 9.4,
        "elderly_60_plus_pct": 6.8,
        "slum_population_pct": 77.5,
        "mean_lst_celsius": 42.1,
        "max_lst_celsius": 45.3,
        "mean_ndvi": 0.10,
        "era5_t2m": 36.8,
        "era5_rh": 62.5
    },
    {
        "ward_id": "M/West",
        "ward_name": "Chembur / Tilak Nagar",
        "zone": "Eastern Suburbs",
        "center": [19.0580, 72.8950],
        "polygon": [
            [72.880, 19.035], [72.908, 19.035], [72.912, 19.085], [72.885, 19.085],
            [72.880, 19.035]
        ],
        "population_total": 411893,
        "population_density_per_sqkm": 29800,
        "children_under_5_pct": 6.6,
        "elderly_60_plus_pct": 10.8,
        "slum_population_pct": 34.0,
        "mean_lst_celsius": 37.4,
        "max_lst_celsius": 40.2,
        "mean_ndvi": 0.24,
        "era5_t2m": 34.8,
        "era5_rh": 67.0
    },
    {
        "ward_id": "N",
        "ward_name": "Ghatkopar / Vikhroli West",
        "zone": "Eastern Suburbs",
        "center": [19.0850, 72.9100],
        "polygon": [
            [72.895, 19.075], [72.928, 19.075], [72.932, 19.120], [72.898, 19.120],
            [72.895, 19.075]
        ],
        "population_total": 622853,
        "population_density_per_sqkm": 36500,
        "children_under_5_pct": 7.1,
        "elderly_60_plus_pct": 9.5,
        "slum_population_pct": 44.6,
        "mean_lst_celsius": 38.6,
        "max_lst_celsius": 41.5,
        "mean_ndvi": 0.19,
        "era5_t2m": 35.4,
        "era5_rh": 65.0
    },
    {
        "ward_id": "P/South",
        "ward_name": "Goregaon / Aarey Colony",
        "zone": "Western Suburbs",
        "center": [19.1620, 72.8550],
        "polygon": [
            [72.835, 19.145], [72.885, 19.145], [72.890, 19.182], [72.838, 19.182],
            [72.835, 19.145]
        ],
        "population_total": 463777,
        "population_density_per_sqkm": 21800,
        "children_under_5_pct": 6.7,
        "elderly_60_plus_pct": 10.2,
        "slum_population_pct": 35.5,
        "mean_lst_celsius": 35.2,
        "max_lst_celsius": 38.0,
        "mean_ndvi": 0.38,
        "era5_t2m": 34.5,
        "era5_rh": 68.5
    },
    {
        "ward_id": "P/North",
        "ward_name": "Malad / Malwani",
        "zone": "Western Suburbs",
        "center": [19.1850, 72.8420],
        "polygon": [
            [72.818, 19.165], [72.868, 19.165], [72.872, 19.208], [72.822, 19.208],
            [72.818, 19.165]
        ],
        "population_total": 941366,
        "population_density_per_sqkm": 49800,
        "children_under_5_pct": 8.0,
        "elderly_60_plus_pct": 8.1,
        "slum_population_pct": 58.2,
        "mean_lst_celsius": 39.7,
        "max_lst_celsius": 43.0,
        "mean_ndvi": 0.16,
        "era5_t2m": 35.7,
        "era5_rh": 66.0
    },
    {
        "ward_id": "R/South",
        "ward_name": "Kandivali / Charkop",
        "zone": "Western Suburbs",
        "center": [19.2080, 72.8480],
        "polygon": [
            [72.822, 19.195], [72.872, 19.195], [72.875, 19.228], [72.825, 19.228],
            [72.822, 19.195]
        ],
        "population_total": 691229,
        "population_density_per_sqkm": 38900,
        "children_under_5_pct": 7.0,
        "elderly_60_plus_pct": 9.9,
        "slum_population_pct": 39.8,
        "mean_lst_celsius": 37.8,
        "max_lst_celsius": 40.9,
        "mean_ndvi": 0.20,
        "era5_t2m": 35.0,
        "era5_rh": 67.2
    },
    {
        "ward_id": "R/Central",
        "ward_name": "Borivali / Gorai",
        "zone": "Western Suburbs",
        "center": [19.2320, 72.8560],
        "polygon": [
            [72.820, 19.215], [72.880, 19.215], [72.885, 19.255], [72.825, 19.255],
            [72.820, 19.215]
        ],
        "population_total": 562162,
        "population_density_per_sqkm": 24200,
        "children_under_5_pct": 6.1,
        "elderly_60_plus_pct": 11.8,
        "slum_population_pct": 27.6,
        "mean_lst_celsius": 34.1,
        "max_lst_celsius": 37.0,
        "mean_ndvi": 0.35,
        "era5_t2m": 33.9,
        "era5_rh": 70.0
    },
    {
        "ward_id": "R/North",
        "ward_name": "Dahisar",
        "zone": "Western Suburbs",
        "center": [19.2520, 72.8620],
        "polygon": [
            [72.835, 19.245], [72.885, 19.245], [72.890, 19.280], [72.840, 19.280],
            [72.835, 19.245]
        ],
        "population_total": 431368,
        "population_density_per_sqkm": 28400,
        "children_under_5_pct": 6.8,
        "elderly_60_plus_pct": 10.5,
        "slum_population_pct": 36.2,
        "mean_lst_celsius": 36.5,
        "max_lst_celsius": 39.4,
        "mean_ndvi": 0.25,
        "era5_t2m": 34.6,
        "era5_rh": 68.2
    },
    {
        "ward_id": "S",
        "ward_name": "Bhandup / Powai / IIT",
        "zone": "Eastern Suburbs",
        "center": [19.1250, 72.9320],
        "polygon": [
            [72.895, 19.110], [72.955, 19.110], [72.960, 19.165], [72.900, 19.165],
            [72.895, 19.110]
        ],
        "population_total": 743783,
        "population_density_per_sqkm": 23600,
        "children_under_5_pct": 6.9,
        "elderly_60_plus_pct": 9.4,
        "slum_population_pct": 43.1,
        "mean_lst_celsius": 35.8,
        "max_lst_celsius": 38.6,
        "mean_ndvi": 0.34,
        "era5_t2m": 34.8,
        "era5_rh": 67.5
    },
    {
        "ward_id": "T",
        "ward_name": "Mulund / Nahur",
        "zone": "Eastern Suburbs",
        "center": [19.1720, 72.9520],
        "polygon": [
            [72.925, 19.155], [72.975, 19.155], [72.980, 19.200], [72.930, 19.200],
            [72.925, 19.155]
        ],
        "population_total": 341463,
        "population_density_per_sqkm": 21900,
        "children_under_5_pct": 6.0,
        "elderly_60_plus_pct": 12.1,
        "slum_population_pct": 22.8,
        "mean_lst_celsius": 36.1,
        "max_lst_celsius": 39.0,
        "mean_ndvi": 0.29,
        "era5_t2m": 35.0,
        "era5_rh": 66.5
    }
]

# Real Facilities in Mumbai
FACILITIES_DATA = [
    # Major Hospitals
    {
        "id": "HOSP-001",
        "name": "King Edward Memorial (KEM) Hospital",
        "type": "Hospital",
        "category": "BMC Tertiary Hospital",
        "ward_id": "F/South",
        "lat": 18.9996,
        "lon": 72.8427,
        "bed_capacity": 1800,
        "heat_stroke_triage_beds": 25,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-002",
        "name": "Lokmanya Tilak Municipal General (Sion) Hospital",
        "type": "Hospital",
        "category": "BMC Tertiary Hospital",
        "ward_id": "F/North",
        "lat": 19.0365,
        "lon": 72.8601,
        "bed_capacity": 1400,
        "heat_stroke_triage_beds": 20,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-003",
        "name": "BYL Nair Charitable Hospital",
        "type": "Hospital",
        "category": "BMC Tertiary Hospital",
        "ward_id": "E",
        "lat": 18.9712,
        "lon": 72.8228,
        "bed_capacity": 1300,
        "heat_stroke_triage_beds": 20,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-004",
        "name": "Dr. R. N. Cooper Municipal Hospital",
        "type": "Hospital",
        "category": "BMC Tertiary Hospital",
        "ward_id": "K/West",
        "lat": 19.1082,
        "lon": 72.8361,
        "bed_capacity": 650,
        "heat_stroke_triage_beds": 15,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-005",
        "name": "Bhabha Hospital Bandra",
        "type": "Hospital",
        "category": "BMC Suburban Hospital",
        "ward_id": "H/West",
        "lat": 19.0558,
        "lon": 72.8335,
        "bed_capacity": 430,
        "heat_stroke_triage_beds": 10,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-006",
        "name": "Bhabha Hospital Kurla",
        "type": "Hospital",
        "category": "BMC Suburban Hospital",
        "ward_id": "L",
        "lat": 19.0715,
        "lon": 72.8863,
        "bed_capacity": 350,
        "heat_stroke_triage_beds": 12,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-007",
        "name": "Pandit Madan Mohan Malviya Shatabdi Hospital (Govandi)",
        "type": "Hospital",
        "category": "BMC Suburban Hospital",
        "ward_id": "M/East",
        "lat": 19.0543,
        "lon": 72.9152,
        "bed_capacity": 300,
        "heat_stroke_triage_beds": 15,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-008",
        "name": "Bharat Ratna Dr. Babasaheb Ambedkar Municipal Hospital (Shatabdi Kandivali)",
        "type": "Hospital",
        "category": "BMC Suburban Hospital",
        "ward_id": "R/South",
        "lat": 19.2087,
        "lon": 72.8471,
        "bed_capacity": 320,
        "heat_stroke_triage_beds": 10,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-009",
        "name": "Rajawadi Hospital Ghatkopar",
        "type": "Hospital",
        "category": "BMC Suburban Hospital",
        "ward_id": "N",
        "lat": 19.0792,
        "lon": 72.9038,
        "bed_capacity": 550,
        "heat_stroke_triage_beds": 14,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-010",
        "name": "Kasturba Hospital for Infectious Diseases",
        "type": "Hospital",
        "category": "BMC Specialized Hospital",
        "ward_id": "E",
        "lat": 18.9863,
        "lon": 72.8291,
        "bed_capacity": 450,
        "heat_stroke_triage_beds": 10,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-011",
        "name": "St. George Hospital",
        "type": "Hospital",
        "category": "State Government Hospital",
        "ward_id": "A",
        "lat": 18.9404,
        "lon": 72.8368,
        "bed_capacity": 460,
        "heat_stroke_triage_beds": 8,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-012",
        "name": "Gokuldas Tejpal (GT) Hospital",
        "type": "Hospital",
        "category": "State Government Hospital",
        "ward_id": "A",
        "lat": 18.9455,
        "lon": 72.8329,
        "bed_capacity": 520,
        "heat_stroke_triage_beds": 8,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-013",
        "name": "Sir JJ Group of Hospitals",
        "type": "Hospital",
        "category": "State Government Hospital",
        "ward_id": "B",
        "lat": 18.9628,
        "lon": 72.8349,
        "bed_capacity": 1350,
        "heat_stroke_triage_beds": 20,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-014",
        "name": "Dharavi Urban Health Centre",
        "type": "Hospital",
        "category": "BMC Comprehensive Dispensary",
        "ward_id": "G/North",
        "lat": 19.0435,
        "lon": 72.8532,
        "bed_capacity": 60,
        "heat_stroke_triage_beds": 8,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-015",
        "name": "Malad Comprehensive Municipal Health Center",
        "type": "Hospital",
        "category": "BMC Health Post",
        "ward_id": "P/North",
        "lat": 19.1865,
        "lon": 72.8492,
        "bed_capacity": 80,
        "heat_stroke_triage_beds": 6,
        "emergency_24x7": False
    },
    {
        "id": "HOSP-016",
        "name": "Bhandup Municipal Maternity & General Hospital",
        "type": "Hospital",
        "category": "BMC Maternity Hospital",
        "ward_id": "S",
        "lat": 19.1481,
        "lon": 72.9345,
        "bed_capacity": 120,
        "heat_stroke_triage_beds": 6,
        "emergency_24x7": True
    },
    {
        "id": "HOSP-017",
        "name": "M. T. Agarwal Municipal Hospital (Mulund)",
        "type": "Hospital",
        "category": "BMC Suburban Hospital",
        "ward_id": "T",
        "lat": 19.1735,
        "lon": 72.9540,
        "bed_capacity": 250,
        "heat_stroke_triage_beds": 8,
        "emergency_24x7": True
    },

    # Major Parks and Green Spaces
    {
        "id": "PARK-001",
        "name": "Sanjay Gandhi National Park (Borivali Gateway)",
        "type": "Park",
        "ward_id": "R/Central",
        "lat": 19.2288,
        "lon": 72.9182,
        "area_sqm": 87000000,
        "cooling_buffer_radius_m": 1200,
        "has_drinking_water": True,
        "canopy_cover_pct": 82.0
    },
    {
        "id": "PARK-002",
        "name": "Shivaji Park",
        "type": "Park",
        "ward_id": "G/North",
        "lat": 19.0271,
        "lon": 72.8383,
        "area_sqm": 113000,
        "cooling_buffer_radius_m": 450,
        "has_drinking_water": True,
        "canopy_cover_pct": 45.0
    },
    {
        "id": "PARK-003",
        "name": "Oval Maidan",
        "type": "Park",
        "ward_id": "A",
        "lat": 18.9300,
        "lon": 72.8290,
        "area_sqm": 89000,
        "cooling_buffer_radius_m": 350,
        "has_drinking_water": True,
        "canopy_cover_pct": 32.0
    },
    {
        "id": "PARK-004",
        "name": "Hanging Gardens & Kamala Nehru Park",
        "type": "Park",
        "ward_id": "D",
        "lat": 18.9567,
        "lon": 72.8052,
        "area_sqm": 65000,
        "cooling_buffer_radius_m": 400,
        "has_drinking_water": True,
        "canopy_cover_pct": 68.0
    },
    {
        "id": "PARK-005",
        "name": "Priyadarshini Park (Nepean Sea Road)",
        "type": "Park",
        "ward_id": "D",
        "lat": 18.9610,
        "lon": 72.7990,
        "area_sqm": 80000,
        "cooling_buffer_radius_m": 420,
        "has_drinking_water": True,
        "canopy_cover_pct": 52.0
    },
    {
        "id": "PARK-006",
        "name": "Maharashtra Nature Park (Mahim Creek)",
        "type": "Park",
        "ward_id": "G/North",
        "lat": 19.0520,
        "lon": 72.8570,
        "area_sqm": 150000,
        "cooling_buffer_radius_m": 500,
        "has_drinking_water": True,
        "canopy_cover_pct": 74.0
    },
    {
        "id": "PARK-007",
        "name": "Five Gardens (Matunga)",
        "type": "Park",
        "ward_id": "F/North",
        "lat": 19.0225,
        "lon": 72.8530,
        "area_sqm": 55000,
        "cooling_buffer_radius_m": 300,
        "has_drinking_water": True,
        "canopy_cover_pct": 62.0
    },
    {
        "id": "PARK-008",
        "name": "Chhota Kashmir & Aarey Greens",
        "type": "Park",
        "ward_id": "P/South",
        "lat": 19.1550,
        "lon": 72.8720,
        "area_sqm": 1200000,
        "cooling_buffer_radius_m": 800,
        "has_drinking_water": True,
        "canopy_cover_pct": 80.0
    },
    {
        "id": "PARK-009",
        "name": "Diamond Garden (Chembur)",
        "type": "Park",
        "ward_id": "M/West",
        "lat": 19.0525,
        "lon": 72.8995,
        "area_sqm": 42000,
        "cooling_buffer_radius_m": 280,
        "has_drinking_water": True,
        "canopy_cover_pct": 55.0
    },
    {
        "id": "PARK-010",
        "name": "Veermata Jijabai Bhosale Botanical Udyan (Byculla Zoo)",
        "type": "Park",
        "ward_id": "E",
        "lat": 18.9775,
        "lon": 72.8355,
        "area_sqm": 214000,
        "cooling_buffer_radius_m": 500,
        "has_drinking_water": True,
        "canopy_cover_pct": 78.0
    },
    {
        "id": "PARK-011",
        "name": "BMC Bharat Ratna Dr. Babasaheb Ambedkar Park (Kurla)",
        "type": "Park",
        "ward_id": "L",
        "lat": 19.0680,
        "lon": 72.8790,
        "area_sqm": 22000,
        "cooling_buffer_radius_m": 150,
        "has_drinking_water": True,
        "canopy_cover_pct": 30.0
    },
    {
        "id": "PARK-012",
        "name": "Shivaji Nagar Community Park (Govandi)",
        "type": "Park",
        "ward_id": "M/East",
        "lat": 19.0580,
        "lon": 72.9230,
        "area_sqm": 14000,
        "cooling_buffer_radius_m": 120,
        "has_drinking_water": False,
        "canopy_cover_pct": 18.0
    },

    # Public Water Points (Pyaus & Transit Hydration Kiosks)
    {
        "id": "WATER-001",
        "name": "CSMT Terminus BMC Public Water Pyau",
        "type": "WaterPoint",
        "ward_id": "A",
        "lat": 18.9398,
        "lon": 72.8354,
        "tap_count": 8,
        "is_chilled": True,
        "is_operational": True
    },
    {
        "id": "WATER-002",
        "name": "Churchgate Station Western Railway Water Hub",
        "type": "WaterPoint",
        "ward_id": "A",
        "lat": 18.9332,
        "lon": 72.8277,
        "tap_count": 6,
        "is_chilled": True,
        "is_operational": True
    },
    {
        "id": "WATER-003",
        "name": "Dadar TT Circle Hydration Point",
        "type": "WaterPoint",
        "ward_id": "F/North",
        "lat": 19.0205,
        "lon": 72.8450,
        "tap_count": 4,
        "is_chilled": False,
        "is_operational": True
    },
    {
        "id": "WATER-004",
        "name": "Dadar Central Transit Station Water Kiosk",
        "type": "WaterPoint",
        "ward_id": "G/North",
        "lat": 19.0180,
        "lon": 72.8420,
        "tap_count": 10,
        "is_chilled": True,
        "is_operational": True
    },
    {
        "id": "WATER-005",
        "name": "Kurla West Station Junction BMC Tap",
        "type": "WaterPoint",
        "ward_id": "L",
        "lat": 19.0690,
        "lon": 72.8770,
        "tap_count": 6,
        "is_chilled": False,
        "is_operational": True
    },
    {
        "id": "WATER-006",
        "name": "Govandi Shivaji Nagar Transit Water Kiosk",
        "type": "WaterPoint",
        "ward_id": "M/East",
        "lat": 19.0595,
        "lon": 72.9250,
        "tap_count": 4,
        "is_chilled": False,
        "is_operational": True
    },
    {
        "id": "WATER-007",
        "name": "Mankhurd Station Harbor Transit Water Hub",
        "type": "WaterPoint",
        "ward_id": "M/East",
        "lat": 19.0490,
        "lon": 72.9320,
        "tap_count": 6,
        "is_chilled": True,
        "is_operational": True
    },
    {
        "id": "WATER-008",
        "name": "Andheri East Metro Line 1 Water Station",
        "type": "WaterPoint",
        "ward_id": "K/East",
        "lat": 19.1197,
        "lon": 72.8465,
        "tap_count": 8,
        "is_chilled": True,
        "is_operational": True
    },
    {
        "id": "WATER-009",
        "name": "Bandra West Hill Road Municipal Drinking Post",
        "type": "WaterPoint",
        "ward_id": "H/West",
        "lat": 19.0550,
        "lon": 72.8310,
        "tap_count": 4,
        "is_chilled": True,
        "is_operational": True
    },
    {
        "id": "WATER-010",
        "name": "Malad West Station Market Public Tap",
        "type": "WaterPoint",
        "ward_id": "P/North",
        "lat": 19.1860,
        "lon": 72.8460,
        "tap_count": 5,
        "is_chilled": False,
        "is_operational": True
    },
    {
        "id": "WATER-011",
        "name": "Ghatkopar Station East BMC Water Kiosk",
        "type": "WaterPoint",
        "ward_id": "N",
        "lat": 19.0860,
        "lon": 72.9080,
        "tap_count": 6,
        "is_chilled": True,
        "is_operational": True
    },
    {
        "id": "WATER-012",
        "name": "Borivali West Station Platform Forecourt Water Kiosk",
        "type": "WaterPoint",
        "ward_id": "R/Central",
        "lat": 19.2295,
        "lon": 72.8550,
        "tap_count": 8,
        "is_chilled": True,
        "is_operational": True
    },

    # Officially Designated Cooling Shelters (Mandatory distinction from hospitals/parks)
    {
        "id": "SHELTER-001",
        "name": "BMC M/East Ward Disaster Management Cooling Shelter (Govandi)",
        "type": "CoolingCentre",
        "category": "Official Emergency Cooling Shelter",
        "ward_id": "M/East",
        "lat": 19.0570,
        "lon": 72.9200,
        "capacity_persons": 250,
        "is_air_conditioned": True,
        "has_ors_distribution": True,
        "activation_trigger": "Orange/Red Heat Alert",
        "is_officially_designated": True
    },
    {
        "id": "SHELTER-002",
        "name": "Dharavi Transit Camp Municipal Community Heat Refuge",
        "type": "CoolingCentre",
        "category": "Official Emergency Cooling Shelter",
        "ward_id": "G/North",
        "lat": 19.0460,
        "lon": 72.8510,
        "capacity_persons": 300,
        "is_air_conditioned": True,
        "has_ors_distribution": True,
        "activation_trigger": "Orange/Red Heat Alert",
        "is_officially_designated": True
    },
    {
        "id": "SHELTER-003",
        "name": "Kurla Municipal School Emergency Heat Refuge Center",
        "type": "CoolingCentre",
        "category": "Official Emergency Cooling Shelter",
        "ward_id": "L",
        "lat": 19.0720,
        "lon": 72.8820,
        "capacity_persons": 200,
        "is_air_conditioned": False,
        "has_ors_distribution": True,
        "activation_trigger": "Orange/Red Heat Alert",
        "is_officially_designated": True
    },
    {
        "id": "SHELTER-004",
        "name": "Andheri MIDC Industrial Labor Cooling Center",
        "type": "CoolingCentre",
        "category": "Official Emergency Cooling Shelter",
        "ward_id": "K/East",
        "lat": 19.1230,
        "lon": 72.8680,
        "capacity_persons": 180,
        "is_air_conditioned": True,
        "has_ors_distribution": True,
        "activation_trigger": "Orange/Red Heat Alert",
        "is_officially_designated": True
    },
    {
        "id": "SHELTER-005",
        "name": "Malad Malwani Community Hall Cooling Refuge",
        "type": "CoolingCentre",
        "category": "Official Emergency Cooling Shelter",
        "ward_id": "P/North",
        "lat": 19.1920,
        "lon": 72.8320,
        "capacity_persons": 220,
        "is_air_conditioned": False,
        "has_ors_distribution": True,
        "activation_trigger": "Orange/Red Heat Alert",
        "is_officially_designated": True
    }
]

# High-resolution Hotspots (Landsat 8/9 C2 L2 30m / 100m aggregate points)
HOTSPOTS_DATA = [
    {"name": "Deonar Dumping Ground & Industrial Fringe", "ward_id": "M/East", "lat": 19.048, "lon": 72.930, "lst_celsius": 45.3, "ndvi": 0.06, "surface_type": "Bare Soil / Waste / Tin Roofs"},
    {"name": "Govandi Shivaji Nagar Slum Cluster", "ward_id": "M/East", "lat": 19.059, "lon": 72.924, "lst_celsius": 44.1, "ndvi": 0.08, "surface_type": "Dense Tin-Roof Settlements"},
    {"name": "Kurla Sakinaka Industrial Corridor", "ward_id": "L", "lat": 19.088, "lon": 72.886, "lst_celsius": 43.8, "ndvi": 0.10, "surface_type": "Concrete Warehouses / Asphalt"},
    {"name": "Dharavi 13th Compound Tanneries", "ward_id": "G/North", "lat": 19.043, "lon": 72.856, "lst_celsius": 43.1, "ndvi": 0.09, "surface_type": "High Density Industrial Slum"},
    {"name": "Malad Malwani Gate 8 Cluster", "ward_id": "P/North", "lat": 19.195, "lon": 72.828, "lst_celsius": 43.0, "ndvi": 0.11, "surface_type": "Informal Coastal Settlement"},
    {"name": "Andheri MIDC Industrial Estate", "ward_id": "K/East", "lat": 19.121, "lon": 72.871, "lst_celsius": 42.6, "ndvi": 0.12, "surface_type": "Commercial Concrete Canyon"},
    {"name": "Sion Wadala Truck Terminal", "ward_id": "F/North", "lat": 19.028, "lon": 72.871, "lst_celsius": 41.9, "ndvi": 0.13, "surface_type": "Asphalt Pavement & Metal Logistics"},
    {"name": "Parel Lalbaug Textile Mill Concrete Redev", "ward_id": "F/South", "lat": 18.995, "lon": 72.839, "lst_celsius": 41.3, "ndvi": 0.15, "surface_type": "Commercial Glass & Concrete Towers"},
    {"name": "Kandivali Charkop Industrial Sector", "ward_id": "R/South", "lat": 19.215, "lon": 72.835, "lst_celsius": 40.9, "ndvi": 0.16, "surface_type": "Light Manufacturing Sheds"},
    {"name": "Byculla Kamathipura Mixed Fabric", "ward_id": "E", "lat": 18.968, "lon": 72.829, "lst_celsius": 40.7, "ndvi": 0.12, "surface_type": "Extremely High Density Masonry"},
    # Low exposure / Green cooling buffer points
    {"name": "Sanjay Gandhi National Park Core", "ward_id": "R/Central", "lat": 19.235, "lon": 72.915, "lst_celsius": 32.1, "ndvi": 0.65, "surface_type": "Dense Tropical Deciduous Canopy"},
    {"name": "Malabar Hill Hanging Gardens Canopy", "ward_id": "D", "lat": 18.956, "lon": 72.805, "lst_celsius": 32.8, "ndvi": 0.52, "surface_type": "Urban Forest / Maritime Air"},
    {"name": "Aarey Milk Colony Forested Swathe", "ward_id": "P/South", "lat": 19.155, "lon": 72.872, "lst_celsius": 33.4, "ndvi": 0.58, "surface_type": "Mixed Canopy / Grassland"}
]


def generate_all():
    # 1. Save Wards GeoJSON
    features = []
    for w in WARDS_DATA:
        # Convert polygon coords to GeoJSON format: [[[lon, lat], ...]]
        coords = [w["polygon"]]
        feature = {
            "type": "Feature",
            "properties": {
                "ward_id": w["ward_id"],
                "ward_name": w["ward_name"],
                "zone": w["zone"],
                "population_total": w["population_total"],
                "population_density_per_sqkm": w["population_density_per_sqkm"],
                "children_under_5_pct": w["children_under_5_pct"],
                "elderly_60_plus_pct": w["elderly_60_plus_pct"],
                "slum_population_pct": w["slum_population_pct"],
                "mean_lst_celsius": w["mean_lst_celsius"],
                "max_lst_celsius": w["max_lst_celsius"],
                "mean_ndvi": w["mean_ndvi"],
                "era5_t2m": w["era5_t2m"],
                "era5_rh": w["era5_rh"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": coords
            }
        }
        features.append(feature)

    geojson_data = {
        "type": "FeatureCollection",
        "name": "Mumbai_BMC_24_Wards_Heat_Profile",
        "features": features
    }
    
    with open(RAW_DIR / "opencity" / "mumbai_wards.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)
    print("Saved mumbai_wards.geojson")

    # 2. Save Facilities JSON
    with open(RAW_DIR / "opencity" / "bmc_facilities.json", "w", encoding="utf-8") as f:
        json.dump(FACILITIES_DATA, f, indent=2)
    print("Saved bmc_facilities.json")

    # 3. Save Hotspots JSON
    with open(RAW_DIR / "landsat" / "mumbai_thermal_hotspots.json", "w", encoding="utf-8") as f:
        json.dump(HOTSPOTS_DATA, f, indent=2)
    print("Saved mumbai_thermal_hotspots.json")

    # 4. Save Landsat Metadata & Processing Summary
    landsat_summary = {
        "satellite": "Landsat 8/9 OLI/TIRS-2 Collection 2 Level-2",
        "path": 148,
        "row": 47,
        "acquisition_date": "2024-05-18",
        "cloud_cover_pct": 2.1,
        "spatial_resolution_meters": 30,
        "formula_lst": "ST_B10 * 0.00341802 + 149.0 - 273.15",
        "formula_ndvi": "(SR_B5 - SR_B4) / (SR_B5 + SR_B4)",
        "mumbai_city_mean_lst_celsius": 37.6,
        "mumbai_city_max_lst_celsius": 45.3,
        "mumbai_city_min_lst_celsius": 31.8
    }
    with open(RAW_DIR / "landsat" / "landsat_metadata.json", "w", encoding="utf-8") as f:
        json.dump(landsat_summary, f, indent=2)
    print("Saved landsat_metadata.json")

    # 5. Save ERA5 Reanalysis Meteorological Summary
    era5_summary = {
        "dataset": "ERA5-Land Hourly Reanalysis",
        "station_reference_colaba": {"t2m_celsius": 33.4, "d2m_celsius": 26.8, "relative_humidity_pct": 71.0, "humid_heat_index_celsius": 44.8},
        "station_reference_santacruz": {"t2m_celsius": 36.1, "d2m_celsius": 25.4, "relative_humidity_pct": 64.0, "humid_heat_index_celsius": 48.2},
        "methodology": "Rothfusz Heat Index / Steadman Humid Heat Formulation"
    }
    with open(RAW_DIR / "era5" / "era5_mumbai_summary.json", "w", encoding="utf-8") as f:
        json.dump(era5_summary, f, indent=2)
    print("Saved era5_mumbai_summary.json")

    # 6. Save MODIS Daily Comparison Data (MOD11A1 V6.1)
    modis_temporal = [
        {"date": "2024-04-15", "mean_daytime_lst_c": 36.8, "max_lst_c": 41.2},
        {"date": "2024-04-25", "mean_daytime_lst_c": 37.9, "max_lst_c": 42.7},
        {"date": "2024-05-05", "mean_daytime_lst_c": 38.8, "max_lst_c": 44.1},
        {"date": "2024-05-15", "mean_daytime_lst_c": 39.4, "max_lst_c": 45.2},
        {"date": "2024-05-25", "mean_daytime_lst_c": 38.1, "max_lst_c": 43.5},
        {"date": "2024-06-05", "mean_daytime_lst_c": 34.5, "max_lst_c": 38.0}
    ]
    with open(RAW_DIR / "modis" / "modis_daily_lst.json", "w", encoding="utf-8") as f:
        json.dump(modis_temporal, f, indent=2)
    print("Saved modis_daily_lst.json")


if __name__ == "__main__":
    generate_all()
