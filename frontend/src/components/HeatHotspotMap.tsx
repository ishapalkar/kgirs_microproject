import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../services/api';
import type { WardGeoJSONCollection, ThermalHotspot, PublicFacility } from '../types';
import {
  Flame,
  Shield,
  Hospital as HospitalIcon,
  Trees,
  Droplets,
  Layers,
  Map as MapIcon,
  RotateCcw,
  Tag,
  AlertTriangle,
  Info
} from 'lucide-react';

// High-resolution, 100% Keyless, Open GIS Basemap Tile Layers
const BASEMAP_TILES = {
  esri_streets: {
    name: 'Esri Streets (Crisp)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; High-Precision Municipal Basemap',
  },
  esri_topo: {
    name: 'Esri Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Topographic Relief & Urban Core',
  },
  esri_satellite: {
    name: 'Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; High-Resolution Earth Imagery',
  },
  esri_gray: {
    name: 'Clean Light Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Clean Cartographic Canvas',
  },
};

type BasemapKey = keyof typeof BASEMAP_TILES;

const MapController: React.FC<{ resetTrigger: number }> = ({ resetTrigger }) => {
  const map = useMap();
  useEffect(() => {
    if (resetTrigger > 0) {
      map.setView([19.076, 72.877], 11);
    }
  }, [resetTrigger, map]);
  return null;
};

