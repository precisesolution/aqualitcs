import { useState } from 'react';
import {
  Loader2,
  Mailbox,
  CalendarPlus,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import type { Contact, ReplyClassification, UpdateKind } from '../types';
import { useSettings } from '../data/settings';
import { useStore } from '../data/store';
import { classifyReply, pickMeetingTime } from '../lib/anthropic';
import {
  createCalendarEvent,
  getFreeBusy,
  getThread,
  isTokenValid,
  parseMessage,
} from '../lib/google';

interface Props {
  contact: Contact;
}

const INTENT_STYLES: Record<string, string> = {
  yes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  no: 'bg-red-50 text-red-700 border-red-200',
  reschedule: 'bg-amber-50 text-amber-700 border-amber-200',
  redirect: 'bg-violet-50 text-violet-700 border-violet-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  unclear: 'bg-ink-100 text-ink-600 border-ink-200',
};

export function EmailAgentPanel({ contact }: Props) {
  const { settings } = useSettings();
  const { addUpdate, patch } = useStore();
  const [busy, setBusy] = useState<'idle' | 'checking' | 'classifying' | 'scheduling'>('idle');
  const [error, setError] = useState('');
  const [latestReply, setLatestReply] = useState<{
    body: string;
    date: string;
    classification?: ReplyClassification;
  } | null>(null);
  const [eventInfo, setEventInfo] = useState<{ link: string; meet?: string; start: string } | null>(null);

  const tokenValid = isTokenValid(settings.googleAccessTokenExpiry);
  const hasThread = !!contact.thread?.threadId;

  if (!hasThread) {
    return (
      <section>
        <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2 flex items-center gap-2">
          <Mailbox className="w-3.5 h-3.5" /> Agent loop
        </h3>
        <p className="text-xs text-ink-500 italic">
          No outreach sent yet. Use "Draft email with AI" above. Once you send via Gmail, this
          panel checks for replies, classifies them, and schedules a Meet.
        </p>
      </section>
    );
  }

  if (!tokenValid) {
    return (
      <section>
        <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2 flex items-center gap-2">
          <Mailbox className="w-3.5 h-3.5" /> Agent loop
        </h3>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          Google session expired. Open Settings → Sign in with Google again to check replies and schedule Meets.
        </p>
      </section>
    );
  }

  async function checkInbox() {
    if (!settings.googleAccessToken || !contact.thread) return;
    setBusy('checking');
    setError('');
    try {
      const thread = await getThread(settings.googleAccessToken, contact.thread.threadId);
      const msgs = thread.messages ?? [];
      // Find latest message NOT from us
      const meEmail = (settings.fromEmail || settings.googleEmail || '').toLowerCase();
      const reply = [...msgs]
        .reverse()
        .map((m) => parseMessage(m, meEmail))
        .find((m) => !m.isFromMe);
      if (!reply || !reply.body) {
        const note = `[${new Date().toLocaleString()}] No reply yet on this thread.`;
        addUpdate(contact.id, 'system' as UpdateKind, note);
        patch(contact.id, {
          thread: { ...contact.thread, lastChecked: new Date().toISOString() },
        });
        setLatestReply(null);
        setBusy('idle');
        return;
      }

      setLatestReply({ body: reply.body, date: reply.date });
      setBusy('classifying');

      // Classify
      const draftHistoryEntry = (contact.updates ?? []).find((u) => u.kind === 'email');
      const myDraft = draftHistoryEntry?.text ?? '';
      const subjectMatch = myDraft.match(/Subject:\s*(.+)/);
      const mySubject = subjectMatch ? subjectMatch[1].trim() : contact.thread.subject;
      const myBody = myDraft.replace(/^\[.*?\]\s*\n?Subject:\s*.+\n+/s, '').trim();

      const classification = await classifyReply(
        {
          contactName: contact.name,
          contactTitle: contact.title,
          whyFit: contact.whyFit,
          myDraftSubject: mySubject,
          myDraftBody: myBody || 'Initial outreach.',
          reply: reply.body,
        },
        settings
      );

      setLatestReply({ body: reply.body, date: reply.date, classification });

      const replySummary = `[Reply received ${new Date().toLocaleString()}]\nIntent: ${classification.intent.toUpperCase()}\n${classification.summary}\n\nNext: ${classification.suggestedAction}\n\n--- Reply text ---\n${reply.body}`;

      addUpdate(contact.id, 'reply', replySummary);

      const newStatus =
        classification.intent === 'yes'
          ? 'Scheduling'
          : classification.intent === 'no'
          ? 'No-go'
          : classification.intent === 'reschedule' || classification.intent === 'info'
          ? 'Replied'
          : 'Replied';

      patch(contact.id, {
        status: newStatus,
        lastTouch: new Date().toISOString().slice(0, 10),
        thread: {
          ...contact.thread,
          lastChecked: new Date().toISOString(),
          lastReplyAt: reply.date,
          replyClassification: classification,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy((s) => (s === 'idle' ? s : 'idle'));
    }
  }

  async function scheduleMeet() {
    if (!settings.googleAccessToken || !contact.email) return;
    if (!latestReply?.classification) return;
    setBusy('scheduling');
    setError('');
    try {
      const tz =
        settings.meetTimezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'America/Chicago';
      const duration = settings.meetDurationMinutes ?? 25;
      // Search 14 days starting tomorrow
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(8, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 14);

      const { busy: busySlots } = await getFreeBusy({
        accessToken: settings.googleAccessToken,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        timezone: tz,
      });

      const slot = await pickMeetingTime(
        {
          proposedTimes: latestReply.classification.proposedTimes ?? [],
          busySlots,
          durationMinutes: duration,
          searchStartISO: start.toISOString(),
          searchEndISO: end.toISOString(),
          timezone: tz,
        },
        settings
      );

      const summary = `Aqualytics × ${contact.name}`;
      const description = `Discovery conversation between ${contact.name} and Philipp Grötsch (Aqualytics).\n\nWhy this conversation: ${contact.whyFit}\n\nAqualytics — water-quality monitoring consultancy. Continuous instrument at ~10% of existing pricing.\nDeck: aqualytics.eco`;

      const event = await createCalendarEvent({
        accessToken: settings.googleAccessToken,
        summary,
        description,
        attendeeEmails: [contact.email],
        startISO: slot.startISO,
        endISO: slot.endISO,
        timezone: tz,
        withMeet: true,
        sendUpdates: 'all',
      });

      const meetLink =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;

      patch(contact.id, {
        status: 'Scheduled',
        lastTouch: new Date().toISOString().slice(0, 10),
        meeting: {
          date: slot.startISO.slice(0, 10),
          start: new Date(slot.startISO).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          end: new Date(slot.endISO).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          link: meetLink,
        },
      });

      const detail = `[Meet scheduled ${new Date().toLocaleString()}]\nWhen: ${new Date(
        slot.startISO
      ).toLocaleString('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })} (${tz})\nReason: ${slot.reasoning}\nMeet: ${meetLink ?? '(no Meet link returned)'}\nEvent: ${event.htmlLink}`;
      addUpdate(contact.id, 'meeting', detail);

      setEventInfo({
        link: event.htmlLink,
        meet: meetLink,
        start: slot.startISO,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Mailbox className="w-3.5 h-3.5" /> Agent loop
        </span>
        {contact.thread?.lastChecked && (
          <span className="text-[10px] text-ink-400 normal-case font-normal tracking-normal">
            checked {new Date(contact.thread.lastChecked).toLocaleString()}
          </span>
        )}
      </h3>

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={checkInbox}
            disabled={busy !== 'idle'}
            className="btn-outline text-xs disabled:opacity-50"
          >
            {(busy === 'checking' || busy === 'classifying') && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {busy === 'idle' && <RotateCw className="w-3.5 h-3.5" />}
            {busy === 'checking' && 'Reading inbox…'}
            {busy === 'classifying' && 'Classifying…'}
            {busy === 'scheduling' && 'Scheduling…'}
            {busy === 'idle' && 'Check for reply'}
          </button>
          {contact.thread?.replyClassification && !latestReply && (
            <span className="text-[11px] text-ink-500">
              Last:{' '}
              <span
                className={`pill ${INTENT_STYLES[contact.thread.replyClassification.intent]}`}
              >
                {contact.thread.replyClassification.intent}
              </span>
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-2 py-1.5 text-[11px] flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {latestReply?.classification && (
          <div className="card p-3 border-wave-200 bg-wave-50/30">
            <div className="flex items-center justify-between">
              <span
                className={`pill ${INTENT_STYLES[latestReply.classification.intent]}`}
              >
                {latestReply.classification.intent.toUpperCase()}
              </span>
              <span className="text-[10px] text-ink-400">{latestReply.date}</span>
            </div>
            <p className="text-[13px] text-ink-800 mt-1.5 leading-snug">
              {latestReply.classification.summary}
            </p>
            <p className="text-[12px] text-ink-600 mt-1 italic">
              → {latestReply.classification.suggestedAction}
            </p>
            {latestReply.classification.proposedTimes &&
              latestReply.classification.proposedTimes.length > 0 && (
                <div className="mt-2 text-[11px] text-ink-700">
                  <span className="text-ink-500">Proposed times:</span>{' '}
                  {latestReply.classification.proposedTimes.join(' / ')}
                </div>
              )}

            {latestReply.classification.intent === 'yes' && !eventInfo && (
              <button
                onClick={scheduleMeet}
                disabled={busy !== 'idle' || !contact.email}
                className="btn-primary mt-3 w-full disabled:opacity-50"
              >
                {busy === 'scheduling' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CalendarPlus className="w-4 h-4" />
                )}
                {busy === 'scheduling' ? 'Picking time + creating Meet…' : 'Schedule Google Meet'}
              </button>
            )}
          </div>
        )}

        {eventInfo && (
          <div className="card p-3 border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-[13px] font-medium text-emerald-800">
                Meet scheduled — invite sent
              </span>
            </div>
            <p className="text-[12px] text-ink-700 mt-1">
              {new Date(eventInfo.start).toLocaleString()}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[12px]">
              {eventInfo.meet && (
                <a
                  href={eventInfo.meet}
                  target="_blank"
                  rel="noreferrer"
                  className="text-wave-700 hover:underline inline-flex items-center gap-1"
                >
                  Meet <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <a
                href={eventInfo.link}
                target="_blank"
                rel="noreferrer"
                className="text-wave-700 hover:underline inline-flex items-center gap-1"
              >
                Calendar event <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
