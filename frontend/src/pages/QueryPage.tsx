import { Play, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import type { CypherResult } from '../lib/types'
import { RowsTable } from './AskPage'

const EXAMPLES: { title: string; cypher: string }[] = [
  { title: 'Ten most vulnerable wards',
    cypher: 'MATCH (w:Ward)\nRETURN w.ward_id AS ward, w.ward_name AS area, w.hvi_score AS hvi, w.vulnerability_category AS category\nORDER BY w.hvi_score DESC\nLIMIT 10' },
  { title: 'Hospitals per ward',
    cypher: 'MATCH (h:Hospital)-[:LOCATED_IN]->(w:Ward)\nRETURN w.ward_id AS ward, COUNT(h) AS hospitals\nORDER BY hospitals DESC' },
  { title: 'Wards bordering Kurla (L)',
    cypher: "MATCH (a:Ward {ward_id: 'L'})-[:ADJACENT_TO]->(b:Ward)\nRETURN b.ward_id AS ward, b.hvi_score AS hvi\nORDER BY b.hvi_score DESC" },
  { title: 'Policy sections that mention a ward',
    cypher: 'MATCH (s:Section)-[:MENTIONS]->(w:Ward)\nRETURN w.ward_id AS ward, s.title AS section\nORDER BY ward' },
  { title: 'Hot and crowded wards',
    cypher: 'MATCH (w:Ward)\nWHERE w.mean_lst_celsius > 39 AND w.slum_population_pct > 50\nRETURN w.ward_id AS ward, w.mean_lst_celsius AS surface_temp, w.slum_population_pct AS slum_pct' },
  { title: 'City-wide averages',
    cypher: 'MATCH (w:Ward)\nRETURN avg(w.hvi_score) AS mean_hvi, max(w.mean_lst_celsius) AS hottest, sum(w.population_total) AS population' },
  { title: 'Heat alert levels',
    cypher: 'MATCH (a:HeatAdvisory)-[:DEFINED_IN]->(d:Document)\nRETURN a.name AS alert, a.tagline AS meaning, d.title AS source' },
  { title: 'Try a write (blocked)', cypher: 'MATCH (w:Ward) DETACH DELETE w' },
]

export function QueryPage() {
  const { route } = useApp()
  const [cypher, setCypher] = useState(route.params.get('cypher') ?? EXAMPLES[0].cypher)
  const [result, setResult] = useState<CypherResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (q = cypher) => {
    setBusy(true)
    setError(null)
    try { setResult(await api.cypher(q)) } catch (e) { setResult(null); setError((e as Error).message) } finally { setBusy(false) }
  }

  useEffect(() => { void run(route.params.get('cypher') ?? EXAMPLES[0].cypher) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader title="Query lab"
        lead="Run Cypher directly on the knowledge graph. The lab is read-only: CREATE, MERGE, SET, DELETE and procedure calls are rejected before they reach the database." />

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <nav aria-label="Example queries" className="card h-fit p-3">
          <p className="px-2 pb-2 text-sm font-medium">Examples</p>
          <ul className="space-y-0.5">
            {EXAMPLES.map((ex) => (
              <li key={ex.title}>
                <button type="button" className="min-h-[40px] w-full rounded px-2 text-start text-sm hover:bg-sunken"
                  onClick={() => { setCypher(ex.cypher); void run(ex.cypher) }}>{ex.title}</button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <form className="card p-4" onSubmit={(e) => { e.preventDefault(); void run() }}>
            <label htmlFor="cypher" className="label">Cypher</label>
            <textarea id="cypher" value={cypher} onChange={(e) => setCypher(e.target.value)} spellCheck={false} rows={7}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void run() } }}
              aria-describedby="cypher-hint"
              className="code mt-2 w-full resize-y border border-line-strong/60 p-3 text-[0.9375rem] leading-relaxed" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p id="cypher-hint" className="hint flex items-center gap-2"><ShieldCheck aria-hidden className="size-4" /> Read-only. Press Ctrl + Enter to run.</p>
              <button type="submit" className="btn-primary" disabled={busy}><Play aria-hidden className="size-4" />{busy ? 'Running…' : 'Run query'}</button>
            </div>
          </form>

          <div aria-live="polite">
            {error && (
              <div role="alert" className="card border-danger/40 p-4">
                <p className="font-medium text-danger">Query not run</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            )}
            {result && (
              <div className="card p-4">
                <p className="mb-3 text-sm text-muted">
                  {result.record_count} row{result.record_count === 1 ? '' : 's'} in {result.execution_time_ms} ms on {result.engine}
                </p>
                {result.rows.length ? <RowsTable rows={result.rows} max={100} /> : <p className="text-muted">The query ran but matched nothing.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
