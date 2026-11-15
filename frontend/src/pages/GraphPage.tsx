import { useEffect, useState } from 'react'
import { GraphView, LABEL_STYLE } from '../components/GraphView'
import { ErrorState, Loading, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import { riskColor } from '../lib/format'
import type { Subgraph, VisNode } from '../lib/types'
import { useApi } from '../lib/useApi'
import { fmt } from './AskPage'

const HIDDEN_PROPS = new Set(['id', 'indicator_scores', 'drivers', 'priority_interventions', 'explanation', 'text'])

export function GraphPage() {
  const { route, go } = useApp()
  const schema = useApi(api.schema)
  const wards = useApi(api.wards)
  const focus = route.params.get('ward') ?? ''
  const [graph, setGraph] = useState<Subgraph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<VisNode | null>(null)

  useEffect(() => {
    setGraph(null)
    setSelected(null)
    api.subgraph(focus || undefined).then(setGraph).catch((e: Error) => setError(e.message))
  }, [focus])

  const expand = (id: string) => {
    api.node(id).then((sub) => setGraph((g) => {
      if (!g) return sub
      const ids = new Set(g.nodes.map((n) => n.id))
      const keys = new Set(g.edges.map((e) => `${e.from}|${e.to}|${e.label}`))
      return {
        nodes: [...g.nodes, ...sub.nodes.filter((n) => !ids.has(n.id))],
        edges: [...g.edges, ...sub.edges.filter((e) => !keys.has(`${e.from}|${e.to}|${e.label}`))],
      }
    }))
  }

  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader title="Knowledge graph"
        lead="Every ward, facility, population group, document section and alert is a node. Select a node to see its data; double-click it to load its neighbours." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <label htmlFor="focus" className="label">Focus on</label>
            <select id="focus" className="input w-auto min-w-[220px]" value={focus}
              onChange={(e) => go('graph', e.target.value ? { ward: e.target.value } : undefined)}>
              <option value="">Sample of the whole graph</option>
              {wards.data?.map((w) => <option key={w.ward_id} value={w.ward_id}>Ward {w.ward_id}: {w.ward_name}</option>)}
            </select>
            {graph && <span className="text-sm text-muted">{graph.nodes.length} nodes, {graph.edges.length} relationships shown</span>}
          </div>
          {graph ? (
            <GraphView graph={graph} onSelect={setSelected} onExpand={expand} className="h-[min(70dvh,680px)] min-h-[420px]"
              label={`Knowledge graph view with ${graph.nodes.length} nodes`} />
          ) : <Loading className="h-[60dvh]" label="Laying out the graph…" />}
        </div>

        <div className="space-y-5">
          {graph && (
            <section className="card p-5">
              <label htmlFor="inspect" className="label">Inspect a node</label>
              <select id="inspect" className="input mt-2" value={selected?.id ?? ''}
                onChange={(e) => setSelected(graph.nodes.find((n) => n.id === e.target.value) ?? null)}>
                <option value="">Choose from the {graph.nodes.length} nodes shown</option>
                {[...graph.nodes].sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)).map((n) => (
                  <option key={n.id} value={n.id}>{LABEL_STYLE[n.group]?.name ?? n.group}: {n.group === 'Ward' ? `Ward ${n.properties.ward_id}` : n.label}</option>
                ))}
              </select>
            </section>
          )}
          <section className="card p-5" aria-live="polite">
            {selected ? <NodePanel node={selected} onExpand={() => expand(selected.id)} /> :
              <p className="text-sm text-muted">Select a node in the graph, or choose one above, to see its properties.</p>}
          </section>

          <section className="card p-5" aria-labelledby="legend">
            <h2 id="legend" className="text-base">Node types</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {Object.entries(schema.data?.nodes_by_label ?? {}).map(([label, n]) => (
                <li key={label} className="flex items-center gap-3">
                  <span aria-hidden className="size-3 rounded-full" style={{ background: label === 'Ward' ? riskColor('High') : `rgb(var(${LABEL_STYLE[label]?.color}))` }} />
                  <span className="flex-1">{LABEL_STYLE[label]?.name ?? label}{label === 'Ward' && <span className="text-muted"> (coloured by risk)</span>}</span>
                  <span className="text-muted">{n.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
            <h2 className="mt-5 text-base">Relationships</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {Object.entries(schema.data?.relationships_by_type ?? {}).map(([r, n]) => (
                <li key={r} className="flex justify-between gap-3"><code className="code px-1.5">{r}</code><span className="text-muted">{n.toLocaleString('en-IN')}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function NodePanel({ node, onExpand }: { node: VisNode; onExpand: () => void }) {
  const entries = Object.entries(node.properties).filter(([k, v]) => !HIDDEN_PROPS.has(k) && v !== null && typeof v !== 'object')
  return (
    <div>
      <p className="text-sm text-muted">{LABEL_STYLE[node.group]?.name ?? node.group}</p>
      <h2 className="text-lg break-words">{node.label}</h2>
      {typeof node.properties.text === 'string' && <p className="mt-2 text-sm">{String(node.properties.text).slice(0, 400)}</p>}
      <dl className="mt-3 max-h-[300px] space-y-1.5 overflow-y-auto overscroll-contain text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <dt className="truncate text-muted" title={k}>{k}</dt><dd className="break-words font-medium">{fmt(v)}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn-secondary mt-4 w-full" onClick={onExpand}>Load neighbours</button>
    </div>
  )
}
