import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, CheckCircle2, AlertTriangle, ThermometerSun, BookOpen } from 'lucide-react';

export const EvidenceDocumentPanel: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [, setLoading] = useState<boolean>(true);

  // Interactive IMD Heatwave Simulator State
  const [simTemp, setSimTemp] = useState<number>(38.2);
  const [simStation, setSimStation] = useState<string>('Santacruz');
  const [simMonth, setSimMonth] = useState<string>('May');
  const [simDays, setSimDays] = useState<number>(2);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [, setSimLoading] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const docs = await api.getPolicyDocuments();
        setDocuments(docs);
        if (docs.length > 0) setSelectedDoc(docs[0]);
        await handleRunSimulation(38.2, 'Santacruz', 'May', 2);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleRunSimulation(temp: number, station: string, month: string, days: number) {
    try {
      setSimLoading(true);
      const res = await api.assessHeatwave({
        actual_max_temp_celsius: temp,
        station_name: station,
        month: month,
        consecutive_days: days,
      });
      setSimResult(res);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Methodological Rigor Alert (Genesis: White surface, 1px border #E8E8EC, 12px radius) */}
      <div className="bg-white border border-[#E8E8EC] rounded-12px p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-[6px] bg-[#6366F1]/10 text-[#6366F1]">
            <ThermometerSun className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-[#0A0A0A]">
              Scientific & Methodological Constraints for Heatwave Assessment
            </h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Strict adherence to India Meteorological Department (IMD) coastal station standards & satellite radiometry physics.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
          <div className="bg-[#FAFAFA] p-4 rounded-[8px] border border-[#E8E8EC] space-y-1.5">
            <div className="font-display font-semibold text-[#EF4444]">
              1. Satellite Land Surface Temperature (LST) Radiative Physics
            </div>
            <p className="text-[#6B6B6B] text-[12px] leading-relaxed">
              Landsat 8/9 C2 L2 Band 10 and NASA MODIS measure the <em>skin temperature</em> of surfaces (asphalt pavement, metal tin roofs,
              concrete towers). During intense solar insolation in Mumbai, urban impervious surfaces can reach 46°C to 52°C. LST identifies
              microclimatic exposure differentials and urban heat islands, but <strong>cannot</strong> be used alone to declare an official meteorological heatwave.
            </p>
          </div>

          <div className="bg-[#FAFAFA] p-4 rounded-[8px] border border-[#E8E8EC] space-y-1.5">
            <div className="font-display font-semibold text-[#F59E0B]">
              2. IMD Official Coastal Station Criteria (Colaba & Santacruz)
            </div>
            <p className="text-[#6B6B6B] text-[12px] leading-relaxed">
              Official IMD heatwaves are defined exclusively from <strong>2-meter ambient air temperature</strong> inside a Stevenson screen.
              For coastal stations like Mumbai, heatwave conditions are declared <em>only</em> when maximum temperature reaches at least <strong>37.0°C</strong>
              AND departure from climatological normal is &ge; +4.5°C (severe &ge; +6.5°C).
            </p>
          </div>
        </div>
      </div>

      {/* Interactive IMD Coastal Heatwave Simulator Tool */}
      <div className="bg-white border border-[#E8E8EC] rounded-12px p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-sm font-display font-bold text-[#0A0A0A]">
          <ShieldAlert className="h-4 w-4 text-[#F59E0B]" />
          <span>Interactive IMD Coastal Heatwave Evaluation Engine</span>
        </div>
        <p className="text-xs text-[#6B6B6B]">
          Simulate recorded Stevenson screen ambient air temperature against official IMD coastal criteria.
        </p>

        {/* Simulator controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#FAFAFA] p-4 rounded-[8px] border border-[#E8E8EC] text-xs">
          <div>
            <label className="text-[#6B6B6B] font-medium block mb-1.5">
              Recorded Max Temp: <span className="text-[#0A0A0A] font-mono font-bold">{simTemp}°C</span>
            </label>
            <input
              type="range"
              min="32.0"
              max="48.0"
              step="0.1"
              value={simTemp}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setSimTemp(val);
                handleRunSimulation(val, simStation, simMonth, simDays);
              }}
              className="w-full accent-[#6366F1] cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[#6B6B6B] font-medium block mb-1.5">IMD Observatory Station:</label>
            <select
              value={simStation}
              onChange={(e) => {
                setSimStation(e.target.value);
                handleRunSimulation(simTemp, e.target.value, simMonth, simDays);
              }}
              className="w-full bg-white border border-[#E8E8EC] rounded-[6px] py-1.5 px-2.5 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#6366F1]"
            >
              <option value="Santacruz">Santacruz (Suburban Mumbai)</option>
              <option value="Colaba">Colaba (South Mumbai Coastal)</option>
            </select>
          </div>

          <div>
            <label className="text-[#6B6B6B] font-medium block mb-1.5">Observation Month:</label>
            <select
              value={simMonth}
              onChange={(e) => {
                setSimMonth(e.target.value);
                handleRunSimulation(simTemp, simStation, e.target.value, simDays);
              }}
              className="w-full bg-white border border-[#E8E8EC] rounded-[6px] py-1.5 px-2.5 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#6366F1]"
            >
              <option value="May">May (Normal: 33.6°C)</option>
              <option value="April">April (Normal: 33.2°C)</option>
              <option value="March">March (Normal: 32.8°C)</option>
            </select>
          </div>

          <div>
            <label className="text-[#6B6B6B] font-medium block mb-1.5">
              Consecutive Days: <span className="text-[#0A0A0A] font-mono font-bold">{simDays} day(s)</span>
            </label>
            <input
              type="range"
              min="1"
              max="7"
              step="1"
              value={simDays}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSimDays(val);
                handleRunSimulation(simTemp, simStation, simMonth, val);
              }}
              className="w-full accent-[#6366F1] cursor-pointer"
            />
          </div>
        </div>

        {/* Simulation Output Card */}
        {simResult && (
          <div
            className={`p-4 rounded-[8px] border text-xs space-y-2.5 ${
              simResult.is_severe_heatwave
                ? 'bg-[#EF4444]/5 border-[#EF4444]/30 text-[#EF4444]'
                : simResult.is_heatwave
                ? 'bg-[#F59E0B]/5 border-[#F59E0B]/30 text-[#F59E0B]'
                : 'bg-[#10B981]/5 border-[#10B981]/30 text-[#10B981]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm flex items-center space-x-2 text-[#0A0A0A]">
                {simResult.is_heatwave ? (
                  <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                )}
                <span>
                  Official IMD Status:{' '}
                  {simResult.is_severe_heatwave
                    ? 'SEVERE HEATWAVE DECLARED'
                    : simResult.is_heatwave
                    ? 'HEATWAVE DECLARED'
                    : 'NORMAL / NO HEATWAVE'}
                </span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white border border-[#E8E8EC] text-[#0A0A0A]">
                Alert: {simResult.alert_level}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-[#6B6B6B]">
              <div>Recorded Temp: <strong className="text-[#0A0A0A]">{simResult.actual_temp_c}°C</strong></div>
              <div>Station Normal: <strong className="text-[#0A0A0A]">{simResult.normal_temp_c}°C</strong></div>
              <div>
                Departure:{' '}
                <strong className={simResult.departure_c >= 4.5 ? 'text-[#EF4444]' : 'text-[#0A0A0A]'}>
                  {simResult.departure_c >= 0 ? `+${simResult.departure_c}` : simResult.departure_c}°C
                </strong>
              </div>
              <div>Coastal Rule Threshold: <strong className="text-[#0A0A0A]">&ge; 37.0°C</strong></div>
            </div>

            <div className="text-[11px] pt-1 text-[#6B6B6B]">
              <strong className="text-[#0A0A0A]">Evaluation Rule Triggered: </strong>
              <span>{simResult.criteria_triggered}</span>
            </div>
          </div>
        )}
      </div>

      {/* Official Source Documents Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document List */}
        <div className="bg-white border border-[#E8E8EC] rounded-12px p-5 shadow-sm space-y-3">
          <div className="font-display font-bold text-sm text-[#0A0A0A] flex items-center space-x-2 border-b border-[#E8E8EC] pb-3">
            <BookOpen className="h-4 w-4 text-[#F59E0B]" />
            <span>Ingested Official Documents</span>
          </div>

          <div className="space-y-2">
            {documents.map((doc, idx) => {
              const isSelected = selectedDoc?.filename === doc.filename;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full text-left p-3.5 rounded-[8px] border text-xs transition-all ${
                    isSelected
                      ? 'bg-[#6366F1]/10 border-[#6366F1]/40 text-[#6366F1] font-semibold'
                      : 'bg-white border-[#E8E8EC] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F3F4F6]'
                  }`}
                >
                  <div className="font-display font-medium text-xs truncate">{doc.title}</div>
                  <div className="text-[10px] text-[#9C9C9C] font-mono mt-0.5">{doc.filename}</div>
                  <div className="text-[10px] text-[#9C9C9C] mt-1">{doc.char_count?.toLocaleString()} characters</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Content Reader */}
        <div className="lg:col-span-2 bg-white border border-[#E8E8EC] rounded-12px p-5 shadow-sm text-xs space-y-3">
          {selectedDoc ? (
            <>
              <div className="border-b border-[#E8E8EC] pb-3">
                <span className="text-[10px] bg-[#F3F4F6] px-2.5 py-0.5 rounded-full text-[#F59E0B] font-mono border border-[#E8E8EC]">
                  Verified Government Policy Artifact
                </span>
                <h3 className="font-display text-base font-bold text-[#0A0A0A] mt-2">{selectedDoc.title}</h3>
                <div className="text-[11px] text-[#6B6B6B] font-mono">{selectedDoc.filename}</div>
              </div>

              <div className="bg-[#FAFAFA] p-4 rounded-[8px] border border-[#E8E8EC] font-mono text-[11px] text-[#0A0A0A] whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
                {selectedDoc.content}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-[#9C9C9C]">Select a document to inspect text.</div>
          )}
        </div>
      </div>
    </div>
  );
};
