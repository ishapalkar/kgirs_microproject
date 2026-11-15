import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ErrorState, Loading, PageHeader, RiskBadge, ScoreBar } from '../components/ui'
import { COLOR_BY_LABEL, facilityColor, heatRamp, WardMap, type ColorBy } from '../components/WardMap'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import { FACILITY_LABEL, int, num } from '../lib/format'
import type { Facility } from '../lib/types'
import { useApi } from '../lib/useApi'

const TYPES: Facility['type'][] = ['Hospital', 'Park', 'WaterPoint', 'CoolingCentre']

export function MapPage() {
  const { go } = useApp()
  const geo = useApi(api.wardsGeo)
  const fac = useApi(() => api.facilities())
  const hot = useApi(api.hotspots)
  const wards = useApi(api.wards)

  const [colorBy, setColorBy] = useState<ColorBy>('hvi')
  const [shown, setShown] = useState<Set<Facility['type']>>(new Set(['CoolingCentre']))
  const [showHot, setShowHot] = useState(true)
  const [basemap, setBasemap] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    fac.data?.forEach((f) => { c[f.type] = (c[f.type] ?? 0) + 1 })
    return c
  }, [fac.data])
  const visible = useMemo(() => (fac.data ?? []).filter((f) => shown.has(f.type)), [fac.data, shown])
  const ward = wards.data?.find((w) => w.ward_id === selected)

  const toggle = (t: Facility['type']) => setShown((s) => {
    const n = new Set(s)
    if (n.has(t)) n.delete(t); else n.add(t)
    return n
  })

  if (geo.error) return <ErrorState message={geo.error} onRetry={geo.reload} />

  return (
    <div>
      <PageHeader title="Ward map"
        lead="Real BMC ward boundaries. Choose what the colours show, turn facility layers on, and select a ward for its profile." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card relative h-fit self-start overflow-hidden p-0">
          {geo.data ? (
            <WardMap geo={geo.data} colorBy={colorBy} selected={selected} onSelect={setSelected}
              facilities={visible} hotspots={showHot ? hot.data ?? [] : []} basemap={basemap}
              className="h-[min(72dvh,720px)] min-h-[420px] w-full"
              label={`Interactive map of Mumbai wards coloured by ${COLOR_BY_LABEL[colorBy]}`} />
          ) : <Loading className="h-[60dvh]" />}
          <Legend colorBy={colorBy} />
        </div>

        <div className="space-y-5">
          {ward ? (
            <section className="card p-5" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg">Ward {ward.ward_id}</h2>
                  <p className="text-sm text-muted">{ward.ward_name}</p>
                </div>
                <button type="button" className="btn-ghost -me-2 px-2" aria-label="Clear selected ward" onClick={() => setSelected(null)}>
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <RiskBadge category={ward.vulnerability_category} />
                <span className="text-sm">HVI {ward.hvi_score.toFixed(2)}, rank {ward.hvi_rank} of 24</span>
              </div>
              <div className="mt-4 space-y-3">
                <ScoreBar label="Heat exposure" value={ward.exposure_score} />
                <ScoreBar label="Sensitivity of residents" value={ward.sensitivity_score} />
                <ScoreBar label="Adaptive capacity" value={ward.adaptive_capacity_score} tone="accent" />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">Population</dt><dd className="font-medium">{int(ward.population_total)}</dd></div>
                <div><dt className="text-muted">In slums</dt><dd className="font-medium">{num(ward.slum_population_pct, 0)}%</dd></div>
                <div><dt className="text-muted">Surface temp.</dt><dd className="font-medium">{ward.mean_lst_celsius}°C <span className="text-muted">est.</span></dd></div>
                <div><dt className="text-muted">Hospitals</dt><dd className="font-medium">{ward.hospitals_count}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => go('wards', { ward: ward.ward_id })}>Open ward profile</button>
                <button type="button" className="btn-secondary" onClick={() => go('ask', { q: `Tell me about Ward ${ward.ward_id}` })}>Ask about it</button>
              </div>
            </section>
          ) : (
            <p className="card p-5 text-sm text-muted">Select a ward on the map, or pick one below, to see its scores and population here.</p>
          )}

          <section className="card p-5">
            <label htmlFor="pick" className="label">Ward</label>
            <select id="pick" className="input mt-2" value={selected ?? ''} onChange={(e) => setSelected(e.target.value || null)}>
              <option value="">Choose a ward</option>
              {[...(wards.data ?? [])].sort((a, b) => a.ward_id.localeCompare(b.ward_id)).map((w) => (
                <option key={w.ward_id} value={w.ward_id}>Ward {w.ward_id}: {w.ward_name}</option>
              ))}
            </select>
          </section>

          <section className="card p-5" aria-labelledby="colour">
            <h2 id="colour" className="text-base">Colour wards by</h2>
            <div className="mt-3 space-y-1" role="radiogroup" aria-labelledby="colour">
              {(Object.keys(COLOR_BY_LABEL) as ColorBy[]).map((k) => (
                <label key={k} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-sunken">
                  <input type="radio" name="colorby" className="size-4 accent-[rgb(var(--accent))]" checked={colorBy === k} onChange={() => setColorBy(k)} />
                  {COLOR_BY_LABEL[k]}
                </label>
              ))}
            </div>
          </section>

          <section className="card p-5" aria-labelledby="layers">
            <h2 id="layers" className="text-base">Layers</h2>
            <div className="mt-3 space-y-1">
              {TYPES.map((t) => (
                <label key={t} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-sunken">
                  <input type="checkbox" className="size-4 accent-[rgb(var(--accent))]" checked={shown.has(t)} onChange={() => toggle(t)} />
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: facilityColor(t) }} />
                  <span className="flex-1">{FACILITY_LABEL[t]}</span>
                  <span className="text-muted">{counts[t] ?? 0}</span>
                </label>
              ))}
              <label className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-sunken">
                <input type="checkbox" className="size-4 accent-[rgb(var(--accent))]" checked={showHot} onChange={() => setShowHot(!showHot)} />
                <span aria-hidden className="size-2.5 rounded-full border-2 border-dashed border-ink" />
                <span className="flex-1">Heat hotspots</span>
                <span className="text-muted">{hot.data?.length ?? 0}</span>
              </label>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-sunken">
                <input type="checkbox" className="size-4 accent-[rgb(var(--accent))]" checked={basemap} onChange={() => setBasemap(!basemap)} />
                <span className="flex-1">Street basemap</span>
              </label>
            </div>
            <p className="mt-3 text-xs text-muted">
              Hospitals, parks and water points come from OpenStreetMap. Cooling shelters and hotspots are illustrative estimates.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

function Legend({ colorBy }: { colorBy: ColorBy }) {
  if (colorBy === 'hvi') {
    return (
      <div className="absolute bottom-3 start-3 z-[500] rounded bg-surface/95 p-3 shadow-[var(--shadow)]">
        <p className="text-xs font-medium text-ink">Heat vulnerability</p>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {(['Critical', 'High', 'Moderate', 'Low'] as const).map((c) => <RiskBadge key={c} category={c} size="sm" />)}
        </div>
      </div>
    )
  }
  const inverted = colorBy === 'hospitals_per_100k'
  return (
    <div className="absolute bottom-3 start-3 z-[500] rounded bg-surface/95 p-3 text-xs shadow-[var(--shadow)]">
      <p className="font-medium text-ink">{COLOR_BY_LABEL[colorBy]}</p>
      <div className="mt-2 h-2 w-44 rounded-full" style={{ background: `linear-gradient(90deg, ${heatRamp(0)}, ${heatRamp(0.33)}, ${heatRamp(0.66)}, ${heatRamp(1)})` }} />
      <div className="mt-1 flex justify-between text-muted"><span>{inverted ? 'Most' : 'Lowest'}</span><span>{inverted ? 'Fewest' : 'Highest'}</span></div>
    </div>
  )
}
