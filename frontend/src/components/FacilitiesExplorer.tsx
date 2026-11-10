import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { PublicFacility } from '../types';
import { Shield, Hospital, Trees, Droplets, Search } from 'lucide-react';

export const FacilitiesExplorer: React.FC = () => {
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getFacilities();
        setFacilities(data);
      } catch (err) {
        console.error('Failed to load facilities:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = facilities.filter((f) => {
    const matchesType = filterType === 'All' || f.type === filterType;
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.ward_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.category && f.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Category Filter Bar (Genesis: White surface, 1px border #E8E8EC, 12px radius) */}
      <div className="bg-white border border-[#E8E8EC] rounded-12px p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input (Genesis: 1px border #E8E8EC, 6px radius, py-2.5 px-3.5 pl-9, text-sm, indigo focus ring) */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9C9C9C]" />
          <input
            type="text"
            placeholder="Search facility name, ward, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#E8E8EC] rounded-[6px] pl-9 pr-3.5 py-2.5 text-sm text-[#0A0A0A] placeholder-[#9C9C9C] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
          />
        </div>

        {/* Filter Chips (Genesis: Pill shape, gray-100 bg #F3F4F6, text-xs, active indigo #6366F1) */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { id: 'All', label: 'All Facilities' },
            { id: 'CoolingCentre', label: 'Designated Shelters' },
            { id: 'Hospital', label: 'Hospitals & Triage' },
            { id: 'Park', label: 'Parks & Canopy' },
            { id: 'WaterPoint', label: 'Water Points' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterType(pill.id)}
              className={`py-1.5 px-3 rounded-full text-xs font-medium transition-all ${
                filterType === pill.id
                  ? 'bg-[#6366F1] text-white shadow-genesis-glow -translate-y-[1px]'
                  : 'bg-[#F3F4F6] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#E8E8EC]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Protocol Caution Banner */}
      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/30 p-4 rounded-12px text-xs text-[#0A0A0A] flex items-start space-x-3">
        <Shield className="h-5 w-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-[#0A0A0A]">Official Protocol Distinction: </span>
          <span className="text-[#6B6B6B]">
            HeatShield strictly differentiates <em>Officially Designated Municipal Emergency Cooling Shelters</em> (activated by BMC
            Disaster Management upon Orange/Red alerts with air-conditioning and ORS reserves) from general municipal hospitals, public parks,
            and transit water points.
          </span>
        </div>
      </div>

      {/* Facility Cards Grid (Genesis: White surface, 1px border #E8E8EC, 12px radius, hover lift -2px, shadow-genesis-card) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((fac) => {
          const isShelter = fac.type === 'CoolingCentre';
          const isHospital = fac.type === 'Hospital';
          const isPark = fac.type === 'Park';
          const isWater = fac.type === 'WaterPoint';

          return (
            <div
              key={fac.id}
              className={`bg-white border rounded-12px p-5 shadow-sm space-y-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-genesis-card ${
                isShelter ? 'border-[#F59E0B]/60 ring-1 ring-[#F59E0B]/20' : 'border-[#E8E8EC]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2.5 rounded-[6px] ${
                      isShelter
                        ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                        : isHospital
                        ? 'bg-[#EF4444]/10 text-[#EF4444]'
                        : isPark
                        ? 'bg-[#10B981]/10 text-[#10B981]'
                        : 'bg-[#06B6D4]/10 text-[#06B6D4]'
                    }`}
                  >
                    {isShelter && <Shield className="h-4 w-4" />}
                    {isHospital && <Hospital className="h-4 w-4" />}
                    {isPark && <Trees className="h-4 w-4" />}
                    {isWater && <Droplets className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="text-[11px] font-mono tracking-wider text-[#6B6B6B]">
                      Ward {fac.ward_id} • {fac.type}
                    </span>
                    <h4 className="font-display font-bold text-sm text-[#0A0A0A] leading-snug">{fac.name}</h4>
                  </div>
                </div>
              </div>

              {/* Badges and Attributes */}
              <div className="text-xs space-y-1.5 pt-2 border-t border-[#E8E8EC] text-[#6B6B6B]">
                {isShelter && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Capacity:</span>
                      <span className="font-mono font-bold text-[#0A0A0A]">{fac.capacity_persons} persons</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Ventilation:</span>
                      <span className="text-[#0A0A0A] font-medium">{fac.is_air_conditioned ? 'Air Conditioned' : 'Passive Ventilated'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Trigger:</span>
                      <span className="text-[#EF4444] font-semibold">{fac.activation_trigger}</span>
                    </div>
                    <div className="text-[11px] text-[#F59E0B] font-medium pt-1">
                      ✓ ORS (Oral Rehydration Salts) Reserves Active
                    </div>
                  </>
                )}

                {isHospital && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Category:</span>
                      <span className="text-[#0A0A0A]">{fac.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Total Beds:</span>
                      <span className="font-mono text-[#0A0A0A]">{fac.bed_capacity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Heat Stroke Triage:</span>
                      <span className="font-mono font-bold text-[#EF4444]">{fac.heat_stroke_triage_beds} dedicated beds</span>
                    </div>
                  </>
                )}

                {isPark && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Cooling Buffer:</span>
                      <span className="font-mono font-bold text-[#10B981]">{fac.cooling_buffer_radius_m}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Canopy Cover:</span>
                      <span className="text-[#0A0A0A]">{fac.canopy_cover_pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Area:</span>
                      <span className="font-mono text-[#0A0A0A]">{(fac.area_sqm! / 1000).toFixed(0)}k m²</span>
                    </div>
                  </>
                )}

                {isWater && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Dispensing Taps:</span>
                      <span className="font-mono font-bold text-[#06B6D4]">{fac.tap_count} taps</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Water Mode:</span>
                      <span className="text-[#0A0A0A]">{fac.is_chilled ? 'Chilled Clean' : 'Ambient Filtered'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Status:</span>
                      <span className="text-[#10B981] font-medium">Operational 24x7</span>
                    </div>
                  </>
                )}
              </div>

              {/* Coordinates */}
              <div className="text-[11px] font-mono text-[#9C9C9C] pt-1.5 border-t border-[#E8E8EC]">
                GPS: {fac.lat.toFixed(4)}°N, {fac.lon.toFixed(4)}°E
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
