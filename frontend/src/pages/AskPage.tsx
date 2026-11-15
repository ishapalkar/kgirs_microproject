import { Check, Copy, Send, SquareTerminal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GraphView } from '../components/GraphView'
import { Markdown } from '../components/Markdown'
import { PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import type { AskResponse } from '../lib/types'

const EXAMPLES = [
  'Which wards are most vulnerable?',
  'Tell me about Bandra ward H/West',
  'Which wards have the fewest hospitals per person?',
  'Compare Govandi and Colaba',
  'Which wards border Dharavi?',
  'What should BMC do during an Orange alert?',
  'When is a heatwave declared in Mumbai?',
  'Top 3 wards with the most slum population',
]

interface Turn { q: string; res?: AskResponse; error?: string }

export function AskPage() {
  const { route, go } = useApp()
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const asked = useRef<string | null>(null)

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    setBusy(true)
    setInput('')
    setTurns((t) => [{ q: question }, ...t])
    try {
      const res = await api.ask(question)
      setTurns((t) => [{ q: question, res }, ...t.slice(1)])
    } catch (e) {
      setTurns((t) => [{ q: question, error: (e as Error).message }, ...t.slice(1)])
    } finally {
      setBusy(false)
    }
  }

  // Questions passed in the URL (from other pages) are asked automatically, once.
  const fromUrl = route.params.get('q')
  useEffect(() => {
    if (fromUrl && asked.current !== fromUrl) {
      asked.current = fromUrl
      void ask(fromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl])

  return (
    <div>
      <PageHeader title="Ask the graph"
        lead="Ask in plain English. The question is matched to wards, searched in the policy documents, turned into a Cypher query on the knowledge graph, and answered with sources." />

      <form className="card flex flex-col gap-3 p-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void ask(input) }}>
        <label htmlFor="q" className="sr-only">Your question</label>
        <input id="q" className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="For example: Which wards have the fewest parks per person?" autoComplete="off" maxLength={500} />
        <button type="submit" className="btn-primary min-h-[44px] px-5" disabled={busy}>
          <Send aria-hidden className="size-4" /> {busy ? 'Answering…' : 'Ask'}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Example questions">
        {EXAMPLES.map((q) => <button key={q} type="button" className="chip" disabled={busy} onClick={() => void ask(q)}>{q}</button>)}
      </div>

      <div className="mt-8 space-y-8" aria-live="polite">
        {turns.length === 0 && (
          <p className="card p-6 text-muted">Pick an example above or type your own question to see the full reasoning trace.</p>
        )}
        {turns.map((t, i) => <Answer key={`${t.q}-${turns.length - i}`} turn={t} onOpenQuery={(c) => go('query', { cypher: c })} />)}
      </div>
    </div>
  )
}

function Answer({ turn, onOpenQuery }: { turn: Turn; onOpenQuery: (cypher: string) => void }) {
  const [focus, setFocus] = useState<string | null>(null)
  const sourcesRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const { res } = turn

  const onCite = (k: string) => {
    setFocus(k)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    ;(k === 'G' ? rowsRef : sourcesRef).current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  }

  return (
    <article className="card overflow-hidden p-0">
      <header className="border-b border-line bg-sunken/60 px-5 py-4">
        <h2 className="text-lg">{turn.q}</h2>
        {res && (
          <p className="mt-1 text-sm text-muted">
            {res.mode === 'llm' ? `Answer written by ${res.model}` : 'Answer built from query results (no AI key set)'}, graph on {res.engine}
          </p>
        )}
      </header>

      {!res && !turn.error && <p role="status" className="px-5 py-6 text-muted">Linking entities, searching documents and querying the graph…</p>}
      {turn.error && <p role="alert" className="px-5 py-6 text-danger">{turn.error}</p>}

      {res && (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <div className="space-y-6 p-5">
            <div className="max-w-[72ch] text-[1.0625rem]"><Markdown text={res.answer} onCite={onCite} /></div>

            {res.citations.length > 0 && (
              <section ref={sourcesRef} aria-label="Sources">
                <h3 className="text-base">Sources</h3>
                <ol className="mt-2 space-y-2">
                  {res.citations.map((c) => (
                    <li key={c.key} className={`rounded p-3 text-sm transition-colors duration-150 ${focus === c.key ? 'bg-accent-soft' : 'bg-sunken'}`}>
                      <p><span className="me-2 rounded-sm bg-surface px-1.5 text-xs font-semibold">{c.key}</span>
                        <span className="font-medium">{c.document_title}</span>, {c.section}</p>
                      <p className="mt-1 text-muted">{c.excerpt}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section aria-label="How this answer was made">
              <h3 className="text-base">How this answer was made</h3>
              <ol className="mt-3 space-y-0">
                {res.steps.map((s, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold">{i + 1}</span>
                    {i < res.steps.length - 1 && <span aria-hidden className="absolute start-3 top-6 h-[calc(100%-1.5rem)] w-px bg-line" />}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold">{s.name}</span>
                        <span className="text-xs text-muted">{s.duration_ms < 1 ? '<1' : Math.round(s.duration_ms)} ms</span>
                      </p>
                      <p className="text-muted">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="space-y-5 border-t border-line p-5 lg:border-s lg:border-t-0">
            {res.cypher && <CypherBlock cypher={res.cypher} onOpen={() => onOpenQuery(res.cypher!)} />}
            {res.cypher_error && <p className="rounded bg-sunken p-3 text-sm"><strong>Query error:</strong> {res.cypher_error}</p>}
            {res.cypher_rows.length > 0 && (
              <div ref={rowsRef} className={`rounded transition-colors duration-150 ${focus === 'G' ? 'ring-2 ring-accent' : ''}`}>
                <RowsTable rows={res.cypher_rows} />
              </div>
            )}
            {res.subgraph.nodes.length > 0 && (
              <section aria-label="Graph used for this answer">
                <h3 className="text-base">Graph used</h3>
                <p className="text-sm text-muted">Outlined nodes were used in the answer. Others are their neighbours.</p>
                <GraphView graph={res.subgraph} highlight={res.highlight_node_ids}
                  className="mt-3 h-[340px] rounded bg-sunken"
                  label={`Sub-graph with ${res.subgraph.nodes.length} nodes used for the answer`} />
              </section>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

export function CypherBlock({ cypher, onOpen }: { cypher: string; onOpen?: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <section aria-label="Cypher query">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base">Cypher query</h3>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label={copied ? 'Copied' : 'Copy query'}
            onClick={() => { void navigator.clipboard?.writeText(cypher); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
          {onOpen && (
            <button type="button" className="btn-ghost min-h-[36px] px-2" onClick={onOpen}>
              <SquareTerminal aria-hidden className="size-4" /> Open in query lab
            </button>
          )}
        </div>
      </div>
      <pre className="code mt-2 overflow-x-auto whitespace-pre-wrap p-3">{formatCypher(cypher)}</pre>
    </section>
  )
}

export function formatCypher(q: string) {
  return q.replace(/\s+(WHERE|RETURN|ORDER BY|LIMIT|MATCH|SKIP)\b/g, '\n$1')
}

export function RowsTable({ rows, max = 12 }: { rows: Record<string, unknown>[]; max?: number }) {
  const cols = Object.keys(rows[0] ?? {})
  return (
    <div>
      <p className="mb-2 text-sm text-muted">Query results: {rows.length} row{rows.length === 1 ? '' : 's'}{rows.length > max ? `, first ${max} shown` : ''}</p>
      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full text-sm">
          <thead className="bg-sunken">
            <tr>{cols.map((c) => <th key={c} scope="col" className="table-head whitespace-nowrap px-3 py-2">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, max).map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c} className="min-w-[8ch] max-w-[40ch] break-words px-3 py-2 align-top">{fmt(r[c])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
