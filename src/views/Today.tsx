import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Circle, ChevronRight, MapPin, Clock, Phone, Mail } from 'lucide-react';
import { useStore } from '../data/store';
import { ContactDrawer } from '../components/ContactDrawer';
import { FitBadge, StatusBadge } from '../components/Badges';
import type { Contact } from '../types';

const BLOCKS: Array<{ id: 'afternoon-A' | 'afternoon-F' | 'late' | 'morning'; title: string; subtitle: string }> = [
  { id: 'morning', title: 'Morning', subtitle: 'Email tier — send before lunch' },
  { id: 'afternoon-A', title: 'Tech A wing — CEE corridor', subtitle: 'Walk-in route 1 · ~12:00–3:20 pm' },
  { id: 'afternoon-F', title: 'Tech F wing — DEEPS corridor', subtitle: 'Walk-in route 2 · ~3:25–4:30 pm' },
  { id: 'late', title: 'Late / tomorrow', subtitle: 'Catch them when they\'re actually on campus' },
];

function statusDone(s: Contact['status']) {
  return ['Met', 'Replied', 'Scheduled', 'Scheduling', 'Emailed', 'No-go'].includes(s);
}

export function Today() {
  const { contacts, patch } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  const todayContacts = useMemo(() => contacts.filter((c) => c.walkInDay === 1 || c.fit === 'HIGH'), [contacts]);

  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    BLOCKS.forEach((b) => (map[b.id] = []));
    map['morning'] = todayContacts.filter((c) => !c.walkInTimeBlock && c.fit === 'HIGH');
    todayContacts.forEach((c) => {
      if (c.walkInTimeBlock && map[c.walkInTimeBlock]) map[c.walkInTimeBlock].push(c);
    });
    return map;
  }, [todayContacts]);

  const totalPlanned = todayContacts.length;
  const totalDone = todayContacts.filter((c) => statusDone(c.status)).length;

  return (
    <div className="px-8 py-7 max-w-5xl">
      <header className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-ink-950">Today</h1>
          <p className="text-sm text-ink-500 mt-1">{today}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-ink-950">
            {totalDone}<span className="text-ink-300">/{totalPlanned}</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink-500 mt-1">touched today</div>
        </div>
      </header>

      <div className="space-y-7">
        {BLOCKS.map((block) => {
          const list = grouped[block.id];
          if (!list || list.length === 0) return null;
          return (
            <section key={block.id}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink-900">{block.title}</h2>
                <span className="text-xs text-ink-500">{block.subtitle}</span>
              </div>
              <div className="space-y-2">
                {list.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setOpenId(c.id)}
                    className="card w-full text-left px-4 py-3 flex items-start gap-3 hover:border-wave-300 hover:shadow-md transition"
                  >
                    <div
                      className="mt-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        patch(c.id, {
                          status: statusDone(c.status) ? 'To contact' : 'Met',
                          lastTouch: format(new Date(), 'yyyy-MM-dd'),
                        });
                      }}
                    >
                      {statusDone(c.status) ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-ink-300 hover:text-wave-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-ink-950">{c.name}</span>
                        <FitBadge fit={c.fit} />
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-sm text-ink-500 mt-0.5 truncate">{c.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-600">
                        {c.officeLocation && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {c.officeLocation}
                          </span>
                        )}
                        {c.officeHours && (
                          <span className="inline-flex items-center gap-1 text-ink-500 line-clamp-1">
                            <Clock className="w-3 h-3" /> {c.officeHours}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-500">
                        {c.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </span>
                        )}
                      </div>
                      {c.talkingPoints && c.talkingPoints.length > 0 && (
                        <ul className="mt-2 pl-1 space-y-0.5">
                          {c.talkingPoints.slice(0, 2).map((tp, i) => (
                            <li key={i} className="text-[12px] text-ink-700 flex gap-1.5 leading-snug">
                              <span className="text-wave-500 font-bold">→</span>
                              <span className="line-clamp-1">{tp}</span>
                            </li>
                          ))}
                          {c.talkingPoints.length > 2 && (
                            <li className="text-[11px] text-ink-400 pl-3">
                              +{c.talkingPoints.length - 2} more
                            </li>
                          )}
                        </ul>
                      )}
                      {c.updates && c.updates.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-emerald-700 italic line-clamp-1">
                          Last update: {c.updates[0].text}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-300 mt-1 shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <ContactDrawer contactId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
