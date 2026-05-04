import Anthropic from '@anthropic-ai/sdk';
import type { Contact, EmailDraft, ReplyClassification, ReplyIntent, Settings } from '../types';

function buildSystemPrompt(settings: Settings): string {
  const userName = settings.userName.trim() || '[Your name]';
  const voiceBlock = settings.voiceSamples.trim()
    ? `\n# User's voice samples (match this tone)\nThe student writing this email tends to write like this — match their cadence, vocabulary, level of warmth, and sentence length:\n\n"""\n${settings.voiceSamples.trim()}\n"""\n`
    : '';

  return `You are an expert email writer drafting outreach on behalf of a Northwestern University student named ${userName}.

The student is helping a mentor named Philipp Grötsch reach researchers at Northwestern.

# Mentor profile
Philipp Grötsch — founder of Aqualytics (aqualytics.eco). Physicist with PhD in water-quality monitoring and remote sensing. Former CTO of Gybe.

# About Aqualytics
- Consultancy on water quality monitoring using satellite + on-the-ground observations
- Has IP and know-how to commercialize a continuous water-quality instrument at ~10% the cost of existing solutions
- Target customer archetypes: NGOs (Nature Conservancy, WWF), development banks (World Bank, IDB), research orgs (NASA, universities), restoration firms, utilities
- The instrument was previously used only in-house and is now being productized

# What Philipp wants to learn from these conversations
- What markets / user groups open up when the price tag is lowered by an order of magnitude?
- What new use cases might exist once the tech is affordable?
- For each use case, where's the sweet spot between data quality and price?
- Where's the sweet spot between raw sensor readings and high-level interpretation (e.g., bloom forecasts)?
- Individual sensors' data vs. regionally consolidated (distributed sensor networks)?
- Is there value in complementary satellite data?
- Would users be OK with sharing their data with other users in the region?

# Goal of this email
Get a 25-minute discovery call between Philipp and the recipient. The student is the intermediary — they coordinate, Philipp shows up to the call.
${voiceBlock}
# Hard rules for every draft
1. Frame as: "I'm a Northwestern student helping a mentor named Philipp Grötsch..."
2. Reference at least one specific paper, lab, or project of theirs by name. Drawing from the contact context provided.
3. Pick exactly ONE Aqualytics question that maps to their research and weave it in naturally.
4. End with a concrete ask: a 25-minute call in the next two weeks.
5. Tone: warm but specific. Not salesy. Not generic. No emojis unless the user voice samples use them.
6. Length: 4-7 sentences. Plain text (no markdown). Use a single blank line between paragraphs.
7. NEVER sign as Philipp. The signature is the student's, ${userName}.
8. The subject line must be under 70 characters and reference both their work and Aqualytics.

# Output format
Return JSON with two keys:
- "subject": the subject line (string, < 70 chars)
- "body": the email body (string, plain text with \\n for line breaks)

Do not include any preamble, commentary, or wrapping text — return only the JSON object.`;
}

function buildUserPrompt(contact: Contact, extra?: string): string {
  const lines: string[] = [];
  lines.push(`# Contact: ${contact.name}`);
  lines.push(`Title: ${contact.title}`);
  lines.push(`Department: ${contact.department}`);
  if (contact.email) lines.push(`Email: ${contact.email}`);
  if (contact.officeLocation) lines.push(`Office: ${contact.officeLocation}`);
  lines.push('');
  lines.push(`## Why they're a fit for Aqualytics`);
  lines.push(contact.whyFit);
  lines.push('');
  lines.push(`## Aqualytics angle tags`);
  lines.push(contact.angles.join(', '));
  if (contact.papers && contact.papers.length > 0) {
    lines.push('');
    lines.push(`## Recent papers / work to reference`);
    for (const p of contact.papers) {
      lines.push(`- "${p.title}" — ${p.venue}, ${p.year}`);
    }
  }
  if (contact.talkingPoints && contact.talkingPoints.length > 0) {
    lines.push('');
    lines.push(`## Talking points already prepared for in-person conversation (use as inspiration but rewrite for an email opener)`);
    for (const tp of contact.talkingPoints) {
      lines.push(`- ${tp}`);
    }
  }
  if (extra && extra.trim()) {
    lines.push('');
    lines.push(`## Extra context from the user`);
    lines.push(extra.trim());
  }
  lines.push('');
  lines.push(`Now write the email. Return JSON only.`);
  return lines.join('\n');
}

function getClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function draftEmail(
  contact: Contact,
  settings: Settings,
  extra?: string
): Promise<EmailDraft> {
  if (!settings.apiKey) {
    throw new Error('No API key set. Add one in Settings.');
  }
  const client = getClient(settings.apiKey);
  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = buildUserPrompt(contact, extra);

  const response = await client.messages.create({
    model: settings.model || 'claude-opus-4-7',
    max_tokens: 1500,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['subject', 'body'],
          additionalProperties: false,
        },
      },
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );
  if (!textBlock) throw new Error('Model returned no text block.');

  let parsed: EmailDraft;
  try {
    parsed = JSON.parse(textBlock.text) as EmailDraft;
  } catch {
    const match = textBlock.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse JSON from model response.');
    parsed = JSON.parse(match[0]) as EmailDraft;
  }
  if (!parsed.subject || !parsed.body) {
    throw new Error('Model response was missing subject or body.');
  }
  return parsed;
}

