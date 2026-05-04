import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, RotateCcw, Save, ShieldCheck, ShieldAlert } from 'lucide-react';
import { MODEL_OPTIONS, useSettings } from '../data/settings';
import { testApiKey } from '../lib/anthropic';

export function Settings() {
  const { settings, update, clear } = useSettings();
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [savedTick, setSavedTick] = useState(false);

  function save() {
    update(draft);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  }

  async function runTest() {
    setTest('testing');
    setTestMsg('');
    const result = await testApiKey(draft.apiKey, draft.model);
    if (result.ok) {
      setTest('ok');
      setTestMsg('Key works. Model responded.');
    } else {
      setTest('fail');
      setTestMsg(result.error);
    }
  }

  return (
    <div className="px-8 py-7 max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink-950">Settings</h1>
        <p className="text-sm text-ink-500 mt-1">
          Stored in this browser's localStorage. Never sent anywhere except directly to
          Anthropic when you generate a draft.
        </p>
      </header>

      <div className="space-y-6">
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold text-ink-950 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Anthropic API key
          </h2>
          <p className="text-xs text-ink-500">
            Get one at{' '}
            <a
              className="text-wave-700 underline"
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
            >
              console.anthropic.com/settings/keys
            </a>
            . Cost per email: ~$0.005 with Sonnet 4.6, ~$0.02 with Opus 4.7. The system prompt is cached so
            repeat drafts are ~10x cheaper than the first.
          </p>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-ant-api03-..."
              className="input font-mono text-[13px] pr-10"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                Model
              </span>
              <select
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                className="input mt-1"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runTest}
              disabled={!draft.apiKey || test === 'testing'}
              className="btn-outline text-xs disabled:opacity-50"
            >
              {test === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {test === 'idle' && 'Test API key'}
              {test === 'testing' && 'Testing…'}
              {test === 'ok' && (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Key works
                </>
              )}
              {test === 'fail' && (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> Failed
                </>
              )}
            </button>
            {testMsg && (
              <span
                className={`text-[12px] ${
                  test === 'ok' ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {testMsg}
              </span>
            )}
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <h2 className="font-semibold text-ink-950">Your details</h2>
          <p className="text-xs text-ink-500">Used in every email draft.</p>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
              Your name
            </span>
            <input
              value={draft.userName}
              onChange={(e) => setDraft({ ...draft, userName: e.target.value })}
              placeholder="e.g. Jane Smith"
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
              Your Gmail / .edu address
            </span>
            <input
              value={draft.fromEmail}
              onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })}
              placeholder="you@u.northwestern.edu"
              className="input mt-1 font-mono text-[13px]"
            />
            <span className="block text-[11px] text-ink-500 mt-1">
              When you click "Open in Gmail", we hint at this account so the right inbox opens if
              you're signed into multiple Google accounts.
            </span>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
              Sign-off / signature
            </span>
            <textarea
              value={draft.userSignature}
              onChange={(e) => setDraft({ ...draft, userSignature: e.target.value })}
              rows={3}
              placeholder={'Best,\nJane\nNorthwestern \'27 · Materials Science'}
              className="input mt-1 font-mono text-[13px]"
            />
          </label>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-ink-950">Voice samples (optional but recommended)</h2>
          <p className="text-xs text-ink-500">
            Paste 1-2 emails you've previously written. The AI will match your tone, cadence, and
            vocabulary instead of sounding generic. The biggest quality lever in this whole tool.
          </p>
          <textarea
            value={draft.voiceSamples}
            onChange={(e) => setDraft({ ...draft, voiceSamples: e.target.value })}
            rows={10}
            placeholder={`Hi Professor X,\n\nI'm a sophomore in chemical engineering...`}
            className="input font-mono text-[12px] leading-relaxed"
          />
        </section>

        <div className="flex items-center gap-3">
          <button onClick={save} className="btn-primary">
            <Save className="w-4 h-4" /> Save settings
          </button>
          {savedTick && <span className="text-xs text-emerald-700">Saved.</span>}
          <div className="flex-1" />
          <button
            onClick={() => {
              if (confirm('Reset all settings? This wipes your API key from this browser.')) {
                clear();
                setDraft({
                  apiKey: '',
                  model: 'claude-opus-4-7',
                  userName: '',
                  userSignature: '',
                  voiceSamples: '',
                  fromEmail: '',
                });
                setTest('idle');
                setTestMsg('');
              }
            }}
            className="btn-ghost text-xs text-red-600"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}
