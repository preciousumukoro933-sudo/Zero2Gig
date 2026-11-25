// Shared email sender (Brevo). Needs BREVO_API_KEY and SENDER_EMAIL in Vercel.
// SENDER_EMAIL must be a sender you verified inside Brevo. SENDER_NAME is optional.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://lzhinqwkakccpmlbfmjp.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6aGlucXdrYWtjY3BtbGJmbWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNzU4MjcsImV4cCI6MjExMDY1MTgyN30.nIrPLXnlKzIlkmI3RJgxISOIZ5Qw2JtwpdmCj4P2Iq0";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function isConfigured() { return Boolean(process.env.BREVO_API_KEY && process.env.SENDER_EMAIL); }

// Links in emails always point to the real site. Never built from the request, which could be faked.
function siteUrl() { return (process.env.SITE_URL || "https://zero2gig.vercel.app").replace(/\/$/, ""); }

// Call a Supabase database function. `token` is the learner's session token, or empty for the public key.
async function rpc(fn, args, token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args || {})
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((data && data.message) || `Database error ${r.status}`); e.status = r.status; throw e; }
  return data;
}

function template({ name, message, buttonText, url }) {
  const paras = String(message).split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#161A33">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#F3F4FA;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#4A3AFF;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">Zero2Gig</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#161A33">Hi ${esc(name || "there")},</p>
${paras}
<p style="margin:24px 0 8px"><a href="${esc(url)}" style="display:inline-block;background:#4A3AFF;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:999px;font-size:16px">${esc(buttonText || "Continue learning")}</a></p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #DDE0EE;font-size:12px;line-height:1.5;color:#5B6185">You’re getting this because you signed up at Zero2Gig. To stop these emails, open <a href="${esc(url)}/#/account" style="color:#4A3AFF">your account</a> and turn off email reminders.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendOne({ to, name, subject, message, buttonText, url }) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: process.env.SENDER_NAME || "Zero2Gig", email: process.env.SENDER_EMAIL },
      to: [{ email: to, name: name || undefined }],
      subject,
      htmlContent: template({ name, message, buttonText, url }),
      textContent: `Hi ${name || "there"},\n\n${message}\n\n${url}\n\nTo stop these emails, turn off email reminders in your account: ${url}/#/account`
    })
  });
  if (!r.ok) { const t = await r.text(); const e = new Error(`Brevo ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e; }
}

// Sends to many people, 5 at a time. Returns { sent, failed, firstError }.
async function sendMany(recipients, mail) {
  let sent = 0, failed = 0, firstError = "", i = 0;
  async function worker() {
    while (i < recipients.length) {
      const rcp = recipients[i++];
      try { await sendOne({ ...mail, to: rcp.email, name: rcp.name }); sent++; }
      catch (e) { failed++; if (!firstError) firstError = e.message; if (e.status === 401 || e.status === 403) { i = recipients.length; } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, recipients.length) }, worker));
  return { sent, failed, firstError };
}

module.exports = { isConfigured, siteUrl, rpc, sendMany };
