# Citadel

A private evening-reflection journal. You write about what tested you today;
a Stoic mentor answers with a question, not encouragement — and it remembers
what you wrote before, and holds you to it.

The full loop is built: magic-link auth, persistent entries with mentor
memory (last five exchanges as context), a five-entry free limit, Stripe
subscription past it, and a history timeline.

## Setup

### 1. Supabase (auth + database)

1. Create a project at supabase.com.
2. Run `supabase/schema.sql` in the SQL editor — it creates `profiles`,
   `entries`, `responses`, row-level security, and the signup trigger.
3. Authentication → URL Configuration: set the Site URL to your app origin
   and add `<origin>/auth/callback` to the redirect allowlist.
4. Copy the project URL, anon key, and service-role key into `.env.local`.

Email magic link is the only sign-in method — no passwords to reset.

### 2. Stripe (paywall)

1. Create a product with one recurring monthly price; copy the price ID.
2. Add a webhook endpoint pointing at `<origin>/api/stripe-webhook`,
   subscribed to `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy the secret key, price ID, and webhook signing secret into
   `.env.local`. For local dev: `stripe listen --forward-to
   localhost:3000/api/stripe-webhook`.

### 3. Run

```bash
npm install
cp .env.example .env.local   # fill in the keys above
npm run dev
```

Without an Anthropic key, set `CITADEL_MOCK_MENTOR=1` to exercise the loop
with a canned placeholder response.

## How it fits together

- `lib/mentor-prompt.js` — the mentor's voice. This is the product. After
  any edit, test with a self-congratulatory entry and a self-pitying one;
  it must push back on both.
- `app/api/reflect/route.js` — the core loop: auth check → free-limit
  check → fetch last five exchanges → Claude call → save entry + response.
- `app/api/stripe-webhook/route.js` — the only writer of
  `subscription_status` (service-role client; everything else is RLS-bound).
- `app/globals.css` — the design token set (Stone/Marble/Ink/Ash/Patina/
  Ember, Fraunces / Source Serif 4 / IBM Plex Mono). Ember appears exactly
  once, at the paywall.
- Free limit lives in `lib/limits.js` (five entries), enforced server-side.

## Deploy

Vercel: import the repo (root directory `citadel/`), add every var from
`.env.example`, set `NEXT_PUBLIC_APP_URL` to the production domain, then
point the Stripe webhook and the Supabase redirect allowlist at that domain.

## Deliberately absent

Streaks, tags, moods, notifications, community. The differentiation is the
mentor's voice and memory, not feature count.
