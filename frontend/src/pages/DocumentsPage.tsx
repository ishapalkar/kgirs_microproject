import { ChevronRight, Search, Thermometer } from 'lucide-react'
import { useState } from 'react'
import { DataTag, ErrorState, Loading, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import type { HeatwaveAssessment, SearchHit } from '../lib/types'
import { useApi } from '../lib/useApi'

export function DocumentsPage() {
  const docs = useApi(api.documents)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="space-y-10">
      <PageHeader title="Documents"
        lead="The policy texts behind the answers. Search them the way GraphRAG does, read each section, and check the official IMD heatwave rules." />

      <SearchPanel />

      <section aria-labelledby="library">
        <h2 id="library" className="text-lg">Library</h2>
        <p className="mt-1 text-sm text-muted">
          These are summaries the team wrote from the official plans, not the full texts. Add official PDFs to
          <code className="code mx-1 px-1.5">data/documents/</code> and list them in <code className="code mx-1 px-1.5">manifest.json</code> to index them.
        </p>
        {docs.error && <ErrorState message={docs.error} onRetry={docs.reload} />}
        {!docs.data && !docs.error && <Loading />}
        <div className="mt-4 space-y-3">
          {docs.data?.map((d) => {
            const isOpen = open === d.id
            return (
              <article key={d.id} className="card">
                <h3 className="text-base">
                  <button type="button" aria-expanded={isOpen} aria-controls={`${d.id}-body`} onClick={() => setOpen(isOpen ? null : d.id)}
                    className="flex min-h-[56px] w-full items-center gap-4 px-5 py-3 text-start">
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-semibold">{d.title}</span>
                      <span className="block text-sm font-normal text-muted">{d.agency}, {d.year}, {d.sections.length} sections</span>
                    </span>
                    <DataTag status="summary" />
                    <ChevronRight aria-hidden className={`size-5 text-muted motion-safe:transition-transform motion-safe:duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                </h3>
                {isOpen && (
                  <div id={`${d.id}-body`} className="space-y-5 border-t border-line px-5 py-5">
                    {d.sections.map((s) => (
                      <section key={s.id}>
                        <h4 className="font-semibold">{s.title}</h4>
                        <p className="mt-1 max-w-[75ch] whitespace-pre-line text-[0.9375rem] leading-relaxed">{s.text}</p>
                        {s.wards_mentioned.length > 0 && (
                          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                            Linked in the graph to
                            {s.wards_mentioned.map((w) => <a key={w} href={`#/wards?ward=${encodeURIComponent(w)}`} className="chip">Ward {w}</a>)}
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <HeatwaveChecker />
    </div>
  )
}

function SearchPanel() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ method: string; results: SearchHit[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = (query: string) => {
    setQ(query)
    api.search(query).then((r) => { setRes(r); setError(null) }).catch((e: Error) => setError(e.message))
  }

  return (
    <section aria-labelledby="search" className="card p-5 md:p-6">
      <h2 id="search" className="text-lg">Hybrid search</h2>
      <p className="mt-1 max-w-[70ch] text-sm text-muted">
        Each passage gets two ranks: one from BM25 keyword matching and one from semantic similarity. They are merged with
        reciprocal rank fusion, so a passage that does well on both comes first.
      </p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (q.trim().length > 1) run(q) }}>
        <label htmlFor="s" className="sr-only">Search the documents</label>
        <input id="s" className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: staying cool during an orange alert" />
        <button type="submit" className="btn-primary min-h-[44px]"><Search aria-hidden className="size-4" /> Search</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {['cool roofs in Govandi', 'when is a heatwave declared', 'hydration for outdoor workers', 'satellite temperature vs air temperature'].map((s) => (
          <button key={s} type="button" className="chip" onClick={() => run(s)}>{s}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
      {res && (
        <div className="mt-5" aria-live="polite">
          <p className="text-sm text-muted">Semantic method: {res.method}</p>
          {res.results.length === 0 ? <p className="mt-3">No passage matched. Try different words.</p> : (
            <ol className="mt-3 space-y-3">
              {res.results.map((r, i) => (
                <li key={r.chunk_id} className="rounded bg-sunken p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-semibold">{i + 1}. {r.document_title}, {r.section}</p>
                    <p className="text-xs text-muted">
                      Keyword rank {r.bm25_rank ?? '–'}, semantic rank {r.semantic_rank ?? '–'}, fused {r.score.toFixed(4)}
                    </p>
                  </div>
                  <p className="mt-2 max-w-[80ch] text-sm leading-relaxed">{r.content.slice(0, 420)}{r.content.length > 420 ? '…' : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

function HeatwaveChecker() {
  const [temp, setTemp] = useState(38.5)
  const [station, setStation] = useState('Santacruz')
  const [month, setMonth] = useState('May')
  const [days, setDays] = useState(2)
  const [res, setRes] = useState<HeatwaveAssessment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = () => api.assess({ actual_max_temp_celsius: temp, station_name: station, month, consecutive_days: days })
    .then((r) => { setRes(r); setError(null) }).catch((e: Error) => setError(e.message))

  return (
    <section aria-labelledby="imd" className="card p-5 md:p-6">
      <h2 id="imd" className="flex items-center gap-2 text-lg"><Thermometer aria-hidden className="size-5 text-accent" /> IMD heatwave checker</h2>
      <p className="mt-1 max-w-[70ch] text-sm text-muted">
        Official heatwaves use air temperature measured in the shade at a weather station, not satellite surface temperature.
        Enter a station reading to apply the coastal rules for Mumbai.
      </p>
      <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end" onSubmit={(e) => { e.preventDefault(); void check() }}>
        <div>
          <label htmlFor="t" className="label">Max air temperature (°C)</label>
          <input id="t" type="number" step="0.1" min={20} max={55} className="input mt-1" value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="st" className="label">Station</label>
          <select id="st" className="input mt-1" value={station} onChange={(e) => setStation(e.target.value)}>
            <option>Santacruz</option><option>Colaba</option>
          </select>
        </div>
        <div>
          <label htmlFor="m" className="label">Month</label>
          <select id="m" className="input mt-1" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option>March</option><option>April</option><option>May</option>
          </select>
        </div>
        <div>
          <label htmlFor="d" className="label">Days in a row</label>
          <input id="d" type="number" min={1} max={14} className="input mt-1" value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </div>
        <button type="submit" className="btn-primary min-h-[44px]">Check rules</button>
      </form>
      <div aria-live="polite">
        {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
        {res && (
          <div className="mt-5 rounded bg-sunken p-4">
            <p className="font-display text-lg font-semibold">
              {res.is_severe_heatwave ? 'Severe heatwave' : res.is_heatwave ? 'Heatwave' : 'Not a heatwave'}
              <span className="ms-2 text-base font-normal text-muted">{res.alert_level}</span>
            </p>
            <p className="mt-1 text-sm">
              {res.actual_temp_c}°C against a normal of {res.normal_temp_c}°C at {res.station_name} is a departure of{' '}
              {res.departure_c > 0 ? '+' : ''}{res.departure_c.toFixed(1)}°C.
            </p>
            <p className="mt-2 text-sm text-muted">{res.criteria_triggered}</p>
          </div>
        )}
      </div>
    </section>
  )
}
