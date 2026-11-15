import {
  BookOpen, ChevronLeft, ChevronRight, Database, FileText, House, ListOrdered, Map, Menu, MessageSquareText, Moon,
  Network, Presentation, SquareTerminal, Sun, X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { PAGES, useApp, type Page } from '../lib/app'
import type { Status } from '../lib/types'

export const NAV: { page: Page; label: string; icon: typeof House }[] = [
  { page: 'overview', label: 'Overview', icon: House },
  { page: 'map', label: 'Map', icon: Map },
  { page: 'wards', label: 'Ward rankings', icon: ListOrdered },
  { page: 'ask', label: 'Ask the graph', icon: MessageSquareText },
  { page: 'graph', label: 'Knowledge graph', icon: Network },
  { page: 'query', label: 'Query lab', icon: SquareTerminal },
  { page: 'documents', label: 'Documents', icon: FileText },
  { page: 'data', label: 'Data & method', icon: Database },
]

export function Shell({ children }: { children: ReactNode }) {
  const { route, go, theme, toggleTheme, presenting, setPresenting } = useApp()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    api.overview().then((o) => setStatus(o.status)).catch(() => setStatus(null))
  }, [])
  useEffect(() => setOpen(false), [route.page])

  // Drawer: move focus in on open, keep Tab inside, Escape closes, focus returns to the menu button.
  const menuBtn = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) (drawer.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? drawer.current?.querySelector<HTMLElement>('a, button'))?.focus()
    else if (wasOpen.current) menuBtn.current?.focus()
    wasOpen.current = open
  }, [open])
  const trapKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key !== 'Tab' || !drawer.current) return
    const items = [...drawer.current.querySelectorAll<HTMLElement>('a[href], button:not([tabindex="-1"])')].filter((x) => x.offsetParent)
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const current = NAV.find((n) => n.page === route.page)!

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ page, label, icon: Icon }) => {
        const active = route.page === page
        return (
          <a key={page} href={`#/${page}`} aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] items-center gap-3 rounded px-3 text-[0.9375rem] transition-colors duration-150 ${
              active ? 'bg-accent-soft font-semibold text-ink' : 'text-muted hover:bg-sunken hover:text-ink'}`}>
            <Icon aria-hidden className={`size-[18px] shrink-0 ${active ? 'text-accent' : ''}`} strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </a>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[2000] btn-primary">Skip to content</a>

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto">{nav}</div>
        <SystemStatus status={status} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div ref={drawer} onKeyDown={trapKeys} className="fixed inset-0 z-[1500] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[min(300px,85vw)] flex-col overflow-y-auto overscroll-contain bg-surface px-3 py-5">
            <div className="flex items-center justify-between"><Brand />
              <button type="button" className="btn-ghost px-2" aria-label="Close navigation" onClick={() => setOpen(false)}><X className="size-5" /></button>
            </div>
            <div className="mt-6 flex-1">{nav}</div>
            <SystemStatus status={status} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-[1000] flex h-16 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:px-8">
          <button ref={menuBtn} type="button" className="btn-ghost -ms-2 px-2 lg:hidden" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>
          <p className="truncate font-display text-lg font-semibold">{current.label}</p>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" className="btn-ghost px-3" onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
            <button type="button" className={presenting ? 'btn-primary' : 'btn-secondary'} aria-pressed={presenting}
              aria-label="Presentation mode" onClick={() => setPresenting(!presenting)}>
              <Presentation aria-hidden className="size-[18px]" />
              <span className="hidden sm:inline">{presenting ? 'Exit presentation' : 'Present'}</span>
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className={`mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 md:px-8 md:py-8 ${presenting ? 'pb-40' : ''}`}>
          {children}
        </main>
        {presenting && <Tour page={route.page} go={go} onClose={() => setPresenting(false)} />}
      </div>
    </div>
  )
}

function Brand() {
  return (
    <a href="#/overview" className="flex items-center gap-3 rounded px-2 py-1">
      <img src="/favicon.svg" alt="" className="size-9" />
      <span className="leading-tight">
        <span className="block font-display text-[1.0625rem] font-bold tracking-tight">HeatShield</span>
        <span className="block text-xs text-muted">Mumbai heat vulnerability</span>
      </span>
    </a>
  )
}

function SystemStatus({ status }: { status: Status | null }) {
  if (!status) return null
  const rows = [
    { ok: true, label: 'Graph', value: status.neo4j_connected ? 'Neo4j' : 'In-memory' },
    { ok: status.llm_available, label: 'AI answers', value: status.llm_available ? (status.llm_model ?? 'On') : 'Off (rules)' },
    { ok: true, label: 'Search', value: status.search_method.startsWith('neural') ? 'Embeddings' : 'BM25 + LSA' },
  ]
  return (
    <a href="#/data" className="mt-4 block rounded border border-line p-3 text-xs hover:bg-sunken">
      <p className="mb-2 font-medium text-ink">System</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-muted">{r.label}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-ink">
              <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${r.ok ? 'bg-risk-low' : 'bg-muted'}`} />
              <span className="truncate" title={r.value}>{r.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* Presentation tour: one talking point per page, for the viva.        */
/* ------------------------------------------------------------------ */
const TALKING_POINTS: Record<Page, { title: string; say: string }> = {
  overview: { title: 'The problem', say: 'Mumbai’s heat risk is uneven. We rank all 24 BMC wards using Census 2011, OpenStreetMap facilities and heat estimates, joined in one knowledge graph.' },
  map: { title: 'Where the risk is', say: 'These are the real BMC ward boundaries. Switch the colouring to show which ingredient drives risk: heat, slums, density or hospital access.' },
  wards: { title: 'How the score works', say: 'HVI = exposure + sensitivity + lack of adaptive capacity. Move the sliders: the ranking recalculates live, and arrows show which wards moved.' },
  ask: { title: 'GraphRAG in action', say: 'A question is linked to wards, matched to policy text, turned into a Cypher query, run on the graph, and answered with citations. Every step is shown.' },
  graph: { title: 'The knowledge graph', say: 'Wards, facilities, population groups, documents and alerts are nodes. Relationships like LOCATED_IN, ADJACENT_TO and MENTIONS connect data with policy text.' },
  query: { title: 'Querying the graph directly', say: 'The same graph answers raw Cypher. It is read-only: write commands like CREATE or DELETE are blocked before they run.' },
  documents: { title: 'Retrieval', say: 'Hybrid search combines BM25 keyword ranking with semantic vectors, merged by reciprocal rank fusion. The IMD checker applies the official coastal heatwave rules.' },
  data: { title: 'Being honest about the data', say: 'Every dataset is labelled: real, calculated, estimate or illustrative. Surface temperatures are estimates, which is the main limitation and the next step.' },
}

function Tour({ page, go, onClose }: { page: Page; go: (p: Page) => void; onClose: () => void }) {
  const i = PAGES.indexOf(page)
  const tp = TALKING_POINTS[page]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight' && i < PAGES.length - 1) go(PAGES[i + 1])
      if (e.key === 'ArrowLeft' && i > 0) go(PAGES[i - 1])
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go, onClose])

  return (
    <aside aria-label="Presentation notes" className="fixed inset-x-0 bottom-0 z-[1200] border-t border-line bg-surface/95 backdrop-blur lg:start-[var(--sidebar-w)]">
      <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-4 py-4 md:px-8">
        <BookOpen aria-hidden className="hidden size-5 shrink-0 text-accent sm:block" />
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-sm text-muted">Step {i + 1} of {PAGES.length}: <span className="font-semibold text-ink">{tp.title}</span></p>
          <p className="mt-0.5 max-w-[90ch] text-[0.9375rem]">{tp.say}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-secondary px-3" disabled={i === 0} onClick={() => go(PAGES[i - 1])} aria-label="Previous step">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className="btn-primary px-3" disabled={i === PAGES.length - 1} onClick={() => go(PAGES[i + 1])} aria-label="Next step">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
