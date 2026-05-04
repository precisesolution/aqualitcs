import { useEffect, useState } from 'react';
import {
  Copy,
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type { Contact } from '../types';
import { useSettings } from '../data/settings';
import { generateBriefing } from '../lib/anthropic';
import { downloadBlob, markdownToDocxBlob } from '../lib/docx';

interface Props {
  contact: Contact | null;
  onClose: () => void;
}

export function BriefingDocModal({ contact, onClose }: Props) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (contact) {
      setMarkdown('');
      setError('');
      setStatus('idle');
      setCopied(false);
    }
  }, [contact?.id]);

  if (!contact) return null;

  async function generate() {
    if (!contact) return;
    if (!settings.apiKey) {
      setError('No Anthropic API key. Open Settings.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const md = await generateBriefing(contact, settings);
      setMarkdown(md);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function downloadDocx() {
    if (!contact || !markdown) return;
    setDownloading(true);
    try {
      const blob = await markdownToDocxBlob(markdown, `Briefing — ${contact.name}`);
      const safeName = contact.name.replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, '_');
      const today = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `Briefing_${safeName}_${today}.docx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  function copyMarkdown() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function printPreview() {
    if (!markdown || !contact) return;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
    if (!w) {
      setError('Popup blocked. Allow popups to print.');
      return;
    }
    const html = renderMarkdownToHtml(markdown);
    w.document.write(`<!doctype html><html><head><title>Briefing — ${escapeHtml(contact.name)}</title><meta charset="utf-8"><style>
      body { font-family: Calibri, system-ui, -apple-system, sans-serif; font-size: 11pt; line-height: 1.5; max-width: 720px; margin: 32px auto; padding: 0 24px; color: #11192a; }
      h1 { font-size: 22pt; margin: 8px 0 4px; border-bottom: 2px solid #1a779a; padding-bottom: 4px; }
      h2 { font-size: 14pt; margin: 24px 0 6px; color: #1a779a; }
      h3 { font-size: 12pt; margin: 16px 0 4px; }
      p { margin: 6px 0 10px; }
      ul, ol { margin: 4px 0 12px; padding-left: 28px; }
      li { margin: 3px 0; }
      hr { border: none; border-top: 1px solid #ccc; margin: 12px 0; }
      strong { color: #11192a; }
      em { color: #4f5b6c; }
      @media print { body { margin: 0; padding: 16px; } }
    </style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return (
    <>
      <div className="fixed inset-0 bg-ink-950/40 z-[60]" onClick={onClose} aria-label="Close briefing" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[85vh] bg-white z-[70] rounded-xl shadow-2xl border border-ink-200 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-ink-100 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-wave-600" /> Pre-meeting briefing
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              For your meeting with{' '}
              <span className="font-medium text-ink-800">{contact.name}</span>
              <span className="text-ink-400"> · {contact.department}</span>
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {status === 'idle' && !markdown && (
            <div className="py-12 flex flex-col items-center gap-3">
              <FileText className="w-12 h-12 text-ink-200" />
              <p className="text-sm text-ink-600 text-center max-w-md">
                Generate a briefing doc structured in the order you walk into the room: who they
                are, what they've done, why this conversation matters, the opening line, 8–10
                tailored questions, watch-outs, and a notes section.
              </p>
              <button
                onClick={generate}
                disabled={!settings.apiKey}
                className="btn-primary mt-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {settings.apiKey ? 'Generate briefing' : 'Add Anthropic key in Settings first'}
              </button>
              {!settings.apiKey && (
                <p className="text-[11px] text-amber-700">Settings → paste API key → return.</p>
              )}
            </div>
          )}

          {status === 'loading' && (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-wave-500 animate-spin" />
              <p className="text-sm text-ink-500">
                {settings.model} is writing — usually 10–25 seconds…
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-[12px]">
              {error}
            </div>
          )}

          {markdown && (
            <article
              className="prose-aq text-[13px] leading-relaxed text-ink-800"
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(markdown) }}
            />
          )}
        </div>

        {markdown && (
          <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/50 flex items-center gap-2 flex-wrap">
            <button onClick={generate} className="btn-ghost text-xs" title="Generate again">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <button onClick={copyMarkdown} className="btn-outline text-xs">
              <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy markdown'}
            </button>
            <button onClick={printPreview} className="btn-outline text-xs">
              <Printer className="w-3.5 h-3.5" /> Print / save PDF
            </button>
            <div className="flex-1" />
            <button onClick={downloadDocx} disabled={downloading} className="btn-primary disabled:opacity-50">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Building…' : 'Download .docx'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ----- minimal markdown renderer (for in-modal preview + print) -----

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

function renderMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let paraBuf: string[] = [];

  function flushPara() {
    if (paraBuf.length) {
      out.push(`<p>${paraBuf.map(renderInline).join(' ')}</p>`);
      paraBuf = [];
    }
  }
  function closeLists() {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  }

  for (const raw of lines) {
    const line = raw;
    if (line.trim() === '') {
      flushPara();
      closeLists();
      continue;
    }
    if (line.trim() === '---') {
      flushPara();
      closeLists();
      out.push('<hr />');
      continue;
    }
    if (line.startsWith('# ')) {
      flushPara();
      closeLists();
      out.push(`<h1>${renderInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara();
      closeLists();
      out.push(`<h2>${renderInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushPara();
      closeLists();
      out.push(`<h3>${renderInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.match(/^\s*[-*]\s+/)) {
      flushPara();
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${renderInline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (line.match(/^\s*\d+\.\s+/)) {
      flushPara();
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${renderInline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }
    closeLists();
    paraBuf.push(line);
  }
  flushPara();
  closeLists();
  return out.join('\n');
}
