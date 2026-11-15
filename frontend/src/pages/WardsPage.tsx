import { ArrowDown, ArrowUp, MessageSquareText, RotateCw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTag, ErrorState, Loading, PageHeader, RiskBadge, ScoreBar, riskBg } from '../components/ui'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import { CATEGORIES, int, num } from '../lib/format'
import type { Ward, WardDetail, Weights } from '../lib/types'
import { useApi } from '../lib/useApi'

const DEFAULT: Weights = { weight_exposure: 0.4, weight_sensitivity: 0.35, weight_adaptive_capacity: 0.25 }
const SLIDERS: { key: keyof Weights; label: string; help: string }[] = [
  { key: 'weight_exposure', label: 'Heat exposure', help: 'Surface temperature and lack of vegetation' },
  { key: 'weight_sensitivity', label: 'Sensitivity', help: 'Density, slum share, young children, non-literate share' },
  { key: 'weight_adaptive_capacity', label: 'Lack of capacity', help: 'Few hospitals, parks and water points per person' },
]

export function WardsPage() {
  const { route, go } = useApp()
  const base = useApi(api.wards)
  const [weights, setWeights] = useState<Weights>(DEFAULT)
  const [wards, setWards] = useState<Ward[] | null>(null)
  const [busy, setBusy] = useState(false)
  const selectedId = route.params.get('ward')
  const changed = SLIDERS.some((s) => weights[s.key] !== DEFAULT[s.key])

  // Recalculate on the server whenever the weights change (debounced).
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!changed) { setWards(null); return }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setBusy(true)
      api.recalculate(weights).then((r) => setWards(r.wards)).finally(() => setBusy(false))
    }, 180)
  }, [weights, changed])

  const rows = wards ?? base.data
  const total = SLIDERS.reduce((s, x) => s + weights[x.key], 0) || 1
  const counts = useMemo(() => {
    const c = { Critical: 0, High: 0, Moderate: 0, Low: 0 }
    rows?.forEach((w) => { c[w.vulnerability_category]++ })
    return c
  }, [rows])

  if (base.error) return <ErrorState message={base.error} onRetry={base.reload} />
  if (!rows) return <Loading />

  return (
    <div>
      <PageHeader title="Ward rankings"
        lead={<>The heat vulnerability index (HVI) ranks wards against each other from 0 to 1. Change how much each part
          counts and the ranking updates; arrows show how far each ward moved.</>} />

      <section aria-labelledby="weights" className="card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="weights" className="text-lg">Weights</h2>
          <div className="flex items-center gap-3">
            <span role="status" className="text-sm text-muted">{busy ? 'Recalculating…' : changed ? 'Custom weights' : 'Default weights'}</span>
            <button type="button" className="btn-secondary" disabled={!changed} onClick={() => setWeights(DEFAULT)}>
              <RotateCw aria-hidden className="size-4" /> Reset weights
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between">
                <label htmlFor={s.key} className="label">{s.label}</label>
                <span className="text-sm font-semibold">{Math.round((weights[s.key] / total) * 100)}%</span>
              </div>
              <input id={s.key} type="range" min={0} max={1} step={0.05} value={weights[s.key]}
                aria-describedby={`${s.key}-help`}
                onChange={(e) => setWeights((w) => ({ ...w, [s.key]: Number(e.target.value) }))}
                className="mt-2 h-2 w-full cursor-pointer accent-[rgb(var(--accent))]" />
              <p id={`${s.key}-help`} className="hint mt-1">{s.help}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">
          HVI = exposure × {num(weights.weight_exposure / total, 2)} + sensitivity × {num(weights.weight_sensitivity / total, 2)} + (1 − capacity) × {num(weights.weight_adaptive_capacity / total, 2)}
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2" aria-label="Wards per category">
        {CATEGORIES.map((c) => (
          <span key={c} className="flex items-center gap-2 text-sm"><RiskBadge category={c} size="sm" /><span className="text-muted">{counts[c]}</span></span>
        ))}
      </div>

      <div className={`mt-4 grid gap-6 ${selectedId ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
        <div className="card overflow-x-auto p-0">
          <table className="w-full  text-sm">
            <caption className="sr-only">Wards ranked by heat vulnerability</caption>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className="table-head w-14 px-3 py-3 md:px-4">Rank</th>
                <th scope="col" className="table-head px-2 py-3 sm:px-4">Ward</th>
                <th scope="col" className="table-head px-3 py-3 sm:w-[24%] sm:px-4">HVI</th>
                <th scope="col" className="table-head hidden px-3 py-3 md:table-cell">Heat</th>
                <th scope="col" className="table-head hidden px-3 py-3 md:table-cell">People</th>
                <th scope="col" className="table-head hidden px-3 py-3 md:table-cell">Help</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((w) => {
                const sel = w.ward_id === selectedId
                return (
                  <tr key={w.ward_id} className={sel ? 'bg-accent-soft' : 'hover:bg-sunken'}>
                    <td className="px-3 py-3 md:px-4">
                      <span className="flex items-center gap-1.5 font-medium">
                        {w.hvi_rank}
                        <RankChange delta={w.rank_change} />
                      </span>
                    </td>
                    <td className="px-2 py-3 sm:px-4">
                      <button type="button" onClick={() => go('wards', { ward: w.ward_id })} aria-pressed={sel}
                        className="min-h-[40px] text-start">
                        <span className="block font-semibold underline-offset-4 hover:underline">Ward {w.ward_id}</span>
                        <span className="block max-w-[13ch] truncate sm:max-w-[34ch] text-muted" title={w.ward_name}>{w.ward_name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex items-center gap-3">
                        <div className="hidden h-2 flex-1 rounded-full bg-sunken sm:block">
                          <div className={`h-full rounded-full ${riskBg(w.vulnerability_category)}`} style={{ width: `${w.hvi_score * 100}%` }} />
                        </div>
                        <span className="font-medium sm:w-10 sm:text-end">{w.hvi_score.toFixed(2)}</span>
                      </div>
                      <div className="mt-1"><RiskBadge category={w.vulnerability_category} size="sm" /></div>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">{w.exposure_score.toFixed(2)}</td>
                    <td className="hidden px-3 py-3 md:table-cell">{w.sensitivity_score.toFixed(2)}</td>
                    <td className="hidden px-3 py-3 md:table-cell">{w.adaptive_capacity_score.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {selectedId && <WardProfile id={selectedId} scored={rows.find((r) => r.ward_id === selectedId)} onClose={() => go('wards')} />}
      </div>
    </div>
  )
}

function RankChange({ delta }: { delta?: number }) {
  if (!delta) return null
  const up = delta > 0
  return (
    <span className="inline-flex items-center text-xs font-medium text-muted" aria-label={`${up ? 'up' : 'down'} ${Math.abs(delta)}`}>
      {up ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}{Math.abs(delta)}
    </span>
  )
}

function WardProfile({ id, scored, onClose }: { id: string; scored?: Ward; onClose: () => void }) {
  const { go } = useApp()
  const d = useApi<WardDetail>(() => api.ward(id), [id])
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { if (d.data) ref.current?.focus() }, [d.data])

  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />
  if (!d.data) return <div className="card"><Loading /></div>
  const w = { ...d.data, ...(scored ?? {}) }

  return (
    <aside ref={ref} tabIndex={-1} aria-label={`Ward ${w.ward_id} profile`}
      className="card h-fit space-y-6 p-5 outline-none xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl">Ward {w.ward_id}</h2>
          <p className="text-muted">{w.ward_name}, {w.zone}</p>
        </div>
        <button type="button" className="btn-ghost -me-2 px-2" aria-label="Close ward profile" onClick={onClose}><X className="size-5" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <RiskBadge category={w.vulnerability_category} />
        <span>HVI <strong>{w.hvi_score.toFixed(2)}</strong>, rank {w.hvi_rank} of 24</span>
      </div>
      <p className="leading-relaxed">{w.explanation}</p>

      <div className="space-y-3">
        <ScoreBar label="Heat exposure" value={w.exposure_score} />
        <ScoreBar label="Sensitivity of residents" value={w.sensitivity_score} />
        <ScoreBar label="Adaptive capacity (higher is better)" value={w.adaptive_capacity_score} tone="accent" />
      </div>

      <section>
        <h3 className="text-base">People <DataTag status="real" /></h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item k="Population (2011)" v={int(w.population_total)} />
          <Item k="Density" v={`${int(w.population_density_per_sqkm)} /km²`} />
          <Item k="Living in slums" v={`${num(w.slum_population_pct, 1)}%`} />
          <Item k="Children 0–6" v={`${num(w.children_0_6_pct, 1)}%`} />
          <Item k="Literacy" v={`${num(w.literacy_pct, 1)}%`} />
          <Item k="Area" v={`${num(w.area_km2, 1)} km²`} />
        </dl>
      </section>

      <section>
        <h3 className="text-base">Help nearby <DataTag status="real" /></h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item k="Hospitals" v={`${w.hospitals_count} (${num(w.hospitals_per_100k, 1)} per 100k)`} />
          <Item k="Parks" v={`${w.parks_count} (${num(w.parks_per_100k, 1)} per 100k)`} />
          <Item k="Drinking water" v={`${w.water_points_count}`} />
          <Item k="Cooling shelters" v={`${w.cooling_centres_count} (illustrative)`} />
        </dl>
      </section>

      <section>
        <h3 className="text-base">Heat <DataTag status="estimate" /></h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item k="Mean surface temp." v={`${w.mean_lst_celsius}°C`} />
          <Item k="Peak surface temp." v={`${w.max_lst_celsius}°C`} />
          <Item k="Vegetation (NDVI)" v={`${w.mean_ndvi}`} />
          <Item k="Hotspots" v={`${w.hotspots.length}`} />
        </dl>
      </section>

      <section>
        <h3 className="text-base">Recommended actions</h3>
        <ul className="mt-2 list-disc space-y-1.5 ps-5 text-sm marker:text-muted">
          {w.priority_interventions.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>

      {w.neighbours.length > 0 && (
        <section>
          <h3 className="text-base">Bordering wards</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {w.neighbours.map((n) => <button key={n} type="button" className="chip" onClick={() => go('wards', { ward: n })}>Ward {n}</button>)}
          </div>
        </section>
      )}

      {w.document_mentions.length > 0 && (
        <section>
          <h3 className="text-base">Mentioned in policy documents</h3>
          <ul className="mt-2 space-y-3">
            {w.document_mentions.map((m) => (
              <li key={m.section_id} className="rounded bg-sunken p-3 text-sm">
                <p className="font-medium">{m.document}</p>
                <p className="text-muted">{m.section}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="btn-primary w-full" onClick={() => go('ask', { q: `Tell me about Ward ${w.ward_id}` })}>
        <MessageSquareText aria-hidden className="size-4" /> Ask about Ward {w.ward_id}
      </button>
    </aside>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
}
