import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Settings } from '../types';

const KEY = 'aqualitcs:settings:v1';

const DEFAULT: Settings = {
  apiKey: '',
  model: 'claude-opus-4-7',
  userName: '',
  userSignature: '',
  voiceSamples: '',
  fromEmail: '',
};

function load(): Settings {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT;
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  clear: () => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => load());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      update(patch) {
        setSettings((s) => ({ ...s, ...patch }));
      },
      clear() {
        if (typeof window !== 'undefined') localStorage.removeItem(KEY);
        setSettings(DEFAULT);
      },
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const MODEL_OPTIONS = [
  { id: 'claude-opus-4-7', label: 'Opus 4.7 — best quality (default)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — ~5x cheaper, very good' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fastest, cheapest' },
];
