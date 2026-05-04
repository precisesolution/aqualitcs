import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Contact, ContactPatch, Status, UpdateEntry, UpdateKind } from '../types';
import { SEED_CONTACTS } from './seed';

const STORAGE_KEY = 'aqualitcs:contacts:v2';
const LEGACY_KEY_V1 = 'aqualitcs:contacts:v1';

interface PersistedContact {
  id: string;
  status?: Status;
  owner?: Contact['owner'];
  notes?: string;
  lastTouch?: string;
  meeting?: Contact['meeting'];
  updates?: UpdateEntry[];
}

function migrateV1(stored: PersistedContact[]): PersistedContact[] {
  return stored.map((c) => {
    if (c.updates && c.updates.length > 0) return c;
    if (!c.notes) return c;
    const ts = c.lastTouch ? `${c.lastTouch}T12:00:00.000Z` : new Date().toISOString();
    return {
      ...c,
      updates: [
        {
          id: `migrated-${c.id}-${ts}`,
          timestamp: ts,
          kind: 'note' as UpdateKind,
          text: c.notes,
        },
      ],
    };
  });
}

function load(): Contact[] {
  if (typeof window === 'undefined') return SEED_CONTACTS;
  try {
    let stored: PersistedContact[] | null = null;
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) {
      stored = JSON.parse(v2) as PersistedContact[];
    } else {
      const v1 = localStorage.getItem(LEGACY_KEY_V1);
      if (v1) stored = migrateV1(JSON.parse(v1) as PersistedContact[]);
    }
    if (!stored) return SEED_CONTACTS;
    const byId = new Map(stored.map((c) => [c.id, c]));
    return SEED_CONTACTS.map((seed) => {
      const persisted = byId.get(seed.id);
      if (!persisted) return seed;
      return {
        ...seed,
        status: persisted.status ?? seed.status,
        owner: persisted.owner ?? seed.owner,
        notes: persisted.notes ?? seed.notes,
        lastTouch: persisted.lastTouch ?? seed.lastTouch,
        meeting: persisted.meeting ?? seed.meeting,
        updates: persisted.updates ?? seed.updates,
      };
    });
  } catch {
    return SEED_CONTACTS;
  }
}

function persist(contacts: Contact[]) {
  if (typeof window === 'undefined') return;
  const slim: PersistedContact[] = contacts.map(({ id, status, owner, notes, lastTouch, meeting, updates }) => ({
    id,
    status,
    owner,
    notes,
    lastTouch,
    meeting,
    updates,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

interface StoreValue {
  contacts: Contact[];
  patch: (id: string, patch: ContactPatch) => void;
  addUpdate: (id: string, kind: UpdateKind, text: string) => void;
  removeUpdate: (id: string, updateId: string) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useContacts() {
  return useStore().contacts;
}

export function useContact(id: string): Contact | undefined {
  return useStore().contacts.find((c) => c.id === id);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(() => load());

  useEffect(() => {
    persist(contacts);
  }, [contacts]);

  const value = useMemo<StoreValue>(
    () => ({
      contacts,
      patch(id, p) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: p.status ?? c.status,
                  owner: p.owner ?? c.owner,
                  notes: p.notes !== undefined ? p.notes : c.notes,
                  lastTouch: p.lastTouch ?? c.lastTouch,
                  meeting: p.meeting === null ? undefined : p.meeting ?? c.meeting,
                  updates: p.updates ?? c.updates,
                }
              : c
          )
        );
      },
      addUpdate(id, kind, text) {
        const trimmed = text.trim();
        if (!trimmed) return;
        const entry: UpdateEntry = {
          id: `${id}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          kind,
          text: trimmed,
        };
        const today = new Date().toISOString().slice(0, 10);
        setContacts((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, updates: [entry, ...(c.updates ?? [])], lastTouch: today }
              : c
          )
        );
      },
      removeUpdate(id, updateId) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, updates: (c.updates ?? []).filter((u) => u.id !== updateId) }
              : c
          )
        );
      },
      reset() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_KEY_V1);
        setContacts(SEED_CONTACTS);
      },
    }),
    [contacts]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const STATUS_OPTIONS: Status[] = [
  'To contact',
  'Walk-in planned',
  'Emailed',
  'Replied',
  'Scheduling',
  'Scheduled',
  'Met',
  'No-go',
];

export const UPDATE_KINDS: UpdateKind[] = ['walk-in', 'email', 'reply', 'meeting', 'note'];
