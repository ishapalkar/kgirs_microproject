import { Shell } from './components/Shell'
import { AppProvider, useApp } from './lib/app'
import { AskPage } from './pages/AskPage'
import { DataPage } from './pages/DataPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { GraphPage } from './pages/GraphPage'
import { MapPage } from './pages/MapPage'
import { OverviewPage } from './pages/Overview'
import { QueryPage } from './pages/QueryPage'
import { WardsPage } from './pages/WardsPage'

function Router() {
  const { route } = useApp()
  switch (route.page) {
    case 'map': return <MapPage />
    case 'wards': return <WardsPage />
    case 'ask': return <AskPage />
    case 'graph': return <GraphPage />
    case 'query': return <QueryPage />
    case 'documents': return <DocumentsPage />
    case 'data': return <DataPage />
    default: return <OverviewPage />
  }
}

export default function App() {
  return (
    <AppProvider>
      <Shell><Router /></Shell>
    </AppProvider>
  )
}
