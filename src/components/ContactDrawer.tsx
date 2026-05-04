import { useEffect, useState } from 'react';
import { ExternalLink, Mail, MapPin, Phone, X, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Owner, Status } from '../types';
import { STATUS_OPTIONS, useStore } from '../data/store';
import { FitBadge, StatusBadge } from './Badges';

const OWNERS: Owner[] = ['Me', 'Collaborator', 'Unassigned'];

interface Props {
  contactId: string | null;
  onClose: () => void;
}

export function ContactDrawer({ contactId, onClose }: Props) {
  const { contacts, patch } = useStore();
  const contact = contactId ? contacts.find((c) => c.id === contactId) : null;
  const [draftNotes, setDraftNotes] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

  useEffect(() => {
    if (contact) {
      setDraftNotes(contact.notes ?? '');
      setMeetingDate(contact.meeting?.date ?? '');
      setMeetingStart(contact.meeting?.start ?? '');
      setMeetingEnd(contact.meeting?.end ?? '');
      setMeetingLink(contact.meeting?.link ?? '');
    }
  }, [contact?.id]);

  if (!contact) return null;

  const today = format(new Date(), 'yyyy-MM-dd');

  function saveStatus(status: Status) {
    if (!contact) return;
    patch(contact.id, { status, lastTouch: today });
  }

  function saveOwner(owner: Owner) {
    if (!contact) return;
    patch(contact.id, { owner });
  }

  function saveNotes() {
    if (!contact) return;
    patch(contact.id, { notes: draftNotes, lastTouch: today });
  }

  function saveMeeting() {
    if (!contact) return;
    if (!meetingDate || !meetingStart || !meetingEnd) {
      alert('Please fill in date, start, and end.');
      return;
    }
    patch(contact.id, {
      meeting: { date: meetingDate, start: meetingStart, end: meetingEnd, link: meetingLink || undefined },
      status: 'Scheduled',
      lastTouch: today,
    });
  }

  function clearMeeting() {
    if (!contact) return;
    patch(contact.id, { meeting: null });
    setMeetingDate('');
    setMeetingStart('');
    setMeetingEnd('');
    setMeetingLink('');
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-ink-950/30 z-40"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside className="fixed right-0 top-0 bottom-0 w-[520px] bg-white z-50 shadow-2xl border-l border-ink-200 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg leading-tight">{contact.name}</h2>
            <p className="text-sm text-ink-500 mt-0.5">{contact.title}</p>
            <div className="flex items-center gap-2 mt-2">
              <FitBadge fit={contact.fit} />
              <StatusBadge status={contact.status} />
              <span className="pill bg-ink-50 text-ink-600 border-ink-200">{contact.department}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section className="space-y-2 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-ink-400" />
                <a href={`mailto:${contact.email}`} className="text-wave-700 hover:underline">
                  {contact.email}
                </a>
                {contact.emailVerified ? (
                  <span className="text-[11px] text-emerald-600">verified</span>
                ) : (
                  <span className="text-[11px] text-amber-600">unverified</span>
                )}
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-ink-400" />
                <a href={`tel:${contact.phone}`} className="text-ink-800">
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.officeLocation && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-ink-400" />
                <span className="text-ink-800 font-medium">{contact.officeLocation}</span>
              </div>
            )}
            {contact.officeHours && (
              <div className="text-ink-600 text-[13px] pl-6">{contact.officeHours}</div>
            )}
            {contact.source && (
              <a
                href={contact.source}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-wave-700"
              >
                <ExternalLink className="w-3 h-3" /> Source
              </a>
            )}
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">
              Why fit
            </h3>
            <p className="text-sm text-ink-800 leading-relaxed">{contact.whyFit}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {contact.angles.map((a) => (
                <span key={a} className="pill bg-wave-50 text-wave-700 border-wave-200">
                  {a}
                </span>
              ))}
            </div>
          </section>

          {contact.papers && contact.papers.length > 0 && (
            <section>
              <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2">
                Papers to reference
              </h3>
              <ul className="space-y-2">
                {contact.papers.map((p, i) => (
                  <li key={i} className="text-sm text-ink-800 leading-snug">
                    <span className="font-medium">{p.title}</span>{' '}
                    <span className="text-ink-500">
                      — {p.venue}, {p.year}
                    </span>{' '}
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs text-wave-700 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {contact.opener && (
            <section>
              <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2 flex items-center justify-between">
                <span>Opener (read verbatim)</span>
                <button
                  onClick={() => navigator.clipboard.writeText(contact.opener!)}
                  className="btn-outline py-0.5 px-2 text-[11px] font-normal"
                >
                  Copy
                </button>
              </h3>
              <blockquote className="text-sm text-ink-800 italic border-l-2 border-wave-300 pl-3 leading-relaxed">
                {contact.opener}
              </blockquote>
            </section>
          )}

          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2">
              Status
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => saveStatus(s)}
                  className={`text-xs rounded-md border px-2 py-1.5 text-left transition ${
                    contact.status === s
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-ink-500">Owner:</span>
              {OWNERS.map((o) => (
                <button
                  key={o}
                  onClick={() => saveOwner(o)}
                  className={`pill ${
                    contact.owner === o
                      ? 'bg-wave-600 text-white border-wave-600'
                      : 'bg-white text-ink-600 border-ink-200'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            {contact.lastTouch && (
              <div className="mt-2 text-[11px] text-ink-500">
                Last touch: {format(new Date(contact.lastTouch), 'MMM d, yyyy')}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5" /> Meeting
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="input col-span-3" />
              <input type="time" value={meetingStart} onChange={(e) => setMeetingStart(e.target.value)} className="input" />
              <input type="time" value={meetingEnd} onChange={(e) => setMeetingEnd(e.target.value)} className="input" />
              <button onClick={saveMeeting} className="btn-primary">Save</button>
            </div>
            <input
              type="url"
              placeholder="Video link or location (optional)"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              className="input mt-2"
            />
            {contact.meeting && (
              <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                <span>
                  Saved: {contact.meeting.date} {contact.meeting.start}–{contact.meeting.end}
                </span>
                <button onClick={clearMeeting} className="inline-flex items-center gap-1 text-red-600 hover:underline">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2 flex items-center justify-between">
              <span>Notes</span>
              <button onClick={saveNotes} className="btn-primary py-0.5 px-2 text-[11px] font-normal">
                Save
              </button>
            </h3>
            <textarea
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              rows={6}
              placeholder="What did they say? Who did they recommend? Next step?"
              className="input font-mono text-[13px]"
            />
          </section>
        </div>
      </aside>
    </>
  );
}
