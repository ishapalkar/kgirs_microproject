import type {
  WardGeoJSONCollection,
  ThermalHotspot,
  PublicFacility,
  GraphRAGResponse,
  CypherResponse,
  GraphStats,
  HVIWeights
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = {
  // Geospatial
  getWardsGeoJSON: async (): Promise<WardGeoJSONCollection> => {
    const res = await fetch(`${API_BASE}/geospatial/wards-geojson`);
    if (!res.ok) throw new Error('Failed to load wards GeoJSON');
    return res.json();
  },

  getHotspots: async (): Promise<ThermalHotspot[]> => {
    const res = await fetch(`${API_BASE}/geospatial/hotspots`);
    if (!res.ok) throw new Error('Failed to load hotspots');
    return res.json();
  },

  getFacilities: async (type?: string): Promise<PublicFacility[]> => {
    const url = type ? `${API_BASE}/geospatial/facilities?type=${type}` : `${API_BASE}/geospatial/facilities`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load facilities');
    return res.json();
  },

  getEra5Meteorology: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/geospatial/era5-meteorology`);
    if (!res.ok) throw new Error('Failed to load meteorology');
    return res.json();
  },

  getModisTemporal: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/geospatial/modis-temporal`);
    if (!res.ok) throw new Error('Failed to load MODIS temporal data');
    return res.json();
  },

  // Vulnerability
  getWardVulnerabilities: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/vulnerability/wards`);
    if (!res.ok) throw new Error('Failed to load ward vulnerabilities');
    return res.json();
  },

  recalculateHVI: async (weights: HVIWeights): Promise<any> => {
    const res = await fetch(`${API_BASE}/vulnerability/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weights)
    });
    if (!res.ok) throw new Error('Failed to recalculate HVI');
    return res.json();
  },

  // GraphRAG
  queryGraphRAG: async (query: string): Promise<GraphRAGResponse> => {
    const res = await fetch(`${API_BASE}/graphrag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error('GraphRAG query failed');
    return res.json();
  },

  executeCypher: async (cypher: string): Promise<CypherResponse> => {
    const res = await fetch(`${API_BASE}/graphrag/cypher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Cypher execution failed' }));
      throw new Error(err.detail || 'Cypher execution failed');
    }
    return res.json();
  },

  getGraphSubgraph: async (limit: number = 150): Promise<any> => {
    const res = await fetch(`${API_BASE}/graphrag/subgraph?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to load subgraph');
    return res.json();
  },

  getGraphStats: async (): Promise<GraphStats> => {
    const res = await fetch(`${API_BASE}/graphrag/stats`);
    if (!res.ok) throw new Error('Failed to load graph stats');
    return res.json();
  },

  // Evidence
  getPolicyDocuments: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/evidence/documents`);
    if (!res.ok) throw new Error('Failed to load documents');
    return res.json();
  },

  getImdCriteria: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/evidence/imd-criteria`);
    if (!res.ok) throw new Error('Failed to load IMD criteria');
    return res.json();
  },

  assessHeatwave: async (params: { actual_max_temp_celsius: number; station_name: string; month: string; consecutive_days: number }): Promise<any> => {
    const res = await fetch(`${API_BASE}/evidence/assess-heatwave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Heatwave assessment failed');
    return res.json();
  }
};
