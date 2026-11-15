import { useEffect, useRef } from 'react'
import { DataSet, Network } from 'vis-network/standalone'
import { useApp } from '../lib/app'
import { cssColor, riskColor } from '../lib/format'
import type { Category, Subgraph, VisNode } from '../lib/types'

/** One colour + shape per node label. Wards use their risk colour so meaning carries over from the map. */
export const LABEL_STYLE: Record<string, { color: string; shape: string; name: string }> = {
  Ward: { color: '', shape: 'hexagon', name: 'Ward' },
  Hospital: { color: '--cat-hospital', shape: 'dot', name: 'Hospital' },
  Park: { color: '--cat-park', shape: 'dot', name: 'Park' },
  WaterPoint: { color: '--cat-water', shape: 'dot', name: 'Water point' },
  CoolingCentre: { color: '--cat-cooling', shape: 'diamond', name: 'Cooling shelter' },
  Locality: { color: '--cat-hotspot', shape: 'triangle', name: 'Heat hotspot' },
  PopulationGroup: { color: '--cat-population', shape: 'square', name: 'Population group' },
  Document: { color: '--cat-document', shape: 'box', name: 'Document' },
  Section: { color: '--cat-section', shape: 'dot', name: 'Document section' },
  HeatAdvisory: { color: '--cat-alert', shape: 'star', name: 'Heat alert' },
  Organization: { color: '--cat-document', shape: 'ellipse', name: 'Organisation' },
}

interface Props {
  graph: Subgraph
  highlight?: string[]
  onSelect?: (node: VisNode | null) => void
  onExpand?: (id: string) => void
  className?: string
  label: string
}

export function GraphView({ graph, highlight = [], onSelect, onExpand, className = '', label }: Props) {
  const { theme } = useApp()
  const el = useRef<HTMLDivElement>(null)
  const net = useRef<Network | null>(null)
  const cb = useRef({ onSelect, onExpand })
  cb.current = { onSelect, onExpand }

  useEffect(() => {
    if (!el.current) return
    const hl = new Set(highlight)
    const ink = cssColor('--ink')
    const muted = cssColor('--muted')
    const surface = cssColor('--surface')
    const dim = highlight.length > 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const nodes = new DataSet(graph.nodes.map((n) => {
      const st = LABEL_STYLE[n.group] ?? LABEL_STYLE.Section
      const color = n.group === 'Ward' ? riskColor((n.properties.vulnerability_category as Category) ?? 'Low') : cssColor(st.color)
      const isHl = hl.has(n.id)
      const faded = dim && !isHl
      return {
        id: n.id,
        label: n.group === 'Ward' ? `Ward ${n.properties.ward_id}` : truncate(n.label, 26),
        title: `${st.name}: ${n.label}`,
        shape: st.shape,
        size: n.group === 'Ward' ? 22 : n.group === 'Document' ? 14 : 10,
        color: { background: color, border: isHl ? ink : surface, highlight: { background: color, border: ink } },
        borderWidth: isHl ? 3 : 1,
        opacity: faded ? 0.35 : 1,
        font: { color: faded ? muted : ink, size: n.group === 'Ward' ? 15 : 12, face: 'Public Sans Variable',
          strokeWidth: 3, strokeColor: surface },
      }
    }))
    const edges = new DataSet(graph.edges.map((e, i) => ({
      id: `${e.from}->${e.to}-${i}`, from: e.from, to: e.to,
      title: e.label,
      label: graph.edges.length < 60 ? e.label : undefined,
      arrows: { to: { enabled: true, scaleFactor: 0.4 } },
      color: { color: dim && !(hl.has(e.from) && hl.has(e.to)) ? cssColor('--line') : cssColor('--line-strong'), highlight: ink },
      font: { size: 9, color: muted, strokeWidth: 3, strokeColor: surface, face: 'Public Sans Variable' },
      width: dim && hl.has(e.from) && hl.has(e.to) ? 2 : 1,
      smooth: false,
    })))

    const network = new Network(el.current, { nodes, edges }, {
      autoResize: true,
      interaction: { hover: true, tooltipDelay: 120, keyboard: { enabled: true, bindToWindow: false }, navigationButtons: false },
      physics: reduce
        ? { enabled: true, stabilization: { iterations: 400, fit: true }, solver: 'forceAtlas2Based', timestep: 1 }
        : { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -45, springLength: 90, avoidOverlap: 0.4 }, stabilization: { iterations: 250 } },
      layout: { improvedLayout: graph.nodes.length < 150 },
    })
    network.once('stabilizationIterationsDone', () => {
      if (reduce) network.setOptions({ physics: false })
      network.fit({ animation: reduce ? false : { duration: 300, easingFunction: 'easeOutQuad' } })
    })
    network.on('click', (p) => {
      const id = p.nodes[0] as string | undefined
      cb.current.onSelect?.(id ? graph.nodes.find((n) => n.id === id) ?? null : null)
    })
    network.on('doubleClick', (p) => {
      const id = p.nodes[0] as string | undefined
      if (id) cb.current.onExpand?.(id)
    })
    net.current = network
    return () => { network.destroy(); net.current = null }
  }, [graph, highlight, theme])

  return <div ref={el} role="img" aria-label={label} className={className} />
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
