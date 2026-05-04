import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Contact, ContactPatch, Status } from '../types';
import { SEED_CONTACTS } from './seed';

const STORAGE_KEY = 'aqualitcs:contacts:v1';

function load(): Contact[] {
  if (typeof window === 'undefined') return SEED_CONTACTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_CONTACTS;
    const stored = JSON.parse(raw) as Contact[];
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
      };
    });
  } catch {
    return SEED_CONTACTS;
  }
}

function persist(contacts: Contact[]) {
  if (typeof window === 'undefined') return;
  const slim = contacts.map(({ id, status, owner, notes, lastTouch, meeting }) => ({
    id,
    status,
    owner,
    notes,
    lastTouch,
    meeting,
  })) as Contact[];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

interface StoreValue {
  contacts: Contact[];
  patch: (id: string, patch: ContactPatch) => void;
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
                }
              : c
          )
        );
      },
      reset() {
        localStorage.removeItem(STORAGE_KEY);
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
