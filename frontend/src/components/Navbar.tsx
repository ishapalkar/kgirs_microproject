import React from 'react';
import {
  Flame,
  MapPin,
  BarChart3,
  Users,
  Shield,
  Bot,
  Terminal,
  Network,
  FileText
} from 'lucide-react';

export type TabType =
  | 'map'
  | 'vulnerability'
  | 'demographics'
  | 'facilities'
  | 'graphrag'
  | 'cypher'
  | 'graph'
  | 'evidence';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  neo4jStatus?: { connected: boolean; mode: string };
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, neo4jStatus }) => {
  const tabs = [
    { id: 'map', label: 'Heat Hotspots', icon: MapPin },
    { id: 'vulnerability', label: 'Ward HVI', icon: BarChart3 },
    { id: 'demographics', label: 'Demographics', icon: Users },
    { id: 'facilities', label: 'Shelters & Facilities', icon: Shield },
    { id: 'graphrag', label: 'GraphRAG', icon: Bot },
    { id: 'cypher', label: 'Cypher Lab', icon: Terminal },
    { id: 'graph', label: 'Knowledge Graph', icon: Network },
    { id: 'evidence', label: 'Evidence & IMD', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-[#E8E8EC]">
      <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-8 w-8 rounded-[6px] bg-[#6366F1] flex items-center justify-center text-white shadow-sm">
            <Flame className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-[17px] tracking-tight text-[#0A0A0A]">
              HeatShield <span className="text-[#6366F1]">Mumbai</span>
            </span>
            <span className="hidden sm:inline-block text-[11px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[#F3F4F6] text-[#6B6B6B] border border-[#E8E8EC]">
              GraphRAG v1.0
            </span>
          </div>
        </div>

        {/* Navigation Tabs (14px font size, medium weight) */}
        <nav className="flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as TabType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[6px] transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#6366F1]/10 text-[#6366F1] font-semibold'
                    : 'text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F3F4F6]'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#6366F1]' : 'text-[#9C9C9C]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Engine Status Pill */}
        <div className="hidden lg:flex items-center gap-2 py-1 px-3 rounded-full bg-[#F3F4F6] border border-[#E8E8EC] text-[12px] text-[#6B6B6B]">
          <span
            className={`h-2 w-2 rounded-full ${
              neo4jStatus?.connected ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
            }`}
          />
          <span>{neo4jStatus?.connected ? 'Neo4j Live' : 'Embedded Graph Engine'}</span>
        </div>
      </div>
    </header>
  );
};
