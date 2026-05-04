import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../data/store';
import { ContactDrawer } from '../components/ContactDrawer';
import { FitBadge, StatusBadge } from '../components/Badges';
import type { Contact, Department, Fit, Status } from '../types';

const ALL_FITS: Fit[] = ['HIGH', 'MED', 'LOW'];
const ALL_DEPTS: Department[] = [
  'CEE', 'EEPS', 'ChBE', 'Chemistry', 'MechE', 'CS',
  'Anthropology', 'SESP', 'Kellogg', 'Pritzker Law',
  'Trienens/ISEN', 'NU Water', 'NAISE/Argonne', 'Other',
];
const ALL_STATUSES: Status[] = [
  'To contact', 'Walk-in planned', 'Emailed', 'Replied',
  'Scheduling', 'Scheduled', 'Met', 'No-go',
];

export function Contacts() {
  const { contacts } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [fitFilter, setFitFilter] = useState<Set<Fit>>(new Set());
  const [deptFilter, setDeptFilter] = useState<Set<Department>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set());

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return contacts.filter((c) => {
      if (fitFilter.size && !fitFilter.has(c.fit)) return false;
      if (deptFilter.size && !deptFilter.has(c.department)) return false;
      if (statusFilter.size && !statusFilter.has(c.status)) return false;
      if (!query) return true;
      const blob = [c.name, c.title, c.whyFit, c.notes ?? '', c.angles.join(' ')]
        .join(' ')
        .toLowerCase();
      return blob.includes(query);
    });
  }, [contacts, q, fitFilter, deptFilter, statusFilter]);

  function toggle<T>(set: Set<T>, val: T, setSet: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setSet(next);
  }

  return (
    <div className="px-8 py-7">
      <header className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-ink-950">Contacts</h1>
          <p className="text-sm text-ink-500 mt-1">
            {filtered.length} of {contacts.length}
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, research, notes…"
            className="input pl-9 w-80"
          />
        </div>
      </header>

      <FilterRow label="Fit">
        {ALL_FITS.map((f) => (
          <FilterChip
            key={f}
            active={fitFilter.has(f)}
            onClick={() => toggle(fitFilter, f, setFitFilter)}
          >
            {f}
          </FilterChip>
        ))}
      </FilterRow>
      <FilterRow label="Status">
        {ALL_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={statusFilter.has(s)}
            onClick={() => toggle(statusFilter, s, setStatusFilter)}
          >
            {s}
          </FilterChip>
        ))}
      </FilterRow>
      <FilterRow label="Dept">
        {ALL_DEPTS.map((d) => (
          <FilterChip
            key={d}
            active={deptFilter.has(d)}
            onClick={() => toggle(deptFilter, d, setDeptFilter)}
          >
            {d}
          </FilterChip>
        ))}
      </FilterRow>

      <div className="mt-5 card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Name</th>
              <th className="text-left px-3 py-2 font-semibold">Dept</th>
              <th className="text-left px-3 py-2 font-semibold">Fit</th>
              <th className="text-left px-3 py-2 font-semibold">Status</th>
              <th className="text-left px-3 py-2 font-semibold">Office</th>
              <th className="text-left px-3 py-2 font-semibold">Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <Row key={c.id} contact={c} onClick={() => setOpenId(c.id)} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-400">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ContactDrawer contactId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[11px] uppercase tracking-wide text-ink-500 w-12">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        active
          ? 'bg-ink-900 text-white border-ink-900'
          : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-ink-100 last:border-b-0 hover:bg-wave-50/40 cursor-pointer"
    >
      <td className="px-4 py-2.5">
        <div className="font-medium text-ink-950">{contact.name}</div>
        <div className="text-[12px] text-ink-500 truncate max-w-md">{contact.title}</div>
      </td>
      <td className="px-3 py-2.5 text-ink-700">{contact.department}</td>
      <td className="px-3 py-2.5">
        <FitBadge fit={contact.fit} />
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={contact.status} />
      </td>
      <td className="px-3 py-2.5 text-ink-700 text-[12px]">{contact.officeLocation ?? '—'}</td>
      <td className="px-3 py-2.5 text-ink-700">{contact.owner}</td>
    </tr>
  );
}
