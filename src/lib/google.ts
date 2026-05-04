// Google Identity Services + Gmail + Calendar wrapper.
// All browser-side. Uses GIS tokenClient (popup) to get access tokens.
// Tokens expire in ~1h; we don't store refresh tokens (would need a backend).

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
  'profile',
].join(' ');

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
  prompt?: '' | 'none' | 'consent';
  hint?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
  error?: string;
}

let gisLoaded: Promise<void> | null = null;
function ensureGisLoaded(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Not in a browser'));
      return;
    }
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS script failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GIS script failed to load'));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

export async function signInWithGoogle(
  clientId: string,
  hint?: string
): Promise<TokenResponse> {
  await ensureGisLoaded();
  if (!window.google) throw new Error('Google Identity Services not available');
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else resolve(resp);
      },
      error_callback: (err) =>
        reject(new Error(err.message || err.type || 'OAuth error')),
      hint,
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export function signOutGoogle(token?: string): Promise<void> {
  return new Promise((resolve) => {
    if (!token || !window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    window.google.accounts.oauth2.revoke(token, () => resolve());
  });
}

// ----- Gmail -----

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRfc2822({
  from,
  to,
  subject,
  body,
  inReplyTo,
  references,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  // Encode subject as utf-8 b-encoded if it contains non-ASCII
  const subjectHeader = /[^\x20-\x7e]/.test(subject)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
    : subject;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectHeader}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push('', body);
  return lines.join('\r\n');
}

export interface SendArgs {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}

export interface SendResult {
  id: string;
  threadId: string;
  labelIds?: string[];
  messageIdHeader?: string;
}

export async function sendGmailMessage(args: SendArgs): Promise<SendResult> {
  const raw = buildRfc2822({
    from: args.from,
    to: args.to,
    subject: args.subject,
    body: args.body,
    inReplyTo: args.inReplyTo,
    references: args.inReplyTo,
  });
  const encoded = base64UrlEncode(new TextEncoder().encode(raw));
  const payload: Record<string, string> = { raw: encoded };
  if (args.threadId) payload.threadId = args.threadId;
  const resp = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail send failed: ${resp.status} ${text.slice(0, 300)}`);
  }
  const data = (await resp.json()) as SendResult;
  // Fetch the message we just sent to grab its Message-Id header (for threading)
  try {
    const msg = await getMessage(args.accessToken, data.id, ['Message-Id']);
    const header = msg.payload?.headers?.find(
      (h) => h.name.toLowerCase() === 'message-id'
    );
    if (header) data.messageIdHeader = header.value;
  } catch {
    // non-fatal
  }
  return data;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayload;
}

interface GmailPayload {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { size: number; data?: string };
  parts?: GmailPayload[];
}

interface GmailThread {
  id: string;
  historyId?: string;
  messages?: GmailMessage[];
}

export async function getMessage(
  accessToken: string,
  id: string,
  metadataHeaders?: string[]
): Promise<GmailMessage> {
  const params = new URLSearchParams({ format: metadataHeaders ? 'metadata' : 'full' });
  if (metadataHeaders) {
    for (const h of metadataHeaders) params.append('metadataHeaders', h);
  }
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) throw new Error(`Gmail getMessage failed: ${resp.status}`);
  return (await resp.json()) as GmailMessage;
}

export async function getThread(accessToken: string, threadId: string): Promise<GmailThread> {
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) throw new Error(`Gmail getThread failed: ${resp.status}`);
  return (await resp.json()) as GmailThread;
}

function decodeBase64Url(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
  try {
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return atob(padded);
  }
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  isFromMe: boolean;
}

function findHeader(
  headers: { name: string; value: string }[] | undefined,
  name: string
): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function extractBody(payload: GmailPayload | undefined): string {
  if (!payload) return '';
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.parts) {
    const text = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (text?.body?.data) return decodeBase64Url(text.body.data);
    const html = payload.parts.find((p) => p.mimeType === 'text/html');
    if (html?.body?.data) return decodeBase64Url(html.body.data).replace(/<[^>]+>/g, '');
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

export function parseMessage(msg: GmailMessage, myEmail: string): ParsedMessage {
  const from = findHeader(msg.payload?.headers, 'From') ?? '';
  const to = findHeader(msg.payload?.headers, 'To') ?? '';
  const date = findHeader(msg.payload?.headers, 'Date') ?? '';
  const subject = findHeader(msg.payload?.headers, 'Subject') ?? '';
  const body = extractBody(msg.payload).trim();
  const isFromMe =
    !!myEmail && from.toLowerCase().includes(myEmail.toLowerCase());
  return {
    id: msg.id,
    threadId: msg.threadId,
    from,
    to,
    date,
    subject,
    body,
    isFromMe,
  };
}

// ----- Calendar -----

export interface CalendarFreeBusyArgs {
  accessToken: string;
  timeMin: string;
  timeMax: string;
  timezone?: string;
}

export async function getFreeBusy(args: CalendarFreeBusyArgs): Promise<{
  busy: { start: string; end: string }[];
}> {
  const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      timeZone: args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      items: [{ id: 'primary' }],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`freeBusy failed: ${resp.status} ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    calendars: Record<string, { busy: { start: string; end: string }[] }>;
  };
  return { busy: data.calendars.primary?.busy ?? [] };
}

export interface CreateEventArgs {
  accessToken: string;
  summary: string;
  description?: string;
  attendeeEmails: string[];
  startISO: string;
  endISO: string;
  timezone?: string;
  withMeet?: boolean;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export interface CalendarEvent {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  summary?: string;
  description?: string;
  attendees?: { email: string; responseStatus?: string }[];
}

export async function createCalendarEvent(args: CreateEventArgs): Promise<CalendarEvent> {
  const conferenceVersion = args.withMeet === false ? 0 : 1;
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('conferenceDataVersion', String(conferenceVersion));
  url.searchParams.set('sendUpdates', args.sendUpdates ?? 'all');

  const tz = args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body: Record<string, unknown> = {
    summary: args.summary,
    description: args.description,
    start: { dateTime: args.startISO, timeZone: tz },
    end: { dateTime: args.endISO, timeZone: tz },
    attendees: args.attendeeEmails.map((email) => ({ email })),
  };
  if (args.withMeet !== false) {
    body.conferenceData = {
      createRequest: {
        requestId: `aqualitcs-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`createCalendarEvent failed: ${resp.status} ${text.slice(0, 300)}`);
  }
  return (await resp.json()) as CalendarEvent;
}

export async function listUpcomingEvents(
  accessToken: string,
  timeMinISO: string,
  timeMaxISO: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) throw new Error(`listEvents failed: ${resp.status}`);
  const data = (await resp.json()) as { items?: CalendarEvent[] };
  return data.items ?? [];
}

// ----- Token validity helper -----

export function isTokenValid(expiry: number | undefined): boolean {
  if (!expiry) return false;
  return Date.now() < expiry - 30_000; // 30s safety margin
}

export interface UserInfo {
  email: string;
  name?: string;
  picture?: string;
}

export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`userinfo failed: ${resp.status}`);
  return (await resp.json()) as UserInfo;
}
