# Aqualitcs — Northwestern outreach tracker

A small React app for tracking the Aqualytics × Northwestern faculty outreach campaign. Companion to the Notion workspace at https://www.notion.so/3569553e31cc818889aef48edcab39ca.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## What it does

- **Today** — time-blocked walk-in plan (Tech A wing → Tech F wing), one-click "I touched them" toggle.
- **Calendar** — week grid showing scheduled meetings; click any event to open the contact.
- **Contacts** — searchable, filterable table of 42 prospects (filter by fit / status / department).
- **Contact drawer** — notes editor, status picker, owner assignment, papers list, meeting scheduler with date/time, opener you can copy-to-clipboard.
- **Templates** — six reusable email/walk-in templates, copy-to-clipboard.
- **Persistence** — all status changes, notes, and meetings save to `localStorage` under `aqualitcs:contacts:v1`. Same browser = same data tomorrow.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS, water-themed palette (`wave`, `ink`, `algae`)
- React Router, date-fns, lucide-react icons

## Roadmap

- Wire to Supabase for cross-device sync (so collaborator and you share state)
- Notion API two-way sync
- File uploads on contact (deck, one-pager) — needs blob storage
- Auto-generate Google Calendar invite from Meeting block
