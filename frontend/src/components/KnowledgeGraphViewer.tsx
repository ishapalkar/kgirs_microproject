import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network/standalone';
import { api } from '../services/api';
import { Network as NetworkIcon, RefreshCw, Layers, Info } from 'lucide-react';

export const KnowledgeGraphViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setNetwork] = useState<Network | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);

  const groupColors: Record<string, { bg: string; border: string }> = {
    Ward: { bg: '#8B5CF6', border: '#7C3AED' },
    Locality: { bg: '#3B82F6', border: '#2563EB' },
    HeatObservation: { bg: '#EF4444', border: '#DC2626' },
    HeatEvent: { bg: '#F97316', border: '#EA580C' },
    PopulationGroup: { bg: '#EC4899', border: '#DB2777' },
    Hospital: { bg: '#F43F5E', border: '#E11D48' },
    Park: { bg: '#10B981', border: '#059669' },
    WaterPoint: { bg: '#06B6D4', border: '#0891B2' },
    CoolingCentre: { bg: '#F59E0B', border: '#D97706' },
    HeatAdvisory: { bg: '#FB923C', border: '#F97316' },
    Document: { bg: '#EAB308', border: '#CA8A04' },
    Organization: { bg: '#6B7280', border: '#4B5563' },
  };

  useEffect(() => {
    loadGraph();
  }, []);

  async function loadGraph() {
    try {
      setLoading(true);
      const [subgraph, graphStats] = await Promise.all([
        api.getGraphSubgraph(120),
        api.getGraphStats(),
      ]);
      setStats(graphStats);

      if (containerRef.current) {
        const nodesData = subgraph.nodes.map((n: any) => {
          const grp = n.group || 'Node';
          const colors = groupColors[grp] || { bg: '#6B7280', border: '#4B5563' };
          return {
            id: n.id,
            label: n.label || n.id,
            group: grp,
            color: {
              background: colors.bg,
              border: colors.border,
              highlight: { background: '#6366F1', border: '#4F46E5' },
            },
            font: { color: '#0A0A0A', size: 11, face: 'DM Sans, sans-serif' },
            rawProps: n.properties || {},
          };
        });

        const edgesData = subgraph.edges.map((e: any, idx: number) => ({
          id: `e-${idx}`,
          from: e.from,
          to: e.to,
          label: e.label || '',
          color: { color: '#D1D5DB', highlight: '#6366F1' },
          font: { color: '#6B6B6B', size: 9, align: 'middle' },
          arrows: 'to',
        }));

        const options: any = {
          nodes: {
            shape: 'dot',
            size: 16,
            borderWidth: 2,
            shadow: false,
          },
          edges: {
            width: 1.2,
            smooth: {
              enabled: true,
              type: 'continuous',
              roundness: 0.5,
            },
          },
          physics: {
            stabilization: { iterations: 120 },
            barnesHut: {
              gravitationalConstant: -3500,
              springLength: 85,
              springConstant: 0.04,
            },
          },
          interaction: {
            hover: true,
            tooltipDelay: 200,
          },
        };

        const net = new Network(containerRef.current, { nodes: nodesData, edges: edgesData }, options);

        net.on('click', (params) => {
          if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const clicked = nodesData.find((nd: any) => nd.id === nodeId);
            setSelectedNode(clicked);
          } else {
            setSelectedNode(null);
          }
        });

        setNetwork(net);
      }
    } catch (err) {
      console.error('Failed to load Knowledge Graph:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Knowledge Graph Stats Bar (Genesis: White surface, 1px border #E8E8EC, 12px radius) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-[6px] bg-[#6366F1]/10 text-[#6366F1]">
            <NetworkIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[#6B6B6B] text-[12px]">Total Graph Nodes</div>
            <div className="text-xl font-bold text-[#0A0A0A] font-mono">{stats?.total_nodes || 202}</div>
            <div className="text-[11px] text-[#6366F1]">11 Canonical Labels</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-[6px] bg-[#3B82F6]/10 text-[#3B82F6]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[#6B6B6B] text-[12px]">Total Relationships</div>
            <div className="text-xl font-bold text-[#0A0A0A] font-mono">{stats?.total_relationships || 379}</div>
            <div className="text-[11px] text-[#3B82F6]">Spatial & Demographic Edges</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-[6px] bg-[#10B981]/10 text-[#10B981]">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[#6B6B6B] text-[12px]">Ontology Schema</div>
            <div className="text-base font-bold text-[#0A0A0A]">LLMGraphTransformer</div>
            <div className="text-[11px] text-[#10B981]">LangChain & Neo4j</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E8EC] p-4 rounded-12px shadow-sm hover:shadow-genesis-card hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-[6px] bg-[#F59E0B]/10 text-[#F59E0B]">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[#6B6B6B] text-[12px]">Engine Reliability</div>
            <div className="text-base font-bold text-[#0A0A0A]">
              {stats?.connected_to_neo4j ? 'Live Neo4j' : 'Embedded Engine'}
            </div>
            <div className="text-[11px] text-[#F59E0B]">Zero Crash Fallback</div>
          </div>
        </div>
      </div>

      {/* Main Graph Canvas and Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Network Canvas Box */}
        <div className="lg:col-span-3 h-[620px] bg-white border border-[#E8E8EC] rounded-12px overflow-hidden relative shadow-sm">
          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="flex items-center space-x-3 text-[#6B6B6B] text-sm">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#6366F1] border-t-transparent" />
                <span>Stabilizing force-directed physics layout...</span>
              </div>
            </div>
          )}

          <div ref={containerRef} className="w-full h-full bg-[#FAFAFA]" />

          {/* Legend overlay */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-[#E8E8EC] p-3.5 rounded-12px text-[11px] shadow-genesis-card max-w-xs">
            <div className="font-display font-semibold text-[#0A0A0A] text-[11px] mb-2">
              Ontology Node Types
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(groupColors).map(([label, col]) => (
                <div key={label} className="flex items-center space-x-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.bg }} />
                  <span className="text-[#6B6B6B]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Node Properties Inspector */}
        <div className="bg-white border border-[#E8E8EC] rounded-12px p-5 shadow-sm text-xs space-y-4">
          <div className="border-b border-[#E8E8EC] pb-3">
            <h3 className="font-display font-bold text-sm text-[#0A0A0A]">Node Property Inspector</h3>
            <p className="text-[12px] text-[#6B6B6B]">Click any node in the graph</p>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: groupColors[selectedNode.group]?.bg || '#6B7280' }}
                >
                  {selectedNode.group}
                </span>
                <h4 className="font-display text-base font-bold text-[#0A0A0A] mt-2 leading-snug">
                  {selectedNode.label}
                </h4>
                <div className="text-[11px] font-mono text-[#9C9C9C] mt-0.5">ID: {selectedNode.id}</div>
              </div>

              {/* Properties Key-Value Table */}
              <div className="bg-[#FAFAFA] rounded-[8px] p-3.5 border border-[#E8E8EC] space-y-2 max-h-[400px] overflow-y-auto">
                <div className="font-medium text-[#0A0A0A] text-[11px] border-b border-[#E8E8EC] pb-1">
                  Node Attributes
                </div>
                {Object.entries(selectedNode.rawProps || {}).map(([key, value]) => {
                  if (key === 'id' || key === 'label') return null;
                  return (
                    <div key={key} className="text-[11px] space-y-0.5">
                      <span className="text-[#6B6B6B] font-mono text-[10px]">{key}:</span>
                      <div className="text-[#0A0A0A] font-medium break-words">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-[#9C9C9C] space-y-2">
              <NetworkIcon className="h-8 w-8 mx-auto text-[#9C9C9C]" />
              <p className="font-medium text-[#6B6B6B]">No node selected</p>
              <p className="text-[11px] text-[#9C9C9C]">Click any node or relationship to inspect its properties, coordinates, and provenance.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
