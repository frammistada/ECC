import webpush from "web-push";

// Web-push sender. VAPID keys authenticate this server to the browser push
// services (FCM for Chrome/Android, Mozilla's, etc.); they are free to
// generate (`npx web-push generate-vapid-keys`) and carry no per-message
// cost. The public key is also exposed to the client as
// NEXT_PUBLIC_VAPID_PUBLIC_KEY so PushManager.subscribe can bind to it.
//
// Configuration is lazy and cached: if the keys aren't set the feature is
// simply "not configured" and callers degrade gracefully rather than 500.

let configured = null;

export function isPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      (process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_APP_URL),
  );
}

function ensureConfigured() {
  if (configured) return true;
  if (!isPushConfigured()) return false;
  const subject =
    process.env.VAPID_SUBJECT ||
    // A mailto: or https: subject is required; fall back to the app URL.
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://localhost";
  webpush.setVapidDetails(
    subject,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

// Sends one notification to one subscription. Returns:
//   { ok: true }                     delivered (queued by the push service)
//   { ok: false, gone: true }        endpoint is dead — caller should prune
//   { ok: false, gone: false }       transient/other failure
// `payload` is a plain object serialized to the notification.
export async function sendPush(subscription, payload) {
  if (!ensureConfigured()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 12 * 60 * 60 }, // a daily nudge is stale after ~half a day
    );
    return { ok: true };
  } catch (err) {
    // 404/410 mean the subscription is gone (unsubscribed, expired, or the
    // browser rotated it) — the caller deletes it.
    const gone = err?.statusCode === 404 || err?.statusCode === 410;
    if (!gone) console.error("[push] send failed", err?.statusCode, err?.body);
    return { ok: false, gone };
  }
}
