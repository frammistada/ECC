# Citadel

A private evening-reflection journal. You write about what tested you today;
a Stoic mentor answers with a question, not encouragement. Day-one build:
the core loop only — entry, mentor response, marginalia rendering. No auth,
no persistence yet (day two).

## Run it

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Without a key, set `CITADEL_MOCK_MENTOR=1` in `.env.local` to exercise the
UI loop with a canned placeholder response.

## What matters here

- `lib/mentor-prompt.js` — the mentor's voice. This is the product. After any
  edit, test with a self-congratulatory entry and a self-pitying one; it must
  push back on both.
- `app/api/reflect/route.js` — server-side Claude call. Prior exchanges from
  the current sitting are passed as conversation history so the mentor can
  reference patterns.
- `app/globals.css` — the full design token set (Stone/Marble/Ink/Ash/Patina/
  Ember, Fraunces / Source Serif 4 / IBM Plex Mono). Ember is reserved for the
  paywall moment and is intentionally unused in day one.

## Not in day one, on purpose

Auth, persistence, Stripe, timeline view, streaks, tags, moods, community.
See the build spec — the differentiation is the mentor's voice and memory,
not feature count.
