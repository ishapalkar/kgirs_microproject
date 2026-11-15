import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useApp } from '../lib/app'
import { cssColor, riskColor } from '../lib/format'
import type { Category, Facility, Hotspot } from '../lib/types'

export type ColorBy = 'hvi' | 'mean_lst_celsius' | 'slum_population_pct' | 'population_density_per_sqkm' | 'hospitals_per_100k'

export const COLOR_BY_LABEL: Record<ColorBy, string> = {
  hvi: 'Heat vulnerability (HVI)',
  mean_lst_celsius: 'Surface temperature (estimate)',
  slum_population_pct: 'Slum population share',
  population_density_per_sqkm: 'Population density',
  hospitals_per_100k: 'Hospitals per 100k people',
}

// Facility marker colours are tokens (not risk colours, not the interactive teal).
const FACILITY_VAR: Record<Facility['type'], string> = {
  Hospital: '--cat-hospital', Park: '--cat-park', WaterPoint: '--cat-water', CoolingCentre: '--cat-cooling',
}
export const facilityColor = (t: Facility['type']) => `rgb(var(${FACILITY_VAR[t]}))`

interface Props {
  geo: GeoJSON.FeatureCollection
  colorBy?: ColorBy
  selected?: string | null
  onSelect?: (wardId: string) => void
  facilities?: Facility[]
  hotspots?: Hotspot[]
  basemap?: boolean
  interactive?: boolean
  className?: string
  label: string
}

const BOUNDS = L.latLngBounds([18.88, 72.77], [19.29, 72.99])

/** Leaflet map of the 24 wards. Plain Leaflet (not react-leaflet) for full control over styling. */
export function WardMap({ geo, colorBy = 'hvi', selected, onSelect, facilities = [], hotspots = [], basemap = true,
  interactive = true, className = '', label }: Props) {
  const { theme } = useApp()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const wardLayer = useRef<L.GeoJSON | null>(null)
  const pointLayer = useRef<L.LayerGroup | null>(null)
  const tiles = useRef<L.TileLayer | null>(null)
  const fitted = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Create the map once
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, {
      zoomControl: interactive, attributionControl: true, preferCanvas: false,
      dragging: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive, touchZoom: interactive,
      boxZoom: interactive, keyboard: interactive, zoomSnap: 0.25,
      zoomAnimation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    })
    m.fitBounds(BOUNDS, { padding: [8, 8], animate: false })
    map.current = m
    pointLayer.current = L.layerGroup().addTo(m)
    const ro = new ResizeObserver(() => { if (map.current === m) m.invalidateSize({ animate: false }) })
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      // Forget layers that belonged to this map so a re-mount never touches the removed canvas.
      wardLayer.current = null
      tiles.current = null
      pointLayer.current = null
      fitted.current = false
      m.stop()
      m.remove()
      map.current = null
    }
  }, [interactive])

  // Basemap tiles follow the theme
  useEffect(() => {
    const m = map.current
    if (!m) return
    tiles.current?.remove()
    tiles.current = null
    if (basemap) {
      const style = theme === 'dark' ? 'dark_nolabels' : 'light_nolabels'
      tiles.current = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
        attribution: '© OpenStreetMap contributors © CARTO', subdomains: 'abcd', maxZoom: 18,
      }).addTo(m)
      tiles.current.bringToBack()
    }
  }, [basemap, theme])

  // Ward polygons
  useEffect(() => {
    const m = map.current
    if (!m) return
    wardLayer.current?.remove()
    const values = geo.features.map((f) => Number((f.properties as Record<string, number>)[colorBy === 'hvi' ? 'hvi_score' : colorBy]))
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const line = cssColor('--surface')
    const fillFor = (p: Record<string, unknown>) => {
      if (colorBy === 'hvi') return riskColor(p.vulnerability_category as Category)
      let t = (Number(p[colorBy]) - lo) / (hi - lo || 1)
      if (colorBy === 'hospitals_per_100k') t = 1 - t // fewer hospitals = worse = hotter colour
      return heatRamp(t)
    }
    wardLayer.current = L.geoJSON(geo, {
      style: (f) => {
        const p = f!.properties as Record<string, unknown>
        const isSel = p.ward_id === selected
        return {
          color: isSel ? cssColor('--ink') : line, weight: isSel ? 3 : 1.2,
          fillColor: fillFor(p), fillOpacity: isSel ? 0.85 : 0.68,
        }
      },
      onEachFeature: (f, layer) => {
        const p = f.properties as Record<string, number | string>
        const val = colorBy === 'hvi' ? `HVI ${Number(p.hvi_score).toFixed(2)}, ${p.vulnerability_category}` : formatMetric(colorBy, Number(p[colorBy]))
        layer.bindTooltip(`<strong>Ward ${p.ward_id}</strong><br/>${p.ward_name}<br/>${val}`, { className: 'ward-tip', sticky: true })
        if (interactive) layer.on('click', () => onSelectRef.current?.(String(p.ward_id)))
      },
    }).addTo(m)
    if (!fitted.current) {
      m.fitBounds(wardLayer.current.getBounds(), { padding: [12, 12], animate: false })
      fitted.current = true
    }
  }, [geo, colorBy, selected, theme, interactive])

  // Points (facilities + hotspots)
  useEffect(() => {
    const g = pointLayer.current
    if (!g) return
    g.clearLayers()
    const surface = cssColor('--surface')
    for (const f of facilities) {
      L.circleMarker([f.lat, f.lon], {
        radius: f.type === 'CoolingCentre' ? 7 : 4, color: surface, weight: 1,
        fillColor: cssColor(FACILITY_VAR[f.type]), fillOpacity: 0.95,
      }).bindTooltip(`<strong>${escapeHtml(f.name)}</strong><br/>${f.type === 'WaterPoint' ? 'Drinking water' : f.type}` +
        `${f.data_status === 'illustrative' ? ' (illustrative)' : ''}<br/>Ward ${f.ward_id}`, { className: 'ward-tip' }).addTo(g)
    }
    for (const h of hotspots) {
      L.circleMarker([h.lat, h.lon], {
        radius: 9, color: cssColor('--ink'), weight: 2, dashArray: '3 3', fillOpacity: 0,
      }).bindTooltip(`<strong>${escapeHtml(h.name)}</strong><br/>Surface ≈ ${h.lst_celsius}°C (estimate)<br/>${escapeHtml(h.surface_type)}`,
        { className: 'ward-tip' }).addTo(g)
    }
  }, [facilities, hotspots, theme])

  return <div ref={el} role="img" aria-label={label} className={`isolate ${className}`} />
}

/** Sequential cool-to-hot ramp used for continuous metrics. */
export function heatRamp(t: number) {
  const stops = [[61, 154, 140], [233, 196, 106], [231, 111, 46], [176, 32, 44]]
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const f = x - i
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

export function formatMetric(key: ColorBy, v: number) {
  switch (key) {
    case 'mean_lst_celsius': return `${v.toFixed(1)}°C surface (estimate)`
    case 'slum_population_pct': return `${v.toFixed(0)}% in slums`
    case 'population_density_per_sqkm': return `${Math.round(v).toLocaleString('en-IN')} people/km²`
    case 'hospitals_per_100k': return `${v.toFixed(1)} hospitals per 100k`
    default: return v.toFixed(2)
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