export const HeatHotspotMap: React.FC = () => {
  const [wardsData, setWardsData] = useState<WardGeoJSONCollection | null>(null);
  const [hotspots, setHotspots] = useState<ThermalHotspot[]>([]);
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [selectedWard, setSelectedWard] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Basemap & visual clarity controls
  const [activeBasemap, setActiveBasemap] = useState<BasemapKey>('esri_streets');
  const [showWardLabels, setShowWardLabels] = useState<boolean>(true);
  const [resetCounter, setResetCounter] = useState<number>(0);

  // Layer toggles
  const [showWards, setShowWards] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [showShelters, setShowShelters] = useState<boolean>(true);
  const [showHospitals, setShowHospitals] = useState<boolean>(true);
  const [showParks, setShowParks] = useState<boolean>(true);
  const [showWater, setShowWater] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [w, h, f] = await Promise.all([
          api.getWardsGeoJSON(),
          api.getHotspots(),
          api.getFacilities(),
        ]);
        setWardsData(w);
        setHotspots(h);
        setFacilities(f);
      } catch (err) {
        console.error('Failed to load map layers:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Genesis Calibrated WCAG AA high-contrast thermal ramp
  const getWardColor = (hvi: number = 0.5) => {
    if (hvi >= 0.70) return '#EF4444'; // Critical (Genesis Error/Red)
    if (hvi >= 0.55) return '#EA580C'; // High (Deep Orange)
    if (hvi >= 0.40) return '#F59E0B'; // Moderate (Genesis Warning/Amber)
    return '#10B981'; // Low (Genesis Success/Emerald)
  };

  const wardStyle = (feature: any) => {
    const hvi = feature?.properties?.hvi_score || 0.5;
    const isSelected = selectedWard?.ward_id === feature?.properties?.ward_id;
    return {
      fillColor: getWardColor(hvi),
      weight: isSelected ? 3.5 : 1.5,
      opacity: 1,
      color: isSelected ? '#6366F1' : '#FFFFFF',
      fillOpacity: isSelected ? 0.85 : 0.62,
    };
  };

  const onEachWard = (feature: any, layer: any) => {
    const props = feature.properties;
    layer.on({
      click: () => {
        setSelectedWard(props);
      },
      mouseover: (e: any) => {
        e.target.setStyle({ fillOpacity: 0.85, weight: 2.5, color: '#6366F1' });
      },
      mouseout: (e: any) => {
        e.target.setStyle(wardStyle(feature));
      },
    });

    if (props?.ward_id) {
      layer.bindTooltip(
        `<div class="text-center font-bold">Ward ${props.ward_id}<br/><span class="text-[9px] font-normal text-[#6B6B6B]">${props.ward_name?.split('/')[0]}</span></div>`,
        {
          permanent: showWardLabels,
          direction: 'center',
          className: 'ward-label-tooltip',
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Gallery Cards (Genesis Spec: White surface, 1px border #E8E8EC, 12px radius, hover lift -2px, subtle shadow) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px transition-all duration-200 hover:-translate-y-0.5 hover:shadow-genesis-card flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-[6px] bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center shrink-0">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#6B6B6B]">Peak Landsat LST</div>
            <div className="text-2xl font-bold font-mono tracking-tight text-[#0A0A0A]">45.3°C</div>
            <div className="text-[11px] font-medium text-[#EF4444]">Deonar / Shivaji Nagar</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px transition-all duration-200 hover:-translate-y-0.5 hover:shadow-genesis-card flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-[6px] bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#6B6B6B]">IMD Santacruz T2m</div>
            <div className="text-2xl font-bold font-mono tracking-tight text-[#0A0A0A]">36.1°C</div>
            <div className="text-[11px] font-medium text-[#6B6B6B]">2m Stevenson screen</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px transition-all duration-200 hover:-translate-y-0.5 hover:shadow-genesis-card flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-[6px] bg-[#10B981]/10 text-[#10B981] flex items-center justify-center shrink-0">
            <Trees className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#6B6B6B]">Canopy Cool Buffer</div>
            <div className="text-2xl font-bold font-mono tracking-tight text-[#0A0A0A]">32.1°C</div>
            <div className="text-[11px] font-medium text-[#10B981]">SGNP Borivali Forest</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px transition-all duration-200 hover:-translate-y-0.5 hover:shadow-genesis-card flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-[6px] bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-[#6B6B6B]">Designated Shelters</div>
            <div className="text-2xl font-bold font-mono tracking-tight text-[#0A0A0A]">5 Active</div>
            <div className="text-[11px] font-medium text-[#6366F1]">Govandi, Dharavi, Kurla</div>
          </div>
        </div>
      </div>

      {/* Main Map + Inspection Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-3 h-[640px] bg-white rounded-12px overflow-hidden border border-[#E8E8EC] relative shadow-sm">
          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="flex items-center space-x-3 text-[#6B6B6B] text-sm">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#6366F1] border-t-transparent" />
                <span>Loading Esri high-precision cartography...</span>
              </div>
            </div>
          )}

          {/* Top Left: Clean Basemap Style Switcher */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md border border-[#E8E8EC] p-1.5 rounded-12px shadow-genesis-card text-xs">
            <span className="text-[11px] font-medium text-[#6B6B6B] px-2 flex items-center gap-1.5">
              <MapIcon className="h-3.5 w-3.5 text-[#6366F1]" />
              <span>Map Style:</span>
            </span>

            {(['esri_streets', 'esri_topo', 'esri_satellite', 'esri_gray'] as BasemapKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveBasemap(key)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all ${
                  activeBasemap === key
                    ? 'bg-[#6366F1] text-white shadow-genesis-glow -translate-y-[1px]'
                    : 'text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F3F4F6]'
                }`}
              >
                {BASEMAP_TILES[key].name}
              </button>
            ))}

            <div className="h-4 w-px bg-[#E8E8EC] mx-1" />

            <button
              onClick={() => setShowWardLabels(!showWardLabels)}
              title="Toggle Ward Name Badges on Map"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all ${
                showWardLabels
                  ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/30'
                  : 'text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F3F4F6]'
              }`}
            >
              <Tag className="h-3 w-3" />
              <span>Labels {showWardLabels ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setResetCounter((c) => c + 1)}
              title="Reset View to Mumbai"
              className="p-1.5 rounded-[6px] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F3F4F6] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Top Right: Layer Visibility Filters */}
          <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md border border-[#E8E8EC] p-3.5 rounded-12px text-xs space-y-2.5 shadow-genesis-card max-w-[220px]">
            <div className="font-display font-semibold text-[#0A0A0A] text-[12px] flex items-center space-x-1.5 border-b border-[#E8E8EC] pb-2">
              <Layers className="h-3.5 w-3.5 text-[#6366F1]" />
              <span>Geospatial Layers</span>
            </div>

            <label className="flex items-center justify-between cursor-pointer text-[#0A0A0A] hover:text-[#6366F1] transition-colors">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showWards}
                  onChange={(e) => setShowWards(e.target.checked)}
                  className="rounded-[4px] border-[#E8E8EC] text-[#6366F1] focus:ring-[#6366F1]"
                />
                <span className="font-medium">24 BMC Wards (HVI)</span>
              </span>
              <span className="text-[10px] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full font-mono text-[#6B6B6B]">24</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer text-[#EF4444] hover:opacity-80 transition-opacity">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showHotspots}
                  onChange={(e) => setShowHotspots(e.target.checked)}
                  className="rounded-[4px] border-[#E8E8EC] text-[#EF4444] focus:ring-[#EF4444]"
                />
                <span className="font-medium">Landsat Hotspots</span>
              </span>
              <span className="text-[10px] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-full font-mono text-[#EF4444] font-semibold">13</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer text-[#F59E0B] hover:opacity-80 transition-opacity">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showShelters}
                  onChange={(e) => setShowShelters(e.target.checked)}
                  className="rounded-[4px] border-[#E8E8EC] text-[#F59E0B] focus:ring-[#F59E0B]"
                />
                <span className="font-medium">Cooling Shelters</span>
              </span>
              <span className="text-[10px] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded-full font-mono text-[#F59E0B] font-semibold">5</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showHospitals}
                  onChange={(e) => setShowHospitals(e.target.checked)}
                  className="rounded-[4px] border-[#E8E8EC] text-[#EF4444] focus:ring-[#EF4444]"
                />
                <span>Hospitals & Triage</span>
              </span>
              <span className="text-[10px] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full font-mono text-[#6B6B6B]">17</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showParks}
                  onChange={(e) => setShowParks(e.target.checked)}
                  className="rounded-[4px] border-[#E8E8EC] text-[#10B981] focus:ring-[#10B981]"
                />
                <span>Parks & Greenery</span>
              </span>
              <span className="text-[10px] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full font-mono text-[#6B6B6B]">12</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors">
              <span className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showWater}
                  onChange={(e) => setShowWater(e.target.checked)}
                  className="rounded-[4px] border-[#E8E8EC] text-[#06B6D4] focus:ring-[#06B6D4]"
                />
                <span>Water Points (Pyaus)</span>
              </span>
              <span className="text-[10px] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full font-mono text-[#6B6B6B]">12</span>
            </label>
          </div>

          {/* Bottom Left Legend */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md border border-[#E8E8EC] p-3 rounded-12px text-[11px] shadow-genesis-card space-y-1.5">
            <div className="font-display font-semibold text-[#0A0A0A] text-[11px]">HVI Heat Vulnerability Ramp</div>
            <div className="flex items-center space-x-2.5 font-medium text-[#6B6B6B]">
              <span className="flex items-center space-x-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#EF4444' }} /><span>Critical (&ge;0.70)</span></span>
              <span className="flex items-center space-x-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#EA580C' }} /><span>High (0.55-0.70)</span></span>
              <span className="flex items-center space-x-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} /><span>Mod (0.40-0.55)</span></span>
              <span className="flex items-center space-x-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#10B981' }} /><span>Low (&lt;0.40)</span></span>
            </div>
          </div>

          {/* Leaflet Map Canvas */}
          <MapContainer
            center={[19.076, 72.877]}
            zoom={11}
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <MapController resetTrigger={resetCounter} />

            {/* Dynamic Esri Basemap Layer */}
            <TileLayer
              key={activeBasemap}
              attribution={BASEMAP_TILES[activeBasemap].attribution}
              url={BASEMAP_TILES[activeBasemap].url}
              maxZoom={19}
            />

            {/* 24 BMC Wards GeoJSON Polygons */}
            {showWards && wardsData && (
              <GeoJSON
                key={`wards-${showWardLabels}-${activeBasemap}`}
                data={wardsData as any}
                style={wardStyle}
                onEachFeature={onEachWard}
              />
            )}

            {/* Landsat LST Hotspots */}
            {showHotspots &&
              hotspots.map((spot, i) => (
                <CircleMarker
                  key={`hotspot-${i}`}
                  center={[spot.lat, spot.lon]}
                  radius={spot.lst_celsius >= 43.0 ? 10 : 8}
                  pathOptions={{
                    fillColor: spot.lst_celsius >= 43.0 ? '#EF4444' : '#F97316',
                    fillOpacity: 0.95,
                    color: '#FFFFFF',
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="p-1 space-y-1.5 text-xs">
                      <div className="font-display font-bold text-[#EF4444] flex items-center space-x-1">
                        <Flame className="h-4 w-4" />
                        <span>{spot.name}</span>
                      </div>
                      <div>Ward: <span className="font-semibold text-[#0A0A0A]">Ward {spot.ward_id}</span></div>
                      <div>Landsat LST: <span className="font-mono font-bold text-[#EF4444]">{spot.lst_celsius}°C</span></div>
                      <div>NDVI: <span className="font-mono font-medium text-[#10B981]">{spot.ndvi}</span></div>
                      <div className="text-[11px] text-[#6B6B6B] border-t border-[#E8E8EC] pt-1">Surface: {spot.surface_type}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

            {/* Officially Designated Cooling Shelters */}
            {showShelters &&
              facilities
                .filter((f) => f.type === 'CoolingCentre')
                .map((s) => (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lon]}
                    radius={11}
                    pathOptions={{
                      fillColor: '#F59E0B',
                      fillOpacity: 1.0,
                      color: '#FFFFFF',
                      weight: 3,
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-xs space-y-1.5">
                        <div className="font-display font-bold text-[#F59E0B] flex items-center space-x-1">
                          <Shield className="h-4 w-4" />
                          <span>{s.name}</span>
                        </div>
                        <div className="text-[10px] font-medium text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full inline-block">
                          Official Designated Cooling Shelter
                        </div>
                        <div>Ward: <strong>Ward {s.ward_id}</strong></div>
                        <div>Capacity: <strong className="font-mono text-[#0A0A0A]">{s.capacity_persons} persons</strong></div>
                        <div>Cooling: <strong>{s.is_air_conditioned ? 'Air Conditioned' : 'Passive Ventilated'}</strong></div>
                        <div>Trigger: <span className="text-[#EF4444] font-semibold">{s.activation_trigger}</span></div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

            {/* Hospitals */}
            {showHospitals &&
              facilities
                .filter((f) => f.type === 'Hospital')
                .map((h) => (
                  <CircleMarker
                    key={h.id}
                    center={[h.lat, h.lon]}
                    radius={5}
                    pathOptions={{ fillColor: '#EF4444', fillOpacity: 0.95, color: '#FFFFFF', weight: 1.5 }}
                  >
                    <Popup>
                      <div className="p-1 text-xs space-y-1">
                        <div className="font-display font-bold text-[#EF4444] flex items-center space-x-1">
                          <HospitalIcon className="h-3 w-3" />
                          <span>{h.name}</span>
                        </div>
                        <div>Category: {h.category}</div>
                        <div>Ward: Ward {h.ward_id}</div>
                        <div>Total Beds: {h.bed_capacity}</div>
                        <div className="text-[#10B981] font-semibold">
                          Heat Triage Beds: {h.heat_stroke_triage_beds}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

            {/* Parks */}
            {showParks &&
              facilities
                .filter((f) => f.type === 'Park')
                .map((p) => (
                  <CircleMarker
                    key={p.id}
                    center={[p.lat, p.lon]}
                    radius={5}
                    pathOptions={{ fillColor: '#10B981', fillOpacity: 0.95, color: '#FFFFFF', weight: 1.5 }}
                  >
                    <Popup>
                      <div className="p-1 text-xs space-y-1">
                        <div className="font-display font-bold text-[#10B981] flex items-center space-x-1">
                          <Trees className="h-3 w-3" />
                          <span>{p.name}</span>
                        </div>
                        <div>Ward: Ward {p.ward_id}</div>
                        <div>Cooling Radius: {p.cooling_buffer_radius_m}m</div>
                        <div>Canopy Cover: {p.canopy_cover_pct}%</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

            {/* Water Points */}
            {showWater &&
              facilities
                .filter((f) => f.type === 'WaterPoint')
                .map((w) => (
                  <CircleMarker
                    key={w.id}
                    center={[w.lat, w.lon]}
                    radius={4}
                    pathOptions={{ fillColor: '#06B6D4', fillOpacity: 0.95, color: '#FFFFFF', weight: 1 }}
                  >
                    <Popup>
                      <div className="p-1 text-xs space-y-1">
                        <div className="font-display font-bold text-[#06B6D4] flex items-center space-x-1">
                          <Droplets className="h-3 w-3" />
                          <span>{w.name}</span>
                        </div>
                        <div>Ward: Ward {w.ward_id}</div>
                        <div>Tap Count: {w.tap_count}</div>
                        <div>Chilled: {w.is_chilled ? 'Yes' : 'Filtered Ambient'}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
          </MapContainer>
        </div>

        {/* Selected Ward Profile Sidebar (White surface, 1px border #E8E8EC, 12px radius) */}
        <div className="bg-white rounded-12px p-5 border border-[#E8E8EC] space-y-4 text-xs shadow-sm">
          <div className="border-b border-[#E8E8EC] pb-3">
            <h3 className="font-display font-bold text-[15px] text-[#0A0A0A]">Ward Diagnostic Profile</h3>
            <p className="text-[12px] text-[#6B6B6B]">Click any ward polygon on the map</p>
          </div>

          {selectedWard ? (
            <div className="space-y-4">
              <div>
                <div className="text-xl font-display font-bold text-[#6366F1] tracking-tight">
                  Ward {selectedWard.ward_id}
                </div>
                <div className="text-[#0A0A0A] font-medium text-sm">{selectedWard.ward_name}</div>
                <div className="text-[12px] text-[#6B6B6B]">{selectedWard.zone}</div>
              </div>

              <div className="bg-[#FAFAFA] p-3.5 rounded-[8px] border border-[#E8E8EC] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#6B6B6B]">HVI Score:</span>
                  <span className="font-bold text-[#0A0A0A] font-mono text-sm">{selectedWard.hvi_score?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6B6B6B]">Risk Category:</span>
                  <span className="font-semibold text-[#EF4444]">{selectedWard.vulnerability_category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6B6B6B]">Mumbai Rank:</span>
                  <span className="text-[#0A0A0A] font-medium">#{selectedWard.rank} of 24</span>
                </div>
              </div>

              <div className="space-y-2 font-mono text-[12px] bg-[#FAFAFA] p-3 rounded-[8px] border border-[#E8E8EC]">
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B] font-sans">Mean Landsat LST:</span>
                  <span className="text-[#EF4444] font-bold">{selectedWard.mean_lst_celsius}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B] font-sans">Peak LST:</span>
                  <span className="text-[#EF4444] font-bold">{selectedWard.max_lst_celsius}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B] font-sans">Mean NDVI:</span>
                  <span className="text-[#10B981] font-semibold">{selectedWard.mean_ndvi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B] font-sans">Total Population:</span>
                  <span className="text-[#0A0A0A]">{selectedWard.population_total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B] font-sans">Density:</span>
                  <span className="text-[#0A0A0A]">{selectedWard.population_density_per_sqkm?.toLocaleString()}/km²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B] font-sans">Slum Population:</span>
                  <span className="text-[#F59E0B] font-bold">{selectedWard.slum_population_pct}%</span>
                </div>
              </div>

              <div className="border-t border-[#E8E8EC] pt-3 space-y-2">
                <div className="font-medium text-[#0A0A0A] text-xs">Facilities Within Ward:</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6B6B6B]">
                  <div className="bg-[#FAFAFA] p-2 rounded-[6px] border border-[#E8E8EC]">🏥 Hospitals: <strong className="text-[#0A0A0A]">{selectedWard.hospitals_count ?? 0}</strong></div>
                  <div className="bg-[#FAFAFA] p-2 rounded-[6px] border border-[#E8E8EC]">🌳 Parks: <strong className="text-[#0A0A0A]">{selectedWard.parks_gardens_count ?? 0}</strong></div>
                  <div className="bg-[#FAFAFA] p-2 rounded-[6px] border border-[#E8E8EC]">💧 Water: <strong className="text-[#0A0A0A]">{selectedWard.water_points_count ?? 0}</strong></div>
                  <div className="bg-[#FAFAFA] p-2 rounded-[6px] border border-[#E8E8EC]">🛡️ Shelters: <strong className="text-[#0A0A0A]">{selectedWard.cooling_centres_count ?? 0}</strong></div>
                </div>
              </div>

              {selectedWard.explanation && (
                <div className="bg-[#FAFAFA] p-3 rounded-[8px] text-[12px] text-[#0A0A0A] border border-[#E8E8EC] leading-relaxed">
                  <span className="font-semibold text-[#EF4444] flex items-center space-x-1.5 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Scientific Risk Driver:</span>
                  </span>
                  {selectedWard.explanation}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-24 text-[#9C9C9C] space-y-2">
              <Info className="h-8 w-8 mx-auto text-[#9C9C9C]" />
              <p className="font-medium text-[#6B6B6B]">No ward selected</p>
              <p className="text-[11px] text-[#9C9C9C]">Click any ward polygon on the map to inspect full heat vulnerability diagnostics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
