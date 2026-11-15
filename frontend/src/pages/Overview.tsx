import { Building2, Droplet, MessageSquareText, Trees } from 'lucide-react'
import { ErrorState, Loading, RiskBadge, ScoreBar, riskBg } from '../components/ui'
import { WardMap } from '../components/WardMap'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import { CATEGORIES, compact, int, num } from '../lib/format'
import { useApi } from '../lib/useApi'

const EXAMPLE_QUESTIONS = [
  'Which wards are most vulnerable?',
  'Compare Govandi and Colaba',
  'What should BMC do during an Orange alert?',
]

export function OverviewPage() {
  const { go } = useApp()
  const ov = useApi(api.overview)
  const geo = useApi(api.wardsGeo)

  if (ov.error) return <ErrorState message={ov.error} onRetry={ov.reload} />
  if (!ov.data) return <Loading label="Building the knowledge graph…" />
  const o = ov.data
  const critNames = o.critical_wards.map((w) => w.ward_name.split(' / ')[0])
  const total = o.ward_count

  return (
    <div className="space-y-10">
      {/* Hero: the city coloured by vulnerability */}
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="rise max-w-[36rem]">
          <h1 className="text-2xl md:text-3xl">
            {compact(o.population_in_critical)} people live in Mumbai’s {o.critical_wards.length} most heat‑vulnerable wards.
          </h1>
          <p className="rise-2 mt-5 text-lg text-muted">
            In {critNames.slice(0, -1).join(', ')} and {critNames.at(-1)}, hot surfaces meet crowded slums and little help
            nearby. Together they hold {num(o.population_in_critical_pct, 1)}% of the city’s people in{' '}
            {o.critical_wards.length} of its {total} wards.
          </p>
          <div className="rise-3 mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn-primary min-h-[44px] px-5" onClick={() => go('map')}>Explore the map</button>
            <button type="button" className="btn-secondary min-h-[44px] px-5" onClick={() => go('ask')}>
              <MessageSquareText aria-hidden className="size-4" /> Ask a question
            </button>
          </div>
        </div>
        <figure className="rise-2 card overflow-hidden p-0">
          {geo.data ? (
            <WardMap geo={geo.data} interactive={false} basemap={false} className="h-[420px] w-full md:h-[480px]"
              label={`Map of Mumbai's 24 wards coloured by heat vulnerability. Critical: ${critNames.join(', ')}.`} />
          ) : geo.error ? <ErrorState message={geo.error} /> : <Loading className="h-[420px]" />}
          <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3">
            {CATEGORIES.map((c) => (
              <span key={c} className="flex items-center gap-2 text-sm">
                <RiskBadge category={c} size="sm" />
                <span className="text-muted">{o.category_counts[c]} wards</span>
              </span>
            ))}
          </figcaption>
        </figure>
      </section>

      {/* Distribution bar + key facts */}
      <section aria-labelledby="facts" className="card p-5 md:p-6">
        <h2 id="facts" className="text-lg">The city at a glance</h2>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full" role="img"
          aria-label={CATEGORIES.map((c) => `${o.category_counts[c]} ${c}`).join(', ')}>
          {CATEGORIES.map((c) => (
            <div key={c} className={riskBg(c)} style={{ width: `${(o.category_counts[c] / total) * 100}%` }} />
          ))}
        </div>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm text-muted">Population (Census 2011)</dt>
            <dd className="mt-1 font-display text-xl font-semibold">{compact(o.population_total)}</dd>
            <dd className="mt-1 text-sm text-muted">{num(o.slum_population_pct, 1)}% live in slums</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Surface temperature gap</dt>
            <dd className="mt-1 font-display text-xl font-semibold">{num(o.lst_spread_celsius, 1)}°C</dd>
            <dd className="mt-1 text-sm text-muted">Ward {o.hottest_ward.ward_id} vs Ward {o.coolest_ward.ward_id} (estimates)</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Facilities mapped</dt>
            <dd className="mt-1 font-display text-xl font-semibold">{int(o.facilities.Hospital + o.facilities.Park + o.facilities.WaterPoint)}</dd>
            <dd className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><Building2 aria-hidden className="size-3.5" />{int(o.facilities.Hospital)} hospitals</span>
              <span className="inline-flex items-center gap-1"><Trees aria-hidden className="size-3.5" />{int(o.facilities.Park)} parks</span>
              <span className="inline-flex items-center gap-1"><Droplet aria-hidden className="size-3.5" />{o.facilities.WaterPoint} water</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Knowledge graph</dt>
            <dd className="mt-1 font-display text-xl font-semibold">{int(o.graph.nodes)} nodes</dd>
            <dd className="mt-1 text-sm text-muted">{int(o.graph.relationships)} relationships, {o.graph.labels} node types</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Top wards */}
        <section aria-labelledby="top">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="top" className="text-lg">Most vulnerable wards</h2>
            <a href="#/wards" className="text-sm font-medium text-accent underline-offset-4 hover:underline">See all 24 wards</a>
          </div>
          <ol className="mt-4 divide-y divide-line card">
            {o.top_wards.map((w) => (
              <li key={w.ward_id}>
                <a href={`#/wards?ward=${encodeURIComponent(w.ward_id)}`}
                  className="grid gap-x-6 gap-y-3 p-4 transition-colors duration-150 hover:bg-sunken sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                  <div className="flex items-start gap-3">
                    <span className="w-6 pt-0.5 text-sm font-medium text-muted">{w.hvi_rank}</span>
                    <div className="min-w-0">
                      <p className="font-semibold">Ward {w.ward_id}</p>
                      <p className="truncate text-sm text-muted">{w.ward_name}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <RiskBadge category={w.vulnerability_category} size="sm" />
                        <span className="text-sm">HVI {w.hvi_score.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 ps-9 min-[420px]:grid-cols-3 sm:ps-0">
                    <ScoreBar label="Heat" value={w.exposure_score} />
                    <ScoreBar label="People" value={w.sensitivity_score} />
                    <ScoreBar label="Help" value={w.adaptive_capacity_score} tone="accent" />
                  </div>
                </a>
              </li>
            ))}
          </ol>
        </section>

        {/* How it works – a real sequence, so numbered */}
        <section aria-labelledby="how">
          <h2 id="how" className="text-lg">How an answer is made</h2>
          <ol className="mt-4 space-y-4">
            {[
              ['Collect', 'Real ward boundaries, Census 2011, OpenStreetMap facilities and three policy documents.'],
              ['Connect', 'Everything becomes nodes and relationships in one knowledge graph.'],
              ['Score', 'Each ward gets a heat vulnerability index from exposure, sensitivity and capacity.'],
              ['Ask', 'A question becomes a Cypher query plus a document search, and the answer cites both.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-ink">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <p className="text-sm text-muted">Try asking</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button key={q} type="button" className="chip" onClick={() => go('ask', { q })}>{q}</button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
