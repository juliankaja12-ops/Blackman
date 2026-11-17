import React from 'react';
import { Home, Maximize2, Minimize2 } from 'lucide-react';
import { AppTab } from '../types/game';

interface TopNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onQuickRace: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'race', label: 'Pista & Gara' },
  { id: 'builder', label: 'Disegna Circuito' },
  { id: 'garage', label: 'Officina & Motore' },
  { id: 'dealership', label: 'Concessionaria' },
  { id: 'marketplace', label: 'Mercato & Online' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  onQuickRace,
  isFullscreen,
  onToggleFullscreen,
}) => {
  return (
    <header className="h-14 shrink-0 border-b border-white/10 bg-[#0d1016] px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8 z-30">
      {/* Zone 1: Brand Wordmark -> Returns to Home */}
      <button
        type="button"
        onClick={() => onSelectTab('home')}
        className="font-display text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e10600]"
        title="Torna alla Home"
      >
        Apex Darwin GP
      </button>

      {/* Zone 2: Clean single-line text nav links */}
      <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e10600] ${
                isActive
                  ? 'border-[#e10600] text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Fullscreen + Return to Home + Quick Race */}
      <div className="shrink-0 flex items-center gap-2">
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-2 rounded-md bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Esci da Schermo Intero' : 'Schermo Intero'}
            aria-label={isFullscreen ? 'Esci da Schermo Intero' : 'Schermo Intero'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
        {activeTab !== 'home' && (
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            title="Torna alla Home"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Torna alla Home</span>
          </button>
        )}
        {activeTab !== 'race' && (
          <button
            type="button"
            onClick={onQuickRace}
            className="px-3.5 sm:px-4 py-2 rounded-md bg-[#e10600] hover:bg-[#ff1e17] text-white text-xs font-semibold tracking-wide whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Scendi in Pista
          </button>
        )}
      </div>
    </header>
  );
};
