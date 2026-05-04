import Anthropic from '@anthropic-ai/sdk';
import type { Contact, EmailDraft, Settings } from '../types';

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
