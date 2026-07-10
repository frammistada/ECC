# Citadel — project guide

A private evening-reflection journal. The user writes what tested them; a Stoic
mentor (Claude) replies with a question, not encouragement — and remembers what
came before. This file loads every session; keep it concise and current.

## Tech stack

- **Next.js 15** (App Router, JS — no TypeScript), **React 19**, **Tailwind v4**
  (tokens in `app/globals.css`, no config file).
- **Supabase** — auth + Postgres. `@supabase/ssr` clients in `lib/supabase/`
  (`server.js`, `client.js`, `admin.js` service-role for webhooks/after-writes).
- **Claude API** via `@anthropic-ai/sdk`. Mentor = `claude-opus-4-8` with adaptive
  thinking (`lib/mentor.js`). Pattern summary = `claude-haiku-4-5` (`lib/summary.js`).
- **Stripe** Checkout + webhook for subscriptions. **Brevo** transactional API for
  the accountability email (`lib/email.js`) and Supabase's auth SMTP.
- Hosted on **Vercel**. Env vars documented in `.env.example`. App lives in the
  `citadel/` subdir of the ECC repo; Vercel root directory = `citadel`.

## Architecture decisions

- **Two-layer memory.** Short-term: last 5 entries+responses fed to the mentor as
  real conversation turns. Long-term: a rolling `profiles.pattern_summary`, updated
  by a cheap Haiku call after each entry (revise, don't restart) and prepended to
  the mentor's system prompt. The summary update + activity log run in Next's
  `after()` so they add zero latency and never block/break the reply.
- **"Who am I" (static background).** A third context layer beside the two
  above: `profiles.age/aim/about_note` (+ the shared `preferred_name`),
  edited only at `/who-am-i` (reached from the hamburger drawer), injected
  into the mentor's system prompt on every entry by `buildMentorSystem`.
  User-written only — never summarized, never machine-revised, not gated
  behind the subscription. Saves through the same `/api/settings` updater.
- **Sections drawer.** Hamburger (top-left of the entry screen,
  `components/nav-menu.js`) opens a left drawer of app sections. Unbuilt
  sections (To Myself, Reminders, No-Mentor Journaling) stay visible but
  grayed out with a mono "soon" tag — add them here first, then build.
- **Open loops.** After each reflect, a Haiku call (`lib/loops.js`) extracts
  0–2 stated intentions/commitments/unresolved tensions (none forced; it
  sees what's already tracked so it never duplicates). Stored in
  `open_loops`; the 3 newest unresolved are injected into the mentor's
  system prompt so it can follow up when the user goes quiet on one — at
  most one per reply, never mechanically. Resolution is manual v1: a
  "let it go" dismiss in settings (`/api/loops/[id]`). Injection sits
  behind `OPEN_LOOPS_REQUIRE_SUBSCRIPTION` in `lib/loops.js` — currently
  false; flip to true when the payment wall lands (extraction always runs
  so history exists the day a user subscribes).
- **Mentor mode.** 7-question scenario onboarding (`lib/onboarding.js`, asked
  one question per screen) scores
  `direct` vs `steady` (steady = safe default). Stored on `profiles.mentor_mode`;
  shifts the tone addendum in `lib/mentor-prompt.js`. `preferred_name` (onboarding
  Q8) is offered to the mentor to use where it reads naturally. Both editable at
  `/settings`. New users route to `/onboarding` before their first entry.
- **Auth** (Supabase): "Continue with Google" (OAuth) + email **code → password**.
  Magic links were **removed** — on mobile they open in the mail app's browser and
  strand the original tab. The emailed code is verified in the same tab. The
  "email me a code" path doubles as first-time signup AND password reset.
- **Scarcity.** 5 free reflections (`lib/limits.js`), enforced server-side in
  `app/api/reflect/route.js` (402 + paywall), then Stripe.
- **Meditations (entry pages).** Every entry belongs to a `meditations` row —
  a named page that is its own chat. The day's page is auto-created by the
  first reflect (`auto_day` set, unique per user/day, server-UTC day); users
  create standalone pages from /meditations (name + per-page `mentor_mode`,
  null = profile default — page mode wins in `/api/reflect`, and the mentor's
  5-exchange short-term memory is scoped per page). Pages are renamed,
  re-moded, and deleted (confirmation dialog, cascade) via
  `/api/meditations[/id]`. /history redirects to /meditations.
- **Accountability (opt-in).** Optional contact in settings. An "I fell short today"
  toggle on the entry → after the reply, a pre-drafted note with one-tap send via
  Brevo. Never auto-sent; recipient resolved server-side from the user's own
  profile (not spammable). Message composed identically client+server in
  `lib/accountability.js`.
- **Privacy.** RLS on every table; entries/responses are per-user. `auth.uid()`
  wrapped in `(select …)` in policies. The Stripe webhook is the only writer of
  `subscription_status` (service role). Signup trigger `handle_new_user` is
  trigger-only (no public execute).

## Data model (Supabase)

`profiles` (id, email, subscription_status, stripe_*, pattern_summary, mentor_mode,
preferred_name, onboarding_answers, onboarded, accountability_name/email,
age/aim/about_note) ·
`meditations` (user_id, name, mentor_mode nullable, auto_day, created_at) ·
`entries` (user_id, meditation_id, content) · `responses` (entry_id, content) ·
`open_loops` (user_id, entry_id, description, resolved, resolved_at) ·
`user_activity_log` (per-entry: mentor_mode, entry_length, goal_status — logging
only, nothing acts on it yet). Canonical DDL in `supabase/schema.sql`; changes go
through numbered files in `supabase/migrations/` AND get applied to the live
project (id `ktztzjajwhlgqsbrcftk`).

## Built vs. pending

- **Built:** full auth, the reflect loop with two-layer memory, onboarding +
  mentor mode, settings, history timeline, paywall enforcement, Stripe wiring,
  accountability draft/send (live — `BREVO_API_KEY` + `ACCOUNTABILITY_FROM_EMAIL`
  are set in Vercel), instrumentation logging. Dark-shell v1 UI per
  `citadel_ui_spec.md`: splash, sign-in, and main entry match the reference
  designs; meditations (named entry pages, per-page mentor mode, manage/
  delete) built; settings/onboarding are minimally restyled placeholders.
- **Pending / needs the user:** reference designs for history, settings,
  onboarding, and the paywall (paywall styling deliberately untouched until
  designed); a payment provider decision
  (Stripe unavailable in Turkey — evaluating Paddle/Lemon Squeezy/iyzico, so the
  Stripe routes may be swapped); no adaptive-tone logic yet (item 3 is just data).

## Hard rules

- **Palette only** (defined in `app/globals.css`; dark shell confirmed by
  `citadel_ui_spec.md`, superseding the original light Stone background): Night
  `#181A16` bg, Panel `#1D201A` lifted cards, Parchment `#E9E5DA` text on dark,
  Ash `#9B9789` secondary/rules, Marble `#F6F4F0` light input surfaces with Ink
  `#1F2320` text, Cream `#EFEADF` primary buttons, Patina `#5C6B4F` accent on
  light surfaces. **Ember `#8B3A3A` is reserved for the paywall alone** — never
  elsewhere. No gradients, no pure black/white, no purple/indigo/neon.
- **Shell**: thin wavy border framing every screen (`.wavy-frame`, global in
  `app/layout.js`) + the interlocking-rings mark (`components/ring-mark.js`)
  beside/above the Citadel title on every screen. Icons live in
  `components/icons.js` only: the sign-in set plus the nav symbols — book
  (meditations), gear (settings), arrow (back to today), door (sign out),
  plus/dots (meditations page), menu/hamburger (sections drawer). Nav
  triggers are symbols, not text; the one exception is the drawer's list
  itself, which uses text labels because sections need names.
- **No scrolling on primary screens**: splash, sign-in, onboarding, entry
  pages, and meditations never page-scroll. Entry pages scroll only their
  exchange region; meditations scrolls only its list. Settings and
  Who am I are the only pages that scroll.
- **Type:** Fraunces (display/title, never bold), Source Serif 4 (body), IBM Plex
  Mono (dates, labels, counters). It's a reading app.
- **Mentor response = manuscript marginalia**: italic Source Serif, indented, thin
  Patina left rule. Never a chat bubble.
- **Voice** (buttons, states, errors): plain, factual, no exclamation points, no
  urgency/hype. "Reflect" not "Submit"; state the paywall as fact.
- **Don't reintroduce a separate password-reset flow** — the emailed-code path is
  the reset. Don't re-add magic links.
- **Don't auto-send** the accountability note; keep it tap-to-send.
- The mentor **never praises**; that's the whole product. Don't soften the prompt.
- Motion is near-zero — a ~180ms fade (`animate-settle`) on the reply, nothing else.

## Workflow

Build in `citadel/`, `npm run build` before committing. DB changes: write a
migration file, apply it to the live project, sync `schema.sql`. New profile reads
use `select('*')` so an unapplied migration degrades gracefully instead of 500ing.
