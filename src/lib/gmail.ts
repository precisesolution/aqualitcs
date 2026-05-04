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
