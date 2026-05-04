import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import type { Contact, EmailDraft } from '../types';
import { useSettings } from '../data/settings';
import { useStore } from '../data/store';
import { draftEmail } from '../lib/anthropic';
import { gmailComposeUrl, mailtoUrl } from '../lib/gmail';

interface Props {
  contact: Contact | null;
  onClose: () => void;
}

const KIND_BADGE: Record<string, string> = {
  loading: 'bg-wave-50 text-wave-700 border-wave-200',
  ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
};

export function DraftEmailModal({ contact, onClose }: Props) {
  const { settings } = useSettings();
  const { addUpdate, patch } = useStore();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [draft, setDraft] = useState<EmailDraft>({ subject: '', body: '' });
  const [extra, setExtra] = useState('');

  useEffect(() => {
    if (contact) {
      setDraft({ subject: '', body: '' });
      setExtra('');
      setError('');
      setStatus('idle');
    }
  }, [contact?.id]);

  if (!contact) return null;

  async function generate() {
    if (!contact) return;
    if (!settings.apiKey) {
      setError('No API key. Open Settings and add your Anthropic API key.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const result = await draftEmail(contact, settings, extra);
      setDraft(result);
      setStatus('ready');
      addUpdate(
        contact.id,
        'email-draft',
        `[AI draft]\nSubject: ${result.subject}\n\n${result.body}`
      );
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function markSent(via: 'gmail' | 'mailto' | 'manual') {
    if (!contact) return;
    const today = new Date().toISOString().slice(0, 10);
    addUpdate(
      contact.id,
      'email',
      `[Sent via ${via}]\nSubject: ${draft.subject}\n\n${draft.body}`
    );
    patch(contact.id, { status: 'Emailed', lastTouch: today });
  }

  function openGmail() {
    if (!draft.subject || !draft.body) return;
    const url = gmailComposeUrl({
      to: contact?.email,
      draft,
      fromAccount: settings.fromEmail || undefined,
    });
    markSent('gmail');
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openMailto() {
    if (!draft.subject || !draft.body) return;
    markSent('mailto');
    window.location.href = mailtoUrl({ to: contact?.email, draft });
  }

  function copyAll() {
    if (!draft.subject || !draft.body) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-ink-950/40 z-[60]"
        onClick={onClose}
        aria-label="Close draft"
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-h-[90vh] bg-white z-[70] rounded-xl shadow-2xl border border-ink-200 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-ink-100 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-wave-600" /> Draft email
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              To <span className="font-medium text-ink-800">{contact.name}</span>
              {contact.email && <span className="text-ink-500"> · {contact.email}</span>}
              <span className="text-ink-400"> · model: {settings.model}</span>
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!draft.subject && status !== 'loading' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                  Optional extra context
                </span>
                <textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  rows={3}
                  placeholder="Anything specific to mention? (warm intro, mutual contact, today's seminar, etc.) — optional"
                  className="input mt-1 text-[13px]"
                />
              </label>
              <button
                onClick={generate}
                disabled={!settings.apiKey}
                className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                {settings.apiKey ? 'Generate draft' : 'Add API key in Settings first'}
              </button>
              {!settings.apiKey && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Open <strong>Settings</strong> in the sidebar and paste your Anthropic API key.
                  Get one at{' '}
                  <a
                    className="underline"
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    console.anthropic.com
                  </a>
                  .
                </p>
              )}
            </div>
          )}

          {status === 'loading' && (
            <div className="py-12 flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-wave-500 animate-spin" />
              <p className="text-sm text-ink-500">
                {settings.model} is writing — usually 5-15 seconds…
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className={`pill ${KIND_BADGE.error} block px-3 py-2 text-[12px]`}>
              {error}
            </div>
          )}

          {(status === 'ready' || draft.subject) && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                  Subject
                </span>
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="input mt-1"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                  Body
                </span>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={12}
                  className="input mt-1 text-[13px] leading-relaxed"
                />
              </label>
              <p className="text-[11px] text-ink-400">
                Edit anything before sending. Replace any {`[bracketed]`} placeholders with the right
                values.
              </p>
            </div>
          )}
        </div>

        {(status === 'ready' || draft.subject) && (
          <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/50 flex items-center gap-2 flex-wrap">
            <button onClick={generate} className="btn-ghost text-xs" title="Generate again">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <button onClick={copyAll} className="btn-outline text-xs">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <div className="flex-1" />
            <button onClick={openMailto} className="btn-outline text-xs">
              <ExternalLink className="w-3.5 h-3.5" /> Mail app
            </button>
            <button onClick={openGmail} className="btn-primary">
              <ExternalLink className="w-4 h-4" /> Open in Gmail
            </button>
          </div>
        )}
      </div>
    </>
  );
}
