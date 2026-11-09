import { useState } from 'react';
import { AppProvider } from './lib/store';
import { PlayScreen } from './components/PlayScreen';
import { ArsenalScreen } from './components/ArsenalScreen';
import { SettingsScreen } from './components/SettingsScreen';

type Tab = 'play' | 'arsenal' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'arsenal', label: 'Arsenal' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('play');
  return (
    <AppProvider>
      <div className="mx-auto min-h-dvh w-full max-w-md">
        <header className="sticky top-0 z-40 border-b border-turf-700/60 bg-turf-900/95 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <span className="text-lg font-bold text-turf-50">Caddie</span>
            <nav className="flex rounded-xl bg-turf-800 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    tab === t.id ? 'bg-lime-400 text-turf-950' : 'text-turf-300 active:bg-turf-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </header>
        <main className="px-4 pb-10 pt-4">
          {tab === 'play' && <PlayScreen />}
          {tab === 'arsenal' && <ArsenalScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
    </AppProvider>
  );
}
