import { useState } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LogIn,
  LogOut,
} from 'lucide-react';
import { MODEL_OPTIONS, useSettings } from '../data/settings';
import { testApiKey } from '../lib/anthropic';
import { signInWithGoogle, signOutGoogle, getUserInfo, isTokenValid } from '../lib/google';

export function Settings() {
  const { settings, update, clear } = useSettings();
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [savedTick, setSavedTick] = useState(false);
  const [openWalkthrough, setOpenWalkthrough] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleErr, setGoogleErr] = useState('');

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

  async function googleSignIn() {
    if (!draft.googleClientId.trim()) {
      setGoogleErr('Paste your Google OAuth Client ID first.');
      return;
    }
    setGoogleBusy(true);
    setGoogleErr('');
    try {
      const resp = await signInWithGoogle(draft.googleClientId.trim());
      const expiry = Date.now() + (resp.expires_in - 30) * 1000;
      let email: string | undefined;
      try {
        const ui = await getUserInfo(resp.access_token);
        email = ui.email;
      } catch {
        // userinfo failed but token works
      }
      const next = {
        ...draft,
        googleAccessToken: resp.access_token,
        googleAccessTokenExpiry: expiry,
        googleEmail: email ?? draft.googleEmail,
      };
      setDraft(next);
      update(next);
    } catch (err) {
      setGoogleErr(err instanceof Error ? err.message : String(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function googleSignOut() {
    await signOutGoogle(draft.googleAccessToken);
    const next = {
      ...draft,
      googleAccessToken: undefined,
      googleAccessTokenExpiry: undefined,
      googleEmail: undefined,
    };
    setDraft(next);
    update(next);
  }

  const tokenValid = isTokenValid(draft.googleAccessTokenExpiry);

  return (
    <div className="px-8 py-7 max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink-950">Settings</h1>
        <p className="text-sm text-ink-500 mt-1">
          Stored in this browser's localStorage. Tokens never leave your machine.
        </p>
      </header>

      <div className="space-y-6">
        {/* Anthropic */}
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
            . ~$0.005 / draft on Sonnet 4.6, ~$0.02 / draft on Opus 4.7. Repeat drafts ~10× cheaper from prompt caching.
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
              <span className={`text-[12px] ${test === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                {testMsg}
              </span>
            )}
          </div>
        </section>

        {/* Google OAuth */}
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold text-ink-950 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Google (Gmail + Calendar)
            </span>
            {draft.googleEmail && tokenValid && (
              <span className="pill bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                Signed in: {draft.googleEmail}
              </span>
            )}
            {draft.googleEmail && !tokenValid && (
              <span className="pill bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
                Session expired — sign in again
              </span>
            )}
          </h2>

          <p className="text-xs text-ink-500 leading-relaxed">
            With Google sign-in, drafts can be <strong>sent directly via Gmail</strong> (no compose-tab manual step), the app reads
            <strong> replies</strong> from your inbox, AI classifies them, and Meet links can be created on your Calendar with
            invites going out automatically.
          </p>

          <button
            onClick={() => setOpenWalkthrough(!openWalkthrough)}
            className="btn-outline text-xs w-full justify-between"
          >
            <span>📋 First-time setup walkthrough (~15 min)</span>
            {openWalkthrough ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {openWalkthrough && (
            <ol className="text-[13px] text-ink-700 space-y-2 leading-relaxed bg-ink-50 border border-ink-100 rounded-lg p-4 list-decimal list-inside">
              <li>
                Open{' '}
                <a className="text-wave-700 underline" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
                  console.cloud.google.com/projectcreate <ExternalLink className="inline w-3 h-3" />
                </a>{' '}
                — create a project (any name, e.g. "Aqualitcs")
              </li>
              <li>
                In{' '}
                <a className="text-wave-700 underline" href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer">
                  APIs & Services → Library
                </a>
                , enable both <strong>Gmail API</strong> and <strong>Google Calendar API</strong>
              </li>
              <li>
                Go to{' '}
                <a className="text-wave-700 underline" href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer">
                  OAuth consent screen
                </a>{' '}
                → User type: <strong>External</strong> → fill App name, support email, dev email → Save
              </li>
              <li>
                On the same screen → <strong>Audience</strong> tab → add your Gmail address as a <strong>test user</strong>
              </li>
              <li>
                <a className="text-wave-700 underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                  Credentials → Create Credentials → OAuth Client ID
                </a>{' '}
                → type: <strong>Web application</strong>
              </li>
              <li>
                Authorized JavaScript origins: add{' '}
                <code className="bg-white px-1 py-0.5 rounded text-[11px]">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}</code>
                {' '}(this exact URL — the one you're on now). When you deploy, add the deployed URL too.
              </li>
              <li>
                Copy the <strong>Client ID</strong> (looks like <code className="bg-white px-1 py-0.5 rounded text-[11px]">…apps.googleusercontent.com</code>) and paste below.
              </li>
              <li>
                Click <strong>Sign in with Google</strong>. Google may say "this app isn't verified" — click <strong>Advanced</strong> → "Go to Aqualitcs (unsafe)". This is normal for personal/testing apps. Approve all scopes.
              </li>
              <li>
                <strong>Northwestern .edu warning:</strong> If your Workspace admin has blocked third-party apps, you'll see "access blocked" and can't proceed. Use a personal Gmail or ask IT, or fall back to the compose-URL flow.
              </li>
            </ol>
          )}

          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
              OAuth Client ID
            </span>
            <input
              type="text"
              value={draft.googleClientId}
              onChange={(e) => setDraft({ ...draft, googleClientId: e.target.value })}
              placeholder="123456789-xxxxxxxxxx.apps.googleusercontent.com"
              className="input mt-1 font-mono text-[12px]"
              autoComplete="off"
            />
          </label>

          <div className="flex items-center gap-2 flex-wrap">
            {!tokenValid && (
              <button
                onClick={googleSignIn}
                disabled={googleBusy || !draft.googleClientId.trim()}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {googleBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <LogIn className="w-3.5 h-3.5" />
                Sign in with Google
              </button>
            )}
            {tokenValid && (
              <button onClick={googleSignOut} className="btn-outline text-xs">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            )}
            {googleErr && <span className="text-[12px] text-red-700">{googleErr}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                Default meet length (min)
              </span>
              <input
                type="number"
                min={10}
                max={120}
                step={5}
                value={draft.meetDurationMinutes ?? 25}
                onChange={(e) => setDraft({ ...draft, meetDurationMinutes: Number(e.target.value) })}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                Timezone
              </span>
              <input
                type="text"
                value={draft.meetTimezone ?? ''}
                onChange={(e) => setDraft({ ...draft, meetTimezone: e.target.value })}
                placeholder="America/Chicago"
                className="input mt-1 font-mono text-[12px]"
              />
            </label>
          </div>
        </section>

        {/* User details */}
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
              Used in the From: header when sending via Gmail API and the authuser hint for compose URLs.
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

        {/* Voice samples */}
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-ink-950">Voice samples (optional but recommended)</h2>
          <p className="text-xs text-ink-500">
            Paste 1-2 emails you've previously written. The AI matches your tone instead of sounding generic.
            Biggest quality lever in this whole tool.
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
              if (confirm('Reset all settings? This wipes API keys + Google session from this browser.')) {
                clear();
                setDraft({
                  apiKey: '',
                  model: 'claude-opus-4-7',
                  userName: '',
                  userSignature: '',
                  voiceSamples: '',
                  fromEmail: '',
                  googleClientId: '',
                  googleAccessToken: undefined,
                  googleAccessTokenExpiry: undefined,
                  googleEmail: undefined,
                  meetDurationMinutes: 25,
                  meetTimezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/Chicago',
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
