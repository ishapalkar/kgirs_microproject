import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Page = 'overview' | 'map' | 'wards' | 'ask' | 'graph' | 'query' | 'documents' | 'data'
export const PAGES: Page[] = ['overview', 'map', 'wards', 'ask', 'graph', 'query', 'documents', 'data']

interface Route { page: Page; params: URLSearchParams }

interface AppState {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  presenting: boolean
  setPresenting: (v: boolean) => void
  route: Route
  go: (page: Page, params?: Record<string, string>) => void
}

const Ctx = createContext<AppState | null>(null)

function parseHash(): Route {
  const [path, query] = window.location.hash.replace(/^#\/?/, '').split('?')
  const page = (PAGES as string[]).includes(path) ? (path as Page) : 'overview'
  return { page, params: new URLSearchParams(query ?? '') }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const [presenting, setPresentingState] = useState(false)
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    root.classList.add('no-transitions')          // switch colours without every transition firing
    root.classList.toggle('dark', next === 'dark')
    void root.offsetHeight
    requestAnimationFrame(() => root.classList.remove('no-transitions'))
    try { localStorage.setItem('hs-theme', next) } catch { /* private mode */ }
    setTheme(next)
  }, [theme])

  const setPresenting = useCallback((v: boolean) => {
    document.documentElement.classList.toggle('present', v)
    setPresentingState(v)
  }, [])

  const go = useCallback((page: Page, params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : ''
    window.location.hash = `/${page}${q}`
    window.scrollTo({ top: 0 })
  }, [])

  const value = useMemo(() => ({ theme, toggleTheme, presenting, setPresenting, route, go }),
    [theme, toggleTheme, presenting, setPresenting, route, go])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside AppProvider')
  return v
}
