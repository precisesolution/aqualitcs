import { useState } from 'react';
import {
  Loader2,
  Mailbox,
  CalendarPlus,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Clipboard,
  Sparkles,
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
import { googleCalendarEventEditUrl } from '../lib/gmail';

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

interface ReplyState {
  body: string;
  date?: string;
  classification?: ReplyClassification;
  source: 'gmail' | 'paste';
}

interface PickedSlotState {
  startISO: string;
  endISO: string;
  reasoning: string;
}

export function EmailAgentPanel({ contact }: Props) {
  const { settings } = useSettings();
  const { addUpdate, patch } = useStore();
  const [busy, setBusy] = useState<'idle' | 'checking' | 'classifying' | 'scheduling' | 'picking'>(
    'idle'
  );
  const [error, setError] = useState('');
  const [latestReply, setLatestReply] = useState<ReplyState | null>(null);
  const [eventInfo, setEventInfo] = useState<{ link: string; meet?: string; start: string } | null>(
    null
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pickedSlot, setPickedSlot] = useState<PickedSlotState | null>(null);

  const tokenValid = isTokenValid(settings.googleAccessTokenExpiry);
  const hasThread = !!contact.thread?.threadId;

  function logReplyToTimeline(classification: ReplyClassification, body: string, source: string) {
    const replySummary = `[Reply received ${new Date().toLocaleString()} via ${source}]\nIntent: ${classification.intent.toUpperCase()}\n${classification.summary}\n\nNext: ${classification.suggestedAction}\n\n--- Reply text ---\n${body}`;
    addUpdate(contact.id, 'reply', replySummary);

    const newStatus =
      classification.intent === 'yes'
        ? 'Scheduling'
        : classification.intent === 'no'
        ? 'No-go'
        : 'Replied';

    patch(contact.id, {
      status: newStatus,
      lastTouch: new Date().toISOString().slice(0, 10),
      thread: contact.thread
        ? {
            ...contact.thread,
            lastChecked: new Date().toISOString(),
            replyClassification: classification,
          }
        : {
            threadId: 'paste-in',
            subject: 'Pasted reply',
            lastChecked: new Date().toISOString(),
            replyClassification: classification,
          },
    });
  }

  async function checkInbox() {
    if (!settings.googleAccessToken || !contact.thread) return;
    setBusy('checking');
    setError('');
    try {
      const thread = await getThread(settings.googleAccessToken, contact.thread.threadId);
      const msgs = thread.messages ?? [];
      const meEmail = (settings.fromEmail || settings.googleEmail || '').toLowerCase();
      const reply = [...msgs]
        .reverse()
        .map((m) => parseMessage(m, meEmail))
        .find((m) => !m.isFromMe);
      if (!reply || !reply.body) {
        addUpdate(
          contact.id,
          'system' as UpdateKind,
          `[${new Date().toLocaleString()}] Inbox check — no reply yet on this thread.`
        );
        patch(contact.id, {
          thread: { ...contact.thread, lastChecked: new Date().toISOString() },
        });
        setLatestReply(null);
        return;
      }

      setLatestReply({ body: reply.body, date: reply.date, source: 'gmail' });
      setBusy('classifying');
      const classification = await runClassify(reply.body);
      setLatestReply((s) => (s ? { ...s, classification } : null));
      logReplyToTimeline(classification, reply.body, 'Gmail API');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  async function runClassify(replyBody: string): Promise<ReplyClassification> {
    const draftHistoryEntry = (contact.updates ?? []).find((u) => u.kind === 'email');
    const myDraft = draftHistoryEntry?.text ?? '';
    const subjectMatch = myDraft.match(/Subject:\s*(.+)/);
    const mySubject = subjectMatch ? subjectMatch[1].trim() : contact.thread?.subject ?? '';
    const myBody = myDraft.replace(/^\[.*?\]\s*\n?Subject:\s*.+\n+/s, '').trim();
    return classifyReply(
      {
        contactName: contact.name,
        contactTitle: contact.title,
        whyFit: contact.whyFit,
        myDraftSubject: mySubject,
        myDraftBody: myBody || 'Initial outreach.',
        reply: replyBody,
      },
      settings
    );
  }

  async function classifyPaste() {
    if (!pasteText.trim()) return;
    setBusy('classifying');
    setError('');
    try {
      setLatestReply({ body: pasteText.trim(), source: 'paste' });
      const classification = await runClassify(pasteText.trim());
      setLatestReply({ body: pasteText.trim(), source: 'paste', classification });
      logReplyToTimeline(classification, pasteText.trim(), 'paste-in');
      setPasteText('');
      setPasteOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  async function pickSlot() {
    if (!latestReply?.classification) return;
    setBusy('picking');
    setError('');
    try {
      const tz =
        settings.meetTimezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'America/Chicago';
      const duration = settings.meetDurationMinutes ?? 25;
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(8, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 14);

      let busySlots: { start: string; end: string }[] = [];
      if (tokenValid && settings.googleAccessToken) {
        try {
          const fb = await getFreeBusy({
            accessToken: settings.googleAccessToken,
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            timezone: tz,
          });
          busySlots = fb.busy;
        } catch {
          // continue without busy data
        }
      }

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
      setPickedSlot(slot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  async function scheduleMeetViaApi() {
    if (!settings.googleAccessToken || !contact.email || !pickedSlot) return;
    setBusy('scheduling');
    setError('');
    try {
      const tz =
        settings.meetTimezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'America/Chicago';

      const summary = `Aqualytics × ${contact.name}`;
      const description = `Discovery conversation with Philipp Grötsch (Aqualytics).\n\nWhy: ${contact.whyFit}\n\nAqualytics — water-quality monitoring consultancy. Continuous instrument at ~10% of existing pricing.\nDeck: aqualytics.eco`;

      const event = await createCalendarEvent({
        accessToken: settings.googleAccessToken,
        summary,
        description,
        attendeeEmails: [contact.email],
        startISO: pickedSlot.startISO,
        endISO: pickedSlot.endISO,
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
          date: pickedSlot.startISO.slice(0, 10),
          start: new Date(pickedSlot.startISO).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          end: new Date(pickedSlot.endISO).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          link: meetLink,
        },
      });

      const detail = `[Meet scheduled ${new Date().toLocaleString()}]\nWhen: ${new Date(
        pickedSlot.startISO
      ).toLocaleString('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })} (${tz})\nReason: ${pickedSlot.reasoning}\nMeet: ${meetLink ?? '(no Meet link returned)'}\nEvent: ${event.htmlLink}`;
      addUpdate(contact.id, 'meeting', detail);

      setEventInfo({
        link: event.htmlLink,
        meet: meetLink,
        start: pickedSlot.startISO,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  function scheduleViaCalendarUrl() {
    if (!pickedSlot || !contact.email) return;
    const url = googleCalendarEventEditUrl({
      title: `Aqualytics × ${contact.name}`,
      startISO: pickedSlot.startISO,
      endISO: pickedSlot.endISO,
      description: `Discovery conversation with Philipp Grötsch (Aqualytics).\n\nWhy: ${contact.whyFit}\n\nAqualytics — water-quality monitoring consultancy. Continuous instrument at ~10% of existing pricing.\nDeck: aqualytics.eco`,
      attendeeEmails: [contact.email],
    });
    // Log as if scheduled — user is one click away
    patch(contact.id, {
      status: 'Scheduling',
      lastTouch: new Date().toISOString().slice(0, 10),
      meeting: {
        date: pickedSlot.startISO.slice(0, 10),
        start: new Date(pickedSlot.startISO).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        end: new Date(pickedSlot.endISO).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      },
    });
    addUpdate(
      contact.id,
      'meeting',
      `[Calendar event opened ${new Date().toLocaleString()}]\nWhen: ${new Date(
        pickedSlot.startISO
      ).toLocaleString()}\nReason: ${pickedSlot.reasoning}\nNext: click "Add Google Meet video conferencing" in the Calendar tab and click Save to send the invite.`
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ---------- render ----------

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
        {/* Reply detection */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasThread && tokenValid && (
            <button
              onClick={checkInbox}
              disabled={busy !== 'idle'}
              className="btn-outline text-xs disabled:opacity-50"
            >
              {(busy === 'checking' || busy === 'classifying') && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {(busy === 'idle' || busy === 'scheduling' || busy === 'picking') && (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              {busy === 'checking' && 'Reading inbox…'}
              {busy === 'classifying' && 'Classifying…'}
              {busy !== 'checking' && busy !== 'classifying' && 'Check inbox for reply'}
            </button>
          )}
          <button
            onClick={() => setPasteOpen((v) => !v)}
            className="btn-outline text-xs"
            title="Paste a reply manually (works without OAuth)"
          >
            <Clipboard className="w-3.5 h-3.5" />
            {pasteOpen ? 'Cancel paste' : 'Paste reply'}
          </button>
          {contact.thread?.replyClassification && !latestReply && (
            <span className="text-[11px] text-ink-500">
              Last:{' '}
              <span className={`pill ${INTENT_STYLES[contact.thread.replyClassification.intent]}`}>
                {contact.thread.replyClassification.intent}
              </span>
            </span>
          )}
        </div>

        {!tokenValid && !hasThread && (
          <p className="text-[11px] text-ink-500 italic">
            Tip: <strong>Paste reply</strong> works without Google OAuth. Copy the reply from your
            Gmail tab, paste it here, and the AI classifies + suggests next step.
          </p>
        )}

        {pasteOpen && (
          <div className="card p-3 space-y-2">
            <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold flex items-center gap-1">
              <Clipboard className="w-3 h-3" /> Paste the reply text
            </span>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder="Paste the body of their reply email here…"
              className="input text-[13px]"
            />
            <button
              onClick={classifyPaste}
              disabled={!pasteText.trim() || busy === 'classifying'}
              className="btn-primary text-xs w-full disabled:opacity-50"
            >
              {busy === 'classifying' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {busy === 'classifying' ? 'Classifying…' : 'Classify with AI'}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-2 py-1.5 text-[11px] flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Classification result */}
        {latestReply?.classification && (
          <div className="card p-3 border-wave-200 bg-wave-50/30">
            <div className="flex items-center justify-between">
              <span className={`pill ${INTENT_STYLES[latestReply.classification.intent]}`}>
                {latestReply.classification.intent.toUpperCase()}
              </span>
              <span className="text-[10px] text-ink-400">
                {latestReply.date || `via ${latestReply.source}`}
              </span>
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

            {(latestReply.classification.intent === 'yes' ||
              latestReply.classification.intent === 'reschedule') &&
              !pickedSlot &&
              !eventInfo && (
                <button
                  onClick={pickSlot}
                  disabled={busy !== 'idle' || !contact.email}
                  className="btn-primary mt-3 w-full disabled:opacity-50"
                >
                  {busy === 'picking' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {busy === 'picking' ? 'Picking time…' : 'AI: pick a meeting time'}
                </button>
              )}
          </div>
        )}

        {pickedSlot && !eventInfo && (
          <div className="card p-3 border-emerald-200 bg-emerald-50/30 space-y-2">
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-emerald-600" />
              <span className="text-[13px] font-medium text-emerald-800">Proposed slot</span>
            </div>
            <p className="text-[13px] text-ink-800">
              {new Date(pickedSlot.startISO).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </p>
            <p className="text-[11px] text-ink-500 italic">{pickedSlot.reasoning}</p>
            <div className="flex gap-2 pt-1">
              {tokenValid ? (
                <button
                  onClick={scheduleMeetViaApi}
                  disabled={busy !== 'idle'}
                  className="btn-primary text-xs flex-1 disabled:opacity-50"
                >
                  {busy === 'scheduling' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CalendarPlus className="w-3.5 h-3.5" />
                  )}
                  {busy === 'scheduling' ? 'Creating…' : 'Create event + send invite'}
                </button>
              ) : (
                <button
                  onClick={scheduleViaCalendarUrl}
                  className="btn-primary text-xs flex-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Google Calendar
                </button>
              )}
              <button
                onClick={() => setPickedSlot(null)}
                className="btn-ghost text-xs"
                title="Pick a different time"
              >
                <RotateCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
            {!tokenValid && (
              <p className="text-[11px] text-ink-500 leading-snug pt-1 border-t border-ink-100">
                Calendar opens with this slot pre-filled. Click "Add Google Meet video conferencing"
                inside Calendar, then Save — the invite goes out.
              </p>
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
