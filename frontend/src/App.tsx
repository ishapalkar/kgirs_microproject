import React, { useState, useEffect } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { HeatHotspotMap } from './components/HeatHotspotMap';
import { WardVulnerabilityView } from './components/WardVulnerabilityView';
import { DemographicExposureView } from './components/DemographicExposureView';
import { FacilitiesExplorer } from './components/FacilitiesExplorer';
import { GraphRAGChat } from './components/GraphRAGChat';
import { CypherEditor } from './components/CypherEditor';
import { KnowledgeGraphViewer } from './components/KnowledgeGraphViewer';
import { EvidenceDocumentPanel } from './components/EvidenceDocumentPanel';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [neo4jStatus, setNeo4jStatus] = useState<{ connected: boolean; mode: string }>({
    connected: false,
    mode: 'Embedded Graph Engine',
  });

  useEffect(() => {
    async function checkHealth() {
      try {
        const stats = await api.getGraphStats();
        setNeo4jStatus({
          connected: stats.connected_to_neo4j,
          mode: stats.mode,
        });
      } catch (err) {
        console.warn('Backend not yet reachable:', err);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] flex flex-col font-sans selection:bg-[#6366F1] selection:text-white">
      {/* Sticky Top Navigation (56px, backdrop-blur, 1px bottom border #E8E8EC) */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        neo4jStatus={neo4jStatus}
      />

      {/* Main View Container (Max width 1280px, 24px horizontal padding, section spacing) */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8">
        {activeTab === 'map' && <HeatHotspotMap />}
        {activeTab === 'vulnerability' && <WardVulnerabilityView />}
        {activeTab === 'demographics' && <DemographicExposureView />}
        {activeTab === 'facilities' && <FacilitiesExplorer />}
        {activeTab === 'graphrag' && <GraphRAGChat />}
        {activeTab === 'cypher' && <CypherEditor />}
        {activeTab === 'graph' && <KnowledgeGraphViewer />}
        {activeTab === 'evidence' && <EvidenceDocumentPanel />}
      </main>

      {/* Gallery Frame Footer */}
      <footer className="bg-white border-t border-[#E8E8EC] py-4 text-[13px] text-[#6B6B6B] mt-auto">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-[#0A0A0A]">HeatShield Mumbai</span>
            <span className="text-[#9C9C9C]">•</span>
            <span>GraphRAG Urban Heatwave Vulnerability & Shelter Intelligence</span>
          </div>
          <div className="text-[12px] text-[#9C9C9C]">
            Data: USGS Landsat 8/9 C2 L2 • Copernicus ERA5-Land • WorldPop India • BMC OpenCity • MS-HWAP 2024
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
