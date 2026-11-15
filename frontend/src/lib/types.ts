export type Category = 'Critical' | 'High' | 'Moderate' | 'Low'

export interface Ward {
  ward_id: string
  ward_name: string
  zone: string
  area_km2: number
  population_total: number
  households: number
  population_density_per_sqkm: number
  children_0_6_pct: number
  slum_population: number
  slum_population_pct: number
  literacy_pct: number
  illiteracy_pct: number
  hospitals_count: number
  parks_count: number
  water_points_count: number
  cooling_centres_count: number
  hospitals_per_100k: number
  parks_per_100k: number
  water_points_per_100k: number
  mean_lst_celsius: number
  max_lst_celsius: number
  mean_ndvi: number
  hvi_score: number
  hvi_rank: number
  vulnerability_category: Category
  exposure_score: number
  sensitivity_score: number
  adaptive_capacity_score: number
  indicator_scores: Record<string, number>
  drivers: string[]
  explanation: string
  priority_interventions: string[]
  rank_change?: number
}

export interface WardDetail extends Ward {
  neighbours: string[]
  document_mentions: { section_id: string; section: string; document: string; excerpt: string }[]
  population_groups: { id: string; name: string; count: number; share_pct: number }[]
  hotspots: Hotspot[]
}

export interface Facility {
  id: string
  name: string
  type: 'Hospital' | 'Park' | 'WaterPoint' | 'CoolingCentre'
  lat: number
  lon: number
  ward_id: string
  source: string
  data_status: 'real' | 'illustrative'
  beds?: number | null
  operator_type?: string | null
  capacity_persons?: number
}

export interface Hotspot {
  id: string
  name: string
  ward_id: string
  lat: number
  lon: number
  lst_celsius: number
  ndvi: number
  surface_type: string
}

export interface Status {
  graph_engine: string
  neo4j_connected: boolean
  neo4j_error: string | null
  llm_available: boolean
  llm_provider: string | null
  llm_model: string | null
  search_method: string
}

export interface Overview {
  ward_count: number
  population_total: number
  slum_population_pct: number
  category_counts: Record<Category, number>
  critical_wards: { ward_id: string; ward_name: string; hvi_score: number }[]
  population_in_critical: number
  population_in_critical_pct: number
  top_wards: Pick<Ward, 'ward_id' | 'ward_name' | 'hvi_score' | 'hvi_rank' | 'vulnerability_category' | 'exposure_score' | 'sensitivity_score' | 'adaptive_capacity_score'>[]
  hottest_ward: { ward_id: string; ward_name: string; mean_lst_celsius: number; max_lst_celsius: number }
  coolest_ward: { ward_id: string; ward_name: string; mean_lst_celsius: number }
  lst_spread_celsius: number
  facilities: Record<string, number>
  graph: { nodes: number; relationships: number; labels: number; relationship_types: number }
  documents: number
  document_chunks: number
  thresholds: { min: number; label: Category }[]
  status: Status
}

export interface VisNode { id: string; label: string; group: string; properties: Record<string, unknown> }
export interface VisEdge { from: string; to: string; label: string; properties?: Record<string, unknown> }
export interface Subgraph { nodes: VisNode[]; edges: VisEdge[] }

export interface Step { name: string; detail: string; duration_ms: number; data: Record<string, unknown> }
export interface Citation { key: string; document_title: string; section: string; excerpt: string; score: number }

export interface AskResponse {
  query: string
  answer: string
  mode: 'llm' | 'rules'
  model: string | null
  steps: Step[]
  cypher: string | null
  cypher_rows: Record<string, unknown>[]
  cypher_error: string | null
  citations: Citation[]
  linked_entities: { wards: { ward_id: string; matched: string }[]; facility_types: string[]; top_n: number | null }
  subgraph: Subgraph
  highlight_node_ids: string[]
  engine: string
}

export interface CypherResult {
  rows: Record<string, unknown>[]
  columns: string[]
  execution_time_ms: number
  engine: string
  record_count: number
}

export interface Weights { weight_exposure: number; weight_sensitivity: number; weight_adaptive_capacity: number }

export interface DocSection { id: string; title: string; text: string; wards_mentioned: string[] }
export interface Doc { id: string; title: string; short: string; agency: string; year: number; kind: string; sections: DocSection[] }

export interface SearchHit {
  chunk_id: string
  document_title: string
  section: string
  content: string
  citation: string
  wards_mentioned: string[]
  score: number
  bm25_rank: number | null
  semantic_rank: number | null
}

export interface HeatwaveAssessment {
  is_heatwave: boolean
  is_severe_heatwave: boolean
  alert_level: string
  actual_temp_c: number
  normal_temp_c: number
  departure_c: number
  station_name: string
  criteria_triggered: string
  scientific_disclaimer: string
  consecutive_days: number
}

export interface Provenance {
  statuses: Record<string, string>
  fields: Record<string, { status: string; source: string; caveat?: string }>
  counts: { wards: number; facilities_total: number; osm_points_outside_bmc_dropped: number; by_type: Record<string, number> }
}

export interface Method {
  formula: string
  default_weights: Weights
  components: Record<'exposure' | 'sensitivity' | 'adaptive_capacity', { key: string; label: string; weight: number }[]>
  thresholds: { min: number; label: Category }[]
  note: string
}
