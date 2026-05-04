import type { EmailDraft } from '../types';

export interface ComposeArgs {
  to?: string;
  draft: EmailDraft;
  fromAccount?: string;
}

export function gmailComposeUrl({ to, draft, fromAccount }: ComposeArgs): string {
  const params = new URLSearchParams();
  params.set('view', 'cm');
  params.set('fs', '1');
  if (to) params.set('to', to);
  params.set('su', draft.subject);
  params.set('body', draft.body);
  const authuser = fromAccount ? `&authuser=${encodeURIComponent(fromAccount)}` : '';
  return `https://mail.google.com/mail/?${params.toString()}${authuser}`;
}

export function mailtoUrl({ to, draft }: ComposeArgs): string {
  const params = new URLSearchParams();
  params.set('subject', draft.subject);
  params.set('body', draft.body);
  return `mailto:${to ?? ''}?${params.toString()}`;
}

/**
 * Build a Google Calendar "create event" deep-link URL.
 * Opens Calendar's event-edit screen pre-filled. User clicks Save → invite goes out.
 * Works with no OAuth needed — just uses the Calendar web UI under their signed-in
 * Google session.
 *
 * To add a Meet link: user clicks "Add Google Meet video conferencing" in the
 * pre-filled form (or Calendar adds one automatically when guests are invited).
 */
export interface CalendarEventDeepLinkArgs {
  title: string;
  startISO: string;
  endISO: string;
  description?: string;
  attendeeEmails?: string[];
  location?: string;
}

function isoToCalParam(iso: string): string {
  // Calendar wants YYYYMMDDTHHMMSSZ in UTC
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export function googleCalendarEventEditUrl(args: CalendarEventDeepLinkArgs): string {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', args.title);
  params.set('dates', `${isoToCalParam(args.startISO)}/${isoToCalParam(args.endISO)}`);
  if (args.description) params.set('details', args.description);
  if (args.attendeeEmails && args.attendeeEmails.length > 0) {
    params.set('add', args.attendeeEmails.join(','));
  }
  if (args.location) params.set('location', args.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
