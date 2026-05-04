import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  X,
  Calendar as CalendarIcon,
  Trash2,
  Plus,
  Copy,
  Sparkles,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import type { Owner, Status, UpdateKind } from '../types';
import { STATUS_OPTIONS, UPDATE_KINDS, useStore } from '../data/store';
import { FitBadge, StatusBadge } from './Badges';
import { DraftEmailModal } from './DraftEmailModal';
import { EmailAgentPanel } from './EmailAgentPanel';

const OWNERS: Owner[] = ['Me', 'Collaborator', 'Unassigned'];

const KIND_STYLES: Record<UpdateKind, string> = {
  'walk-in': 'bg-wave-50 text-wave-700 border-wave-200',
  email: 'bg-violet-50 text-violet-700 border-violet-200',
  'email-draft': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  reply: 'bg-sky-50 text-sky-700 border-sky-200',
  meeting: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  note: 'bg-ink-50 text-ink-600 border-ink-200',
  system: 'bg-ink-50 text-ink-400 border-ink-200',
};

interface Props {
  contactId: string | null;
  onClose: () => void;
}

export function ContactDrawer({ contactId, onClose }: Props) {
  const { contacts, patch, addUpdate, removeUpdate } = useStore();
  const contact = contactId ? contacts.find((c) => c.id === contactId) : null;
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [updateText, setUpdateText] = useState('');
  const [updateKind, setUpdateKind] = useState<UpdateKind>('walk-in');

  useEffect(() => {
    if (contact) {
      setMeetingDate(contact.meeting?.date ?? '');
      setMeetingStart(contact.meeting?.start ?? '');
      setMeetingEnd(contact.meeting?.end ?? '');
      setMeetingLink(contact.meeting?.link ?? '');
      setUpdateText('');
      setUpdateKind('walk-in');
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

  function submitUpdate() {
    if (!contact) return;
    if (!updateText.trim()) return;
    addUpdate(contact.id, updateKind, updateText);
    setUpdateText('');
  }

  const updates = contact.updates ?? [];
  const [draftOpen, setDraftOpen] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 bg-ink-950/30 z-40"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside className="fixed right-0 top-0 bottom-0 w-[560px] bg-white z-50 shadow-2xl border-l border-ink-200 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg leading-tight">{contact.name}</h2>
              <p className="text-sm text-ink-500 mt-0.5">{contact.title}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <FitBadge fit={contact.fit} />
                <StatusBadge status={contact.status} />
                <span className="pill bg-ink-50 text-ink-600 border-ink-200">{contact.department}</span>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setDraftOpen(true)}
            className="btn-primary w-full mt-3"
          >
            <Sparkles className="w-4 h-4" /> Draft email with AI
          </button>
        </div>

        <div className="p-6 space-y-7">
          <Section step={1} title="Who they are">
            <div className="space-y-1.5 text-sm">
              {contact.email && (
                <Row icon={<Mail className="w-4 h-4 text-ink-400" />}>
                  <a href={`mailto:${contact.email}`} className="text-wave-700 hover:underline">
                    {contact.email}
                  </a>
                  {contact.emailVerified ? (
                    <span className="text-[11px] text-emerald-600 ml-2">verified</span>
                  ) : (
                    <span className="text-[11px] text-amber-600 ml-2">unverified</span>
                  )}
                </Row>
              )}
              {contact.phone && (
                <Row icon={<Phone className="w-4 h-4 text-ink-400" />}>
                  <a href={`tel:${contact.phone}`} className="text-ink-800">
                    {contact.phone}
                  </a>
                </Row>
              )}
              {contact.officeLocation && (
                <Row icon={<MapPin className="w-4 h-4 text-ink-400" />}>
                  <span className="text-ink-800 font-medium">{contact.officeLocation}</span>
                </Row>
              )}
              {contact.officeHours && (
                <p className="text-ink-600 text-[13px] pl-6">{contact.officeHours}</p>
              )}
              {contact.source && (
                <a
                  href={contact.source}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-wave-700 pl-6"
                >
                  <ExternalLink className="w-3 h-3" /> Source / profile
                </a>
              )}
            </div>
          </Section>

          {contact.papers && contact.papers.length > 0 && (
            <Section step={2} title="What they've done">
              <ul className="space-y-2.5">
                {contact.papers.map((p, i) => (
                  <li
                    key={i}
                    className="text-sm text-ink-800 leading-snug border-l-2 border-ink-100 pl-3"
                  >
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
            </Section>
          )}

          <Section step={3} title="How it helps Aqualytics">
            <p className="text-sm text-ink-800 leading-relaxed bg-wave-50/60 border border-wave-100 rounded-lg p-3">
              {contact.whyFit}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {contact.angles.map((a) => (
                <span key={a} className="pill bg-wave-50 text-wave-700 border-wave-200">
                  {a}
                </span>
              ))}
            </div>
          </Section>

          <EmailAgentPanel contact={contact} />

          {(contact.talkingPoints?.length || contact.opener) && (
            <Section step={4} title="What to talk about">
              {contact.talkingPoints && contact.talkingPoints.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {contact.talkingPoints.map((tp, i) => (
                    <li key={i} className="text-sm text-ink-800 leading-relaxed flex gap-2">
                      <span className="text-wave-500 font-bold mt-0.5">→</span>
                      <span>{tp}</span>
                    </li>
                  ))}
                </ul>
              )}
              {contact.opener && (
                <details className="group">
                  <summary className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold cursor-pointer flex items-center justify-between hover:text-ink-700">
                    <span>30-sec opener (read verbatim)</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(contact.opener!);
                      }}
                      className="btn-outline py-0.5 px-2 text-[11px] font-normal"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </summary>
                  <blockquote className="mt-2 text-sm text-ink-800 italic border-l-2 border-wave-300 pl-3 leading-relaxed">
                    {contact.opener}
                  </blockquote>
                </details>
              )}
            </Section>
          )}

          <Section step={5} title="Updates over time">
            <div className="card p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {UPDATE_KINDS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setUpdateKind(k)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border capitalize transition ${
                      updateKind === k
                        ? KIND_STYLES[k] + ' ring-1 ring-offset-1 ring-wave-300'
                        : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <textarea
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitUpdate();
                }}
                rows={2}
                placeholder="What happened? (⌘/Ctrl-Enter to save)"
                className="input text-[13px]"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-ink-400">
                  {updateText.length > 0 ? `${updateText.length} chars` : ''}
                </span>
                <button
                  onClick={submitUpdate}
                  disabled={!updateText.trim()}
                  className="btn-primary py-1 px-2.5 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" /> Add update
                </button>
              </div>
            </div>

            {updates.length === 0 ? (
              <p className="text-xs text-ink-400 italic px-1">No updates yet — log the first one above.</p>
            ) : (
              <ol className="space-y-3">
                {updates.map((u) => (
                  <li key={u.id} className="flex gap-3">
                    <div className="flex flex-col items-center mt-1">
                      <span className={`pill text-[10px] capitalize ${KIND_STYLES[u.kind]}`}>
                        {u.kind}
                      </span>
                      <div className="w-px flex-1 bg-ink-100 mt-1.5" />
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-baseline gap-2">
                        <time className="text-[11px] font-medium text-ink-700 tabular-nums">
                          {format(parseISO(u.timestamp), 'MMM d, h:mm a')}
                        </time>
                        <span className="text-[10px] text-ink-400">
                          {formatDistanceToNow(parseISO(u.timestamp), { addSuffix: true })}
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('Delete this update?')) removeUpdate(contact.id, u.id);
                          }}
                          className="ml-auto text-ink-300 hover:text-red-600"
                          aria-label="Delete update"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[13px] text-ink-800 leading-relaxed mt-1 whitespace-pre-wrap">
                        {u.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <hr className="border-ink-100" />

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
            <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
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
                Last touch: {format(parseISO(contact.lastTouch), 'MMM d, yyyy')}
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
        </div>
      </aside>
      {draftOpen && <DraftEmailModal contact={contact} onClose={() => setDraftOpen(false)} />}
    </>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2.5 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-ink-900 text-white text-[10px] flex items-center justify-center tabular-nums">
          {step}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="flex-1">{children}</span>
    </div>
  );
}
