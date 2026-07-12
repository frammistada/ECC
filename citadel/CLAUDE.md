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
  `components/nav-menu.js`) opens a left drawer of app sections. `NavMenu`
  takes a `subscribed` prop and shows two section sets. No-Mentor
  Journaling (`/journal`) is a subscriber-only room hidden entirely from
  free users. Reminders (`/reminders`) is subscriber-only too, but shows
  as a grayed "soon" item for free users (it was a placeholder long before
  it shipped) and becomes a live link once they subscribe. Any remaining
  href-less section renders grayed with a "soon" tag.
  Below the sections: "export my data" — a plain anchor to `/api/export`.
  To Myself is live (Milestones moved inside it; /milestones remains as
  the spread's own page, reached from To Myself's milestone rows).
- **Data export (trust feature — never gate it).** `GET /api/export`
  streams every entry + mentor response (all pages, oldest first) as a
  plain-text download (`lib/export.js` builds the text). User-written
  content only — no pattern_summary, no open_loops, no instrumentation.
  Free on every tier, no rate limit, by design.
- **Micro check-ins (free — never gate, never count against the paywall).**
  One tap (held/slipped/neither) + optional line (≤140 chars) via
  `/api/checkin`, stored as `entries.entry_type = 'checkin'` with
  `checkin_state`. Same short-term memory + pattern summary as a full
  entry, but the reply is short and light (`kind: 'checkin'` addendum in
  `lib/mentor-prompt.js` — no full Socratic treatment) and no open-loop
  extraction runs. Reachable even when the reflection paywall is up. All
  paywall/milestone counts filter `entry_type = 'reflection'`.
- **No-mentor journaling (subscribers only — its own room, never a toggle
  on the mentor composer).** `/journal` (`app/journal/page.js`), reached
  only from the drawer and only by subscribers (server also redirects a
  direct visit by a non-subscriber to `/`). The mentor's composer is
  always mentor-on — there is deliberately no opt-out toggle there; you
  choose the journal by entering the room. The room reuses
  `components/journal.js` in `noMentorRoom` mode (toggle removed, check-in
  and accountability suppressed, "Save" not "Reflect", neutral copy). It
  posts to `/api/reflect` with `noMentor: true`; the route re-checks the
  subscription (403 otherwise), makes **no Claude call and writes no
  responses row**, and saves the entry as `entries.entry_type = 'journal'`
  with **`meditation_id` null** — so journal entries belong to no page,
  never appear on the mentor's today screen, and never surface in the
  meditations list (they cannot be reopened with the mentor). The room is
  one continuous log, selected by type. Entries still feed pattern_summary,
  open-loop extraction, and the activity log (`mentor_mode: 'none'`) —
  memory is the moat regardless of mode — and are excluded from
  paywall/milestone counts, which filter `entry_type = 'reflection'`. In
  the log each entry is the bubble alone, stamped `· no mentor` beside the
  time so chosen silence can't be mistaken for a failed reply. Deliberately
  secondary: no first-use interstitial, no upsell for free tiers, plain
  wording only.
