import { useMemo, useState } from 'react';
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../data/store';
import { ContactDrawer } from '../components/ContactDrawer';

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 8am to 7pm
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function CalendarView() {
  const { contacts } = useStore();
  const [anchor, setAnchor] = useState(new Date());
  const [openId, setOpenId] = useState<string | null>(null);

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const events = useMemo(
    () =>
      contacts
        .filter((c) => c.meeting)
        .map((c) => ({
          contact: c,
          date: parseISO(c.meeting!.date),
          startMin: timeToMinutes(c.meeting!.start),
          endMin: timeToMinutes(c.meeting!.end),
        })),
    [contacts]
  );

  const dayWindowStart = HOURS[0] * 60;
  const dayWindowEnd = (HOURS[HOURS.length - 1] + 1) * 60;
  const totalMins = dayWindowEnd - dayWindowStart;

  return (
    <div className="px-8 py-7">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-950">Calendar</h1>
          <p className="text-sm text-ink-500 mt-1">
            Week of {format(weekStart, 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor(subWeeks(anchor, 1))} className="btn-outline">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setAnchor(new Date())} className="btn-outline">
            Today
          </button>
          <button onClick={() => setAnchor(addWeeks(anchor, 1))} className="btn-outline">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ink-100 bg-ink-50">
          <div />
          {days.map((d, i) => {
            const isToday = isSameDay(d, new Date());
            return (
              <div
                key={i}
                className={`px-3 py-2 text-center border-l border-ink-100 ${
                  isToday ? 'bg-wave-50' : ''
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-ink-500">{DAY_LABELS[i]}</div>
                <div
                  className={`text-lg font-semibold tabular-nums ${
                    isToday ? 'text-wave-700' : 'text-ink-900'
                  }`}
                >
                  {format(d, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="h-14 text-[11px] text-ink-400 px-2 pt-1 border-t border-ink-100"
              >
                {h <= 12 ? h : h - 12}
                {h < 12 ? 'a' : 'p'}
              </div>
            ))}
          </div>
          {days.map((d, i) => {
            const dayEvents = events.filter((e) => isSameDay(e.date, d));
            return (
              <div
                key={i}
                className="border-l border-ink-100 relative"
                style={{ height: HOURS.length * 56 }}
              >
                {HOURS.map((h) => (
                  <div key={h} className="h-14 border-t border-ink-100" />
                ))}
                {dayEvents.map((e) => {
                  const top = ((e.startMin - dayWindowStart) / totalMins) * (HOURS.length * 56);
                  const height = ((e.endMin - e.startMin) / totalMins) * (HOURS.length * 56);
                  return (
                    <button
                      key={e.contact.id}
                      onClick={() => setOpenId(e.contact.id)}
                      className="absolute left-1 right-1 rounded-md bg-wave-600 text-white text-left px-2 py-1.5 shadow-sm hover:bg-wave-700"
                      style={{ top, height: Math.max(height, 28) }}
                    >
                      <div className="text-[11px] font-medium truncate">{e.contact.name}</div>
                      <div className="text-[10px] opacity-90">
                        {e.contact.meeting!.start}–{e.contact.meeting!.end}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-500">
        To schedule a meeting: open a contact (Today or Contacts), fill in date/start/end in the Meeting section, click Save.
      </p>

      <ContactDrawer contactId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
