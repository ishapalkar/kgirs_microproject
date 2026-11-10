import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Baby, HeartPulse, AlertCircle } from 'lucide-react';

export const DemographicExposureView: React.FC = () => {
  const [wards, setWards] = useState<any[]>([]);
  const [, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getWardVulnerabilities();
        setWards(data);
      } catch (err) {
        console.error('Failed to load demographics:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute aggregate statistics
  const totalPopulation = wards.reduce((acc, w) => acc + (w.population_total || 0), 0);
  const criticalPopulation = wards
    .filter((w) => w.vulnerability_category === 'Very High / Critical' || w.vulnerability_category === 'High')
    .reduce((acc, w) => acc + (w.population_total || 0), 0);
  const avgChildrenPct = wards.length
    ? (wards.reduce((acc, w) => acc + (w.children_under_5_pct || 0), 0) / wards.length).toFixed(1)
    : '0';
  const avgElderlyPct = wards.length
    ? (wards.reduce((acc, w) => acc + (w.elderly_60_plus_pct || 0), 0) / wards.length).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Top Exposure Aggregates (White Surface, 1px border #E8E8EC, 12px radius, hover lift -2px, shadow-genesis-card) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-white border border-[#E8E8EC] p-5 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center space-x-2 text-[#6B6B6B] mb-1.5">
            <Users className="h-4 w-4 text-[#6366F1]" />
            <span className="font-medium text-[12px]">Total Population</span>
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] font-mono">{totalPopulation.toLocaleString()}</div>
          <div className="text-[11px] text-[#6B6B6B] mt-1">Across 24 Administrative Wards (WorldPop)</div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-5 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center space-x-2 text-[#EF4444] mb-1.5">
            <AlertCircle className="h-4 w-4 text-[#EF4444]" />
            <span className="font-medium text-[12px]">High & Critical Exposure</span>
          </div>
          <div className="text-2xl font-bold text-[#EF4444] font-mono">
            {criticalPopulation.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6B6B6B] mt-1">
            {totalPopulation ? ((criticalPopulation / totalPopulation) * 100).toFixed(1) : 0}% of urban populace
          </div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-5 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center space-x-2 text-[#6B6B6B] mb-1.5">
            <Baby className="h-4 w-4 text-[#F59E0B]" />
            <span className="font-medium text-[12px]">Children &lt;5 Average</span>
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] font-mono">{avgChildrenPct}%</div>
          <div className="text-[11px] text-[#6B6B6B] mt-1">Peak in Ward M/East (9.4%)</div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-5 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center space-x-2 text-[#6B6B6B] mb-1.5">
            <HeartPulse className="h-4 w-4 text-[#6366F1]" />
            <span className="font-medium text-[12px]">Elderly (60+) Average</span>
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] font-mono">{avgElderlyPct}%</div>
          <div className="text-[11px] text-[#6B6B6B] mt-1">Peak in Wards D & A (13.8%)</div>
        </div>
      </div>

      {/* Demographic Breakdown Table */}
      <div className="bg-white border border-[#E8E8EC] rounded-12px overflow-hidden shadow-sm text-xs">
        <div className="p-5 border-b border-[#E8E8EC] flex justify-between items-center bg-white">
          <div>
            <h3 className="font-display font-bold text-sm text-[#0A0A0A]">WorldPop Demographic Exposure Grids</h3>
            <p className="text-[12px] text-[#6B6B6B]">
              Vulnerable age cohorts, population density, and informal settlement concentration
            </p>
          </div>
          <span className="text-[11px] bg-[#F3F4F6] px-3 py-1 rounded-full text-[#6B6B6B] border border-[#E8E8EC]">
            Source: WorldPop India Model
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FAFAFA] text-[#6B6B6B] border-b border-[#E8E8EC] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5">Ward ID</th>
                <th className="py-3 px-3.5">Locality / Zone</th>
                <th className="py-3 px-3.5">Total Pop</th>
                <th className="py-3 px-3.5">Density (/km²)</th>
                <th className="py-3 px-3.5">Children &lt;5 %</th>
                <th className="py-3 px-3.5">Elderly 60+ %</th>
                <th className="py-3 px-3.5">Informal / Slum %</th>
                <th className="py-3 px-3.5">Primary Risk Cohort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8EC]">
              {wards.map((w) => {
                const isSlumHigh = w.slum_population_pct >= 50;
                return (
                  <tr key={w.ward_id} className="hover:bg-[#F3F4F6] transition-colors">
                    <td className="py-3 px-3.5 font-medium text-[#0A0A0A]">Ward {w.ward_id}</td>
                    <td className="py-3 px-3.5">
                      <div className="text-[#0A0A0A] font-medium">{w.ward_name}</div>
                      <div className="text-[11px] text-[#6B6B6B]">{w.zone}</div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[#0A0A0A]">{w.population_total?.toLocaleString()}</td>
                    <td className="py-3 px-3.5 font-mono text-[#6B6B6B]">{w.population_density_per_sqkm?.toLocaleString()}</td>
                    <td className="py-3 px-3.5 font-mono text-[#6B6B6B]">{w.children_under_5_pct}%</td>
                    <td className="py-3 px-3.5 font-mono text-[#6B6B6B]">{w.elderly_60_plus_pct}%</td>
                    <td className="py-3 px-3.5 font-mono">
                      <span className={isSlumHigh ? 'text-[#EF4444] font-semibold' : 'text-[#6B6B6B]'}>
                        {w.slum_population_pct}%
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      {isSlumHigh ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 font-medium">
                          Informal Density
                        </span>
                      ) : w.elderly_60_plus_pct >= 11.5 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20 font-medium">
                          Elderly Cohort
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-[#F3F4F6] text-[#6B6B6B] border border-[#E8E8EC]">
                          Balanced
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