- **Reminders (subscribers only — web push, `/reminders` room).** Three
  reminder types, all sharing one push subscription + one hourly cron.
  UI lives in the Reminders drawer room (`app/reminders/page.js` +
  `components/reminders-form.js`), not settings — matches the drawer-room
  pattern. The form posts the full desired state of all three types to
  `/api/reminders` in one snapshot; enabling any of them asks Notification
  permission, registers `/public/sw.js`, subscribes via `PushManager`
  (VAPID public key from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`), stores the
  subscription in `push_subscriptions` (one row per device), and requires
  a subscription (403 otherwise). `lib/push.js` sends via `web-push` with
  a VAPID keypair. The three types:
  - **Reflection** — one push/day at `reminder_time` ("Something tested
    you today."). The original; single time, single message.
  - **Goal** — one push/day at `goal_reminder_time` of the user's stated
    goal, taken from **`profiles.aim`** (the "what you're trying to
    accomplish" field in Who am I — an already-explicit user-written goal,
    so no new field). If `aim` is empty the cron skips it and the room
    shows a hint linking to Who am I.
  - **Quote** — N stoic-toned lines/day (`quote_reminder_count`, default
    1, **max 6**), from the static `QUOTE_BANK` in `lib/reminders.js`
    (original lines in the mentor's voice — no exclamation, no philosopher
    citations; a config array, not a table, so the cron needs no DB read
    for content). Slots start at wake and are spaced evenly across the
    **waking window** (`profiles.wake_time`/`sleep_time`, defaults
    07:00–23:00; migration 013), so none fire while the user is asleep —
    e.g. count 3 with a 7:00–23:00 day lands at 7:00 / 12:20 / 17:40. If
    the bedtime isn't after wake (past-midnight), the window clamps to
    end-of-day so slots stay within one calendar day. `slots_sent` tracks
    how many of today's slots have fired so the hourly cron sends at most
    one per slot and never bursts to catch up. The reminders room shows a
    live preview of the day's slot times.

  All the due/slot logic is pure and unit-tested in `lib/reminders.js`
  (`isReminderDue`, `isGoalReminderDue`, `quoteReminderStatus`,
  `quoteSlots`). Each type carries its own `*_last_sent` guard and a
  distinct notification `tag`, so a reflection, goal, and quote reminder
  can arrive in the same tick without collapsing. A "send a test of each
  now" button (`/api/reminders/test`) previews every enabled type on the
  user's own devices. **Scheduling:** `vercel.json` runs
  `/api/cron/reminders`; it selects users with any type enabled
  (`.or(...)`), sends whatever is due, prunes dead endpoints (404/410),
  and stamps the per-type guards. Cron is Bearer-protected by
  `CRON_SECRET`, fails closed if unset, reads across users with the
  service role. **The logic is designed for an hourly cron** (`0 * * * *`)
  so per-user times and the multiple quote slots fire close to on time —
  but the schedule is currently **once daily** (`0 18 * * *`) because the
  Vercel project is on the **Hobby** plan, which rejects sub-daily crons
  at deploy. On Hobby, reminders effectively fire in that one daily run
  for whoever is due; **flip `vercel.json` back to `0 * * * *` once on
  Pro** to restore the intended behavior. **Timezone:** all three share `reminder_timezone`
  (wall-clock "HH:MM", IANA, "UTC" fallback). **Platform:** Android
  Chrome + desktop Chrome/Firefox/Edge work; **iOS is out of scope** (web
  push there needs an installed PWA on 16.4+); a future Android TWA wrap
  surfaces these as native notifications. **Infra/cost:** the intended
  hourly cron needs Vercel **Pro** (Hobby caps crons at once-daily, so the
  schedule is daily for now — see Scheduling above); the push transport
  itself is free. All notifications open `/` on tap (SW
  `notificationclick`). PWA surface: `manifest.webmanifest`,
  `public/icons/*`, push-only service worker.
- **Consequence mechanic (premium-flagged).** Two triggers beyond the
  original slip toggle: a `slipped` check-in offers the same draft
  (deliberate — same signal), and a fully silent yesterday (no entry, no
  check-in; fixed UTC day, no timezone stored) shows a missed-day draft
  banner on the entry screen — only for users with history, a contact set,
  and email configured. Draft-and-tap always; "let it pass" dismisses per
  UTC day (localStorage). Messages composed server-side only
  (`composeMissedDayMessage`); `kind: 'missed'` on
  `/api/accountability/send`. Gated by `GATES.consequence` in
  `lib/limits.js` (false until the payment wall lands).
- **Milestones (premium-flagged).** `/milestones` (drawer): at 30
  reflections, then 90, then every 90, the first entry+response is shown
  beside the latest. Entry-count based, not day based — gaps shouldn't
  push it away. Revisitable page, no popup. Gated by `GATES.milestones`
  (false until the payment wall lands). Design: the count as a large
  Fraunces numeral, a thin patina rule filling toward the next look back,
  then the two entries as facing panel cards.
- **Compose → chat.** The entry screen has two views (`components/
  journal.js`). Compose: the rotating panel (below) + the entry box —
  no history list. The moment something is sent, the screen becomes the
  conversation: the user's words in right-aligned marble bubbles, the
  mentor's replies still marginalia on the left (the no-chat-bubble rule
  applies to the mentor only), composer docked at the bottom, only the
  message region scrolling. Meditation detail pages open directly in
  chat view (`startInChat`). Compose offers a "read today's conversation"
  link when the page already has exchanges.
- **"To Myself" (premium-flagged, GATES.toMyself).** `/to-myself` in the
  drawer: one timeline, newest first — weekly notes interleaved with
  milestone markers (compact rows linking to /milestones, stamped on the
  day the Nth reflection was written). Weekly notes: one model call per
  user per calendar week (Monday-start UTC; `lib/insights.js`), generated
  lazily on visit for the last completed week, stored in
  `weekly_insights` and never regenerated — a user-facing note on a
  bounded week, distinct from `pattern_summary`. Skips weeks with fewer
  than 3 entries+check-ins; check-in-only weeks generate but the prompt
  says to stay short. Qualitative and written only — no streaks, charts,
  or scores here, ever. Page never scrolls; only the list does.
- **The panel.** Where the history box sat, compose shows one quiet card
  at a time (`lib/panel.js` builds 8–12 from data already fetched — no
  model calls: stoic line, evening practice, pattern note, mentor's last
  question, open thread, cadence/streak, ledger, day count, check-in
  balance, milestone progress, the user's aim). `components/
  mentor-panel.js` rotates every 90s with a ~700ms crossfade — the one
  sanctioned motion beyond animate-settle. Never two cards at once.
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
age/aim/about_note, reminder_enabled/reminder_time/reminder_timezone/
reminder_last_sent, goal_reminder_enabled/goal_reminder_time/
goal_reminder_last_sent, quote_reminder_enabled/quote_reminder_count/
quote_reminder_last_sent/quote_reminder_slots_sent, wake_time/sleep_time) ·
`meditations` (user_id, name, mentor_mode nullable, auto_day, created_at) ·
`push_subscriptions` (user_id, endpoint unique, p256dh, auth — web-push
devices for the daily reminder) ·
`entries` (user_id, meditation_id, content, entry_type
'reflection'|'checkin'|'journal', checkin_state) · `responses` (entry_id,
content — none for 'journal' entries; 'journal' rows also have
`meditation_id` null) ·
`open_loops` (user_id, entry_id, description, resolved, resolved_at) ·
`weekly_insights` (user_id, week_start unique-per-user, content,
entry_count, checkin_count) ·
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
  exchange region; meditations scrolls only its list; milestones scrolls
  only its first/latest spread; to-myself scrolls only its timeline.
  Settings and Who am I are the only pages that scroll.
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
