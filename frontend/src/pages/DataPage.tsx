import { DataTag, ErrorState, Loading, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { int } from '../lib/format'
import { useApi } from '../lib/useApi'

const NAMES: Record<string, string> = {
  exposure: 'Exposure: how much heat the ward gets',
  sensitivity: 'Sensitivity: how easily residents are harmed',
  adaptive_capacity: 'Adaptive capacity: how much help is nearby',
}

export function DataPage() {
  const prov = useApi(api.provenance)
  const method = useApi(api.method)
  const ov = useApi(api.overview)

  if (prov.error) return <ErrorState message={prov.error} onRetry={prov.reload} />
  if (!prov.data || !method.data) return <Loading />
  const p = prov.data
  const m = method.data
  const s = ov.data?.status

  return (
    <div className="space-y-10">
      <PageHeader title="Data & method"
        lead="Where every number comes from, how the vulnerability index is calculated, and what the project cannot claim." />

      <section aria-labelledby="sources">
        <h2 id="sources" className="text-lg">Sources</h2>
        <div className="mt-4 card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className="table-head px-4 py-3">Data</th>
                <th scope="col" className="table-head px-4 py-3">Status</th>
                <th scope="col" className="table-head px-4 py-3">Source and caveats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.entries(p.fields).map(([k, f]) => (
                <tr key={k} className="align-top">
                  <td className="px-4 py-3 font-medium">{k}</td>
                  <td className="px-4 py-3"><DataTag status={f.status} /></td>
                  <td className="px-4 py-3">
                    <p>{f.source}</p>
                    {f.caveat && <p className="mt-1 text-muted">{f.caveat}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(p.statuses).map(([k, v]) => (
            <div key={k}><dt><DataTag status={k} /></dt><dd className="mt-1 text-muted">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted">
          {int(p.counts.facilities_total)} facilities are inside BMC limits. {int(p.counts.osm_points_outside_bmc_dropped)} OpenStreetMap
          points fell outside every ward polygon (Thane, Navi Mumbai) and were dropped.
        </p>
      </section>

      <section aria-labelledby="hvi">
        <h2 id="hvi" className="text-lg">Heat vulnerability index</h2>
        <p className="mt-3 inline-block rounded bg-sunken px-4 py-3 font-display text-lg font-semibold">{m.formula}</p>
        <p className="mt-3 max-w-[70ch] text-muted">
          Default weights: exposure {m.default_weights.weight_exposure}, sensitivity {m.default_weights.weight_sensitivity},
          capacity {m.default_weights.weight_adaptive_capacity}. {m.note}
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {(Object.keys(m.components) as (keyof typeof m.components)[]).map((k) => (
            <div key={k} className="card p-5">
              <h3 className="text-base">{NAMES[k]}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {m.components[k].map((c) => (
                  <li key={c.key} className="flex justify-between gap-3"><span>{c.label}</span><span className="font-medium">{Math.round(c.weight * 100)}%</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Categories: {m.thresholds.map((t) => `${t.label} from ${t.min.toFixed(2)}`).join(', ')}.
        </p>
      </section>

      <section aria-labelledby="limits" className="max-w-[75ch]">
        <h2 id="limits" className="text-lg">Limitations</h2>
        <ul className="mt-3 list-disc space-y-2 ps-5 marker:text-muted">
          <li>Surface temperatures and vegetation (NDVI) are representative estimates, not processed satellite images. Replacing them with Landsat zonal statistics is the most important next step.</li>
          <li>Census 2011 is the latest ward-level census; populations have grown since.</li>
          <li>OpenStreetMap is volunteer-mapped. Drinking-water points are sparse, and “hospital” includes small nursing homes and clinics.</li>
          <li>Cooling shelters are illustrative examples; there is no public official list in the dataset.</li>
          <li>The index ranks wards against each other. It is a planning tool, not a prediction of individual health risk.</li>
        </ul>
      </section>

      {s && (
        <section aria-labelledby="system">
          <h2 id="system" className="text-lg">System status</h2>
          <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-3">
            <div className="card p-4">
              <dt className="text-muted">Graph database</dt>
              <dd className="mt-1 font-medium">{s.graph_engine}</dd>
              {!s.neo4j_connected && <dd className="mt-1 text-muted">Neo4j not running. Start it and restart the backend to use it.</dd>}
            </div>
            <div className="card p-4">
              <dt className="text-muted">AI answers</dt>
              <dd className="mt-1 font-medium">{s.llm_available ? `${s.llm_provider}: ${s.llm_model}` : 'Off, using rule-based answers'}</dd>
              {!s.llm_available && <dd className="mt-1 text-muted">Add GEMINI_API_KEY to .env to turn on LLM-written Cypher and answers.</dd>}
            </div>
            <div className="card p-4">
              <dt className="text-muted">Document search</dt>
              <dd className="mt-1 font-medium">BM25 + {s.search_method}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  )
}
