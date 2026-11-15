import type {
  AskResponse, CypherResult, Doc, Facility, HeatwaveAssessment, Hotspot, Method, Overview, Provenance,
  SearchHit, Subgraph, Ward, WardDetail, Weights,
} from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new ApiError(0, 'Unable to reach the backend. Start it with “uvicorn backend.main:app --port 8000” and reload.')
  }
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail ?? detail } catch { /* not JSON */ }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  overview: () => request<Overview>('/overview'),
  provenance: () => request<Provenance>('/provenance'),
  wardsGeo: () => request<GeoJSON.FeatureCollection>('/geo/wards'),
  facilities: (type?: string, ward?: string) => {
    const q = new URLSearchParams()
    if (type) q.set('type', type)
    if (ward) q.set('ward', ward)
    return request<Facility[]>(`/geo/facilities?${q}`)
  },
  hotspots: () => request<Hotspot[]>('/geo/hotspots'),
  wards: () => request<Ward[]>('/vulnerability/wards'),
  ward: (id: string) => request<WardDetail>(`/vulnerability/ward/${id}`),
  method: () => request<Method>('/vulnerability/method'),
  recalculate: (w: Weights) => post<{ weights: Weights; category_counts: Record<string, number>; wards: Ward[] }>('/vulnerability/calculate', w),
  ask: (query: string) => post<AskResponse>('/graphrag/query', { query }),
  cypher: (cypher: string) => post<CypherResult>('/graphrag/cypher', { cypher }),
  schema: () => request<{ schema: string; nodes_by_label: Record<string, number>; relationships_by_type: Record<string, number>; total_nodes: number; total_relationships: number }>('/graphrag/schema'),
  subgraph: (ward?: string, labels?: string) => {
    const q = new URLSearchParams()
    if (ward) q.set('ward', ward)
    if (labels) q.set('labels', labels)
    return request<Subgraph>(`/graphrag/subgraph?${q}`)
  },
  node: (id: string) => request<Subgraph>(`/graphrag/node/${id}`),
  documents: () => request<Doc[]>('/evidence/documents'),
  search: (q: string) => request<{ query: string; method: string; results: SearchHit[] }>(`/evidence/search?q=${encodeURIComponent(q)}&k=5`),
  assess: (body: { actual_max_temp_celsius: number; station_name: string; month: string; consecutive_days: number }) =>
    post<HeatwaveAssessment>('/evidence/assess-heatwave', body),
}
