import React, { useState } from 'react';
import { api } from '../services/api';
import type { CypherResponse } from '../types';
import { Terminal, Play, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

export const CypherEditor: React.FC = () => {
  const [cypher, setCypher] = useState<string>(
    `MATCH (w:Ward)\nRETURN w.ward_id AS ward_id, w.ward_name AS ward_name, w.mean_lst_celsius AS lst_c, w.hvi_score AS hvi_score, w.vulnerability_category AS category\nORDER BY w.hvi_score DESC\nLIMIT 10`
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CypherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    {
      title: 'Top 10 Vulnerable Wards',
      cypher: `MATCH (w:Ward)\nRETURN w.ward_id AS ward_id, w.ward_name AS ward_name, w.mean_lst_celsius AS lst_c, w.hvi_score AS hvi_score, w.vulnerability_category AS category\nORDER BY w.hvi_score DESC\nLIMIT 10`,
    },
    {
      title: 'Hospitals & Heat Stroke Triage',
      cypher: `MATCH (h:Hospital)-[:LOCATED_IN]->(w:Ward)\nRETURN h.name AS hospital_name, h.category AS category, w.ward_id AS ward, h.bed_capacity AS beds, h.heat_stroke_triage_beds AS heat_triage_beds\nORDER BY h.heat_stroke_triage_beds DESC`,
    },
    {
      title: 'Designated Cooling Shelters',
      cypher: `MATCH (c:CoolingCentre)\nRETURN c.name AS shelter_name, c.ward_id AS ward, c.capacity_persons AS capacity, c.is_air_conditioned AS ac, c.is_officially_designated AS designated`,
    },
    {
      title: 'Ward Facilities Breakdown',
      cypher: `MATCH (w:Ward)-[:HAS_FACILITY]->(f)\nRETURN w.ward_id AS ward, f.name AS facility_name, f.type AS facility_type\nLIMIT 20`,
    },
  ];

  async function handleExecute(customCypher?: string) {
    const q = customCypher || cypher;
    if (!q.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.executeCypher(q);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Cypher execution failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner (Genesis: White surface, 1px border #E8E8EC, 12px radius) */}
      <div className="bg-white border border-[#E8E8EC] rounded-12px p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-[6px] bg-[#10B981]/10 text-[#10B981]">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-[#0A0A0A] flex items-center space-x-2">
              <span>Raw Cypher Sandbox Interface</span>
              <span className="text-[11px] bg-[#F3F4F6] text-[#10B981] border border-[#E8E8EC] px-2 py-0.5 rounded-full font-mono">
                Read-Only Sandbox
              </span>
            </h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Execute analytical graph queries directly against the Neo4j ontology.
            </p>
          </div>
        </div>

        {/* Quick query presets */}
        <div className="flex flex-wrap gap-2 text-xs">
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => {
                setCypher(sq.cypher);
                handleExecute(sq.cypher);
              }}
              className="bg-[#F3F4F6] hover:bg-[#E8E8EC] text-[#6B6B6B] hover:text-[#0A0A0A] px-3 py-1.5 rounded-full border border-[#E8E8EC] transition-all font-medium"
            >
              {sq.title}
            </button>
          ))}
        </div>
      </div>

      {/* Code Editor Box (Genesis: White surface, 1px border #E8E8EC, 12px radius) */}
      <div className="bg-white border border-[#E8E8EC] rounded-12px overflow-hidden shadow-sm">
        <div className="bg-[#FAFAFA] px-4 py-2.5 border-b border-[#E8E8EC] flex justify-between items-center text-xs">
          <span className="font-mono text-[#6B6B6B]">Cypher Statement (MATCH / RETURN)</span>
          <span className="text-[11px] text-[#F59E0B] font-mono">Mutating operations (CREATE/DELETE) blocked</span>
        </div>

        <textarea
          value={cypher}
          onChange={(e) => setCypher(e.target.value)}
          rows={5}
          className="w-full bg-white p-4 font-mono text-xs text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] resize-y"
          placeholder="MATCH (w:Ward) RETURN w LIMIT 10"
        />

        <div className="bg-[#FAFAFA] px-4 py-3 border-t border-[#E8E8EC] flex justify-between items-center">
          <div className="text-xs text-[#6B6B6B] flex items-center space-x-2">
            <Database className="h-4 w-4 text-[#9C9C9C]" />
            <span>Target: Neo4j 5.x / High-Fidelity Graph Engine</span>
          </div>

          <button
            onClick={() => handleExecute()}
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-[6px] text-xs font-medium shadow-genesis-glow transition-all duration-150 hover:-translate-y-[1px] disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>Execute Cypher</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 p-4 rounded-12px text-xs text-[#EF4444] flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="bg-white border border-[#E8E8EC] rounded-12px overflow-hidden shadow-sm text-xs space-y-4">
          <div className="p-4 border-b border-[#E8E8EC] flex flex-wrap justify-between items-center gap-2 bg-[#FAFAFA]">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              <span className="font-display font-semibold text-[#0A0A0A]">Execution Succeeded</span>
              <span className="text-[#6B6B6B] font-mono text-[11px]">
                {result.record_count} record(s) returned in {result.execution_time_ms} ms
              </span>
            </div>
            {result.warning && (
              <span className="text-[11px] text-[#F59E0B] bg-[#F59E0B]/10 px-2.5 py-0.5 rounded-full border border-[#F59E0B]/20">
                {result.warning}
              </span>
            )}
          </div>

          {result.records.length > 0 ? (
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-[#FAFAFA] text-[#6B6B6B] border-b border-[#E8E8EC] sticky top-0 uppercase tracking-wider text-[10px]">
                  <tr>
                    {result.columns.map((col, idx) => (
                      <th key={idx} className="py-2.5 px-3.5">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {result.records.map((rec, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#F3F4F6] transition-colors">
                      {result.columns.map((col, cIdx) => {
                        const val = rec[col];
                        return (
                          <td key={cIdx} className="py-2.5 px-3.5 text-[#0A0A0A] truncate max-w-xs">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-[#9C9C9C]">Query returned 0 matching records.</div>
          )}
        </div>
      )}
    </div>
  );
};
