// Transactional email via Brevo's HTTP API. Separate from Supabase's auth
// SMTP — this is the app sending on the user's behalf. Inactive (returns a
// clear reason) until BREVO_API_KEY and ACCOUNTABILITY_FROM_EMAIL are set.

export function isEmailConfigured() {
  return Boolean(
    process.env.BREVO_API_KEY && process.env.ACCOUNTABILITY_FROM_EMAIL,
  );
}

// Sends a plain-text email. `replyTo` lets the recipient reply straight to
// the user rather than to the app. Returns { ok } or { ok: false, error }.
export async function sendEmail({ to, toName, subject, text, replyTo, fromName }) {
  if (!isEmailConfigured()) {
    return { ok: false, error: "email-not-configured" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: process.env.ACCOUNTABILITY_FROM_EMAIL,
          name: fromName || "Citadel",
        },
        to: [{ email: to, name: toName || undefined }],
        replyTo: replyTo ? { email: replyTo } : undefined,
        subject,
        textContent: text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] brevo send failed", res.status, detail);
      return { ok: false, error: "send-failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] brevo request error", err);
    return { ok: false, error: "send-failed" };
  }
}
