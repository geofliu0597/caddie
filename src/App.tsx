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
      <div className="mx-auto min-h-dvh w-full max-w-md pb-20">
        <main className="px-4 pt-4">
          {tab === 'play' && <PlayScreen />}
          {tab === 'arsenal' && <ArsenalScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-turf-700 bg-turf-900/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-md pb-[env(safe-area-inset-bottom)]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-sm font-semibold ${
                  tab === t.id ? 'text-lime-300' : 'text-turf-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </AppProvider>
  );
}
