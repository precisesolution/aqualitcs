import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Droplets, FileText, Layers, ListTodo, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { useStore } from '../data/store';

const NAV = [
  { to: '/today', label: 'Today', icon: ListTodo },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/contacts', label: 'Contacts', icon: Layers },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Layout() {
  const { contacts, reset } = useStore();
  const counts = {
    total: contacts.length,
    met: contacts.filter((c) => c.status === 'Met').length,
    scheduled: contacts.filter((c) => c.status === 'Scheduled').length,
    inFlight: contacts.filter((c) =>
      ['Emailed', 'Replied', 'Scheduling', 'Walk-in planned'].includes(c.status)
    ).length,
  };
  return (
    <div className="flex h-full">
      <aside className="w-64 bg-ink-950 text-white flex flex-col">
        <div className="px-4 py-5 flex items-center gap-2 border-b border-ink-800">
          <div className="w-8 h-8 rounded-lg bg-wave-500 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-none">Aqualitcs</div>
            <div className="text-[11px] text-ink-400 mt-1">Northwestern outreach</div>
          </div>
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-3 border-t border-ink-800 text-[12px] text-ink-300">
          <div className="px-2 py-1.5 flex items-center justify-between">
            <span>Met</span>
            <span className="text-white font-medium tabular-nums">
              {counts.met}/{counts.total}
            </span>
          </div>
          <div className="px-2 py-1.5 flex items-center justify-between">
            <span>Scheduled</span>
            <span className="text-white font-medium tabular-nums">{counts.scheduled}</span>
          </div>
          <div className="px-2 py-1.5 flex items-center justify-between">
            <span>In flight</span>
            <span className="text-white font-medium tabular-nums">{counts.inFlight}</span>
          </div>
          <button
            onClick={() => {
              if (confirm('Reset all status/notes back to seed defaults?')) reset();
            }}
            className="mt-2 w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-ink-800 text-ink-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to seed
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
