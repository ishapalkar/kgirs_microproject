export interface WardProperty {
  ward_id: string;
  ward_name: string;
  zone: string;
  population_total: number;
  population_density_per_sqkm: number;
  children_under_5_pct: number;
  elderly_60_plus_pct: number;
  slum_population_pct: number;
  mean_lst_celsius: number;
  max_lst_celsius: number;
  mean_ndvi: number;
  hvi_score?: number;
  vulnerability_category?: string;
  rank?: number;
  hospitals_count?: number;
  parks_gardens_count?: number;
  water_points_count?: number;
  cooling_centres_count?: number;
  explanation?: string;
  priority_interventions?: string[];
}

export interface WardGeoJSONFeature {
  type: "Feature";
  properties: WardProperty;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface WardGeoJSONCollection {
  type: "FeatureCollection";
  name: string;
  features: WardGeoJSONFeature[];
}

export interface ThermalHotspot {
  name: string;
  ward_id: string;
  lat: number;
  lon: number;
  lst_celsius: number;
  ndvi: number;
  surface_type: string;
}

export interface PublicFacility {
  id: string;
  name: string;
  type: "Hospital" | "Park" | "WaterPoint" | "CoolingCentre";
  ward_id: string;
  lat: number;
  lon: number;
  category?: string;
  bed_capacity?: number;
  heat_stroke_triage_beds?: number;
  emergency_24x7?: boolean;
  area_sqm?: number;
  cooling_buffer_radius_m?: number;
  canopy_cover_pct?: number;
  tap_count?: number;
  is_chilled?: boolean;
  is_operational?: boolean;
  capacity_persons?: number;
  is_air_conditioned?: boolean;
  has_ors_distribution?: boolean;
  activation_trigger?: string;
  is_officially_designated?: boolean;
}

export interface HVIWeights {
  weight_exposure: number;
  weight_sensitivity: number;
  weight_adaptive_capacity: number;
}

export interface GraphRAGCitation {
  document_title: string;
  section: string;
  citation_key: string;
  excerpt: string;
}

export interface ReasoningStep {
  step_number: number;
  step_type: string;
  description: string;
  entities_involved: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  properties: Record<string, any>;
}

export interface GraphSubgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphRAGResponse {
  query: string;
  answer: string;
  reasoning_path: ReasoningStep[];
  graph_subgraph: GraphSubgraph;
  citations: GraphRAGCitation[];
  cypher_executed?: string;
  cypher_results?: Record<string, any>[];
  scientific_note: string;
}

export interface CypherResponse {
  query: string;
  execution_time_ms: number;
  record_count: number;
  columns: string[];
  records: Record<string, any>[];
  is_live_neo4j: boolean;
  warning?: string;
}

export interface GraphStats {
  mode: string;
  connected_to_neo4j: boolean;
  total_nodes: number;
  total_relationships: number;
  nodes_by_label?: Record<string, number>;
  relationships_by_type?: Record<string, number>;
}