export interface ClassifyReplyInput {
  contactName: string;
  contactTitle: string;
  whyFit: string;
  myDraftSubject: string;
  myDraftBody: string;
  reply: string;
}

export async function classifyReply(
  input: ClassifyReplyInput,
  settings: Settings
): Promise<ReplyClassification> {
  if (!settings.apiKey) throw new Error('No Anthropic API key set.');
  const client = getClient(settings.apiKey);

  const systemPrompt = `You are an assistant that reads professor replies to outreach emails and classifies the reply.

The outreach is about scheduling a 25-minute discovery conversation with Philipp Grötsch (Aqualytics, water-quality monitoring).

Return STRICT JSON with these fields:
- "intent": one of "yes" | "no" | "reschedule" | "redirect" | "info" | "unclear"
  - "yes" = they accepted or proposed concrete times
  - "no" = they declined
  - "reschedule" = they responded but want a different time / pushed back the timeline
  - "redirect" = they suggested someone else instead of themselves
  - "info" = they asked for more info or the deck before deciding
  - "unclear" = anything else
- "summary": one short sentence summarizing what they said
- "suggestedAction": one short sentence describing what to do next (the most useful next step you the assistant can take)
- "proposedTimes": array of human-readable time strings if they proposed any concrete times (e.g. "Wednesday May 6 at 2pm CT", "Thursday afternoon"); empty array if none

Return JSON only, no commentary.`;

  const userPrompt = `# Contact
${input.contactName} — ${input.contactTitle}
Why-fit: ${input.whyFit}

# My outreach email
Subject: ${input.myDraftSubject}

${input.myDraftBody}

# Their reply
"""
${input.reply}
"""

Classify the reply.`;

  const response = await client.messages.create({
    model: settings.model || 'claude-opus-4-7',
    max_tokens: 600,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            intent: { type: 'string', enum: ['yes', 'no', 'reschedule', 'redirect', 'info', 'unclear'] },
            summary: { type: 'string' },
            suggestedAction: { type: 'string' },
            proposedTimes: { type: 'array', items: { type: 'string' } },
          },
          required: ['intent', 'summary', 'suggestedAction', 'proposedTimes'],
          additionalProperties: false,
        },
      },
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!text) throw new Error('Classifier returned no text.');
  const parsed = JSON.parse(text.text) as ReplyClassification;
  return {
    intent: parsed.intent as ReplyIntent,
    summary: parsed.summary,
    suggestedAction: parsed.suggestedAction,
    proposedTimes: parsed.proposedTimes ?? [],
  };
}

export interface PickTimeInput {
  proposedTimes: string[];
  busySlots: { start: string; end: string }[];
  durationMinutes: number;
  searchStartISO: string;
  searchEndISO: string;
  timezone: string;
}

export interface PickedSlot {
  startISO: string;
  endISO: string;
  reasoning: string;
}

export async function pickMeetingTime(
  input: PickTimeInput,
  settings: Settings
): Promise<PickedSlot> {
  if (!settings.apiKey) throw new Error('No Anthropic API key set.');
  const client = getClient(settings.apiKey);
  const systemPrompt = `You pick the best meeting slot given the recipient's stated time preferences and the user's calendar busy slots.

Pick a 30-minute slot (or whatever durationMinutes is) that:
- Falls inside searchStartISO–searchEndISO
- Does NOT overlap any busy slot (use the busy slots as hard constraints)
- Best matches the recipient's proposed times if they gave any
- Falls on weekdays during reasonable working hours in the given timezone (8 am – 6 pm)

Return strict JSON:
- startISO: ISO 8601 datetime with timezone offset
- endISO: ISO 8601 datetime with timezone offset (start + durationMinutes)
- reasoning: one short sentence explaining the choice

Return JSON only.`;
  const userPrompt = `Now: ${new Date().toISOString()}
Timezone: ${input.timezone}
Duration: ${input.durationMinutes} minutes
Search window: ${input.searchStartISO} to ${input.searchEndISO}
Recipient proposed times: ${JSON.stringify(input.proposedTimes)}
Calendar busy slots:
${input.busySlots.map((b) => `  - ${b.start} → ${b.end}`).join('\n') || '  (none)'}

Pick the best slot.`;

  const response = await client.messages.create({
    model: settings.model || 'claude-opus-4-7',
    max_tokens: 500,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            startISO: { type: 'string' },
            endISO: { type: 'string' },
            reasoning: { type: 'string' },
          },
          required: ['startISO', 'endISO', 'reasoning'],
          additionalProperties: false,
        },
      },
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!text) throw new Error('Time-picker returned no text.');
  return JSON.parse(text.text) as PickedSlot;
}

export async function testApiKey(apiKey: string, model: string): Promise<{ ok: true; cached?: boolean } | { ok: false; error: string }> {
  if (!apiKey) return { ok: false, error: 'No API key provided.' };
  try {
    const client = getClient(apiKey);
    const response = await client.messages.create({
      model: model || 'claude-opus-4-7',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Say "ok" only.' }],
    });
    const text = response.content.find((b) => b.type === 'text');
    if (text && text.type === 'text') return { ok: true };
    return { ok: false, error: 'Got an unexpected response shape.' };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: 'Invalid API key. Check the key and try again.' };
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, error: "Your API key doesn't have access to this model." };
    }
    if (err instanceof Anthropic.NotFoundError) {
      return { ok: false, error: 'Model not found. Check the model selection.' };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `API error ${err.status}: ${err.message}` };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
