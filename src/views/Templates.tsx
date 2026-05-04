import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface Template {
  title: string;
  subtitle?: string;
  body: string;
}

const TEMPLATES: Template[] = [
  {
    title: 'Cold email — first touch',
    subtitle: 'Subject: Aqualytics × [their work] — quick chat?',
    body: `Hi Professor [Last name],

I'm a Northwestern student helping Philipp Grötsch, founder of Aqualytics (water-quality monitoring consultancy, ex-CTO of Gybe), connect with researchers at NU. He's commercializing a continuous water-quality instrument at ~10% the cost of existing solutions and is looking for honest feedback on [ONE specific angle from their research — e.g. "the role of low-cost sensor networks in nitrate monitoring like your Mississippi work"].

Would a 25-minute conversation in the next two weeks work? Happy to come to your office. I can also share his short deck in advance if useful.

Thanks,
[Your name]
[Class year, program]`,
  },
  {
    title: 'Follow-up after walk-in',
    subtitle: 'Subject: Following up — Aqualytics water quality conversation',
    body: `Hi Professor [Last name],

Thanks for taking the time today. As promised, attaching Philipp's deck — the key questions on his mind are on the last slide (markets opened up by 10x cheaper instruments, sweet spot of data quality vs price, individual sensors vs networks).

If there's a 25-min slot in the next two weeks for a deeper conversation with him directly, here are a few options: [Calendly link OR three time slots].

Thanks again,
[Your name]`,
  },
  {
    title: 'Reply — they said yes',
    body: `Great — thank you. How about [time 1], [time 2], or [time 3]? 25 minutes, video link from my end. Philipp is on Berlin/Pacific time so morning Central tends to work.

I'll send a calendar invite once you pick. Deck attached for context (he'll skim it at the top of the call).`,
  },
  {
    title: 'Reply — they said no',
    body: `No problem at all — thanks for the quick reply. If anyone in your group or network you think would be the right person, I'd be grateful for an intro. Either way, much appreciated.`,
  },
  {
    title: 'Reply — reschedule',
    body: `No problem. Three new options: [time 1], [time 2], [time 3]. Let me know what works.`,
  },
  {
    title: 'Walk-in opener (verbal, 30 seconds)',
    body: `Hi Professor [Name], I'm [Your name], a [year, program] student. I'm helping a mentor named Philipp Grötsch — he runs Aqualytics, a water-quality monitoring company. He's working on a continuous water sensor at about a tenth of current pricing, and he's trying to figure out what new use cases that opens up. Your work on [their thing] is exactly the kind of thing he's curious about. Could I grab 25 minutes of your time in the next two weeks for a call with him? I can leave you a one-page summary either way.`,
  },
  {
    title: 'Calendar event description',
    body: `Discovery conversation with Philipp Grötsch (Aqualytics)

Who's joining: [Their name + 1-line bio]
Why this conversation: [1-line why-fit — copy from contact card]

Aqualytics in 30 seconds:
— Water-quality monitoring consultancy (satellite + on-the-ground)
— Commercializing a continuous instrument at ~10% the cost of existing solutions
— Mentor: Philipp Grötsch, PhD water-quality remote sensing, ex-CTO Gybe

Deck (4 slides): [link]

Things Philipp wants to learn from this person:
  1. [tailored question 1]
  2. [tailored question 2]
  3. [tailored question 3]

Notes (fill in during/after):
  —`,
  },
];

export function Templates() {
  const [copied, setCopied] = useState<number | null>(null);

  function copy(idx: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied((c) => (c === idx ? null : c)), 1500);
  }

  return (
    <div className="px-8 py-7 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink-950">Templates</h1>
        <p className="text-sm text-ink-500 mt-1">
          Click Copy, paste, replace the [bracketed] bits.
        </p>
      </header>
      <div className="space-y-4">
        {TEMPLATES.map((t, i) => (
          <article key={i} className="card p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-ink-950">{t.title}</h3>
                {t.subtitle && (
                  <p className="text-xs text-ink-500 mt-0.5 font-mono">{t.subtitle}</p>
                )}
              </div>
              <button onClick={() => copy(i, t.body)} className="btn-outline">
                {copied === i ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-[13px] text-ink-700 leading-relaxed font-sans bg-ink-50 rounded-lg p-3 border border-ink-100">
{t.body}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}
