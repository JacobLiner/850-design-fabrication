'use strict';
const express    = require('express');
const nodemailer = require('nodemailer');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const DEST_EMAIL = '850designandfab@gmail.com';
const SMTP_USER  = process.env.EMAIL_USER || DEST_EMAIL;
const SMTP_PASS  = process.env.EMAIL_PASS;   // set in Railway environment

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timestamp() {
  return new Date().toLocaleString('en-US', {
    timeZone:    'America/Chicago',
    weekday:     'short',
    year:        'numeric',
    month:       'short',
    day:         'numeric',
    hour:        '2-digit',
    minute:      '2-digit',
    timeZoneName:'short',
  });
}

// ── POST /contact ────────────────────────────────────────────────────────────
app.post('/contact', async (req, res) => {
  const { name, phone, email, service, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Name, email, and project details are required.' });
  }

  if (!SMTP_PASS) {
    console.error('EMAIL_PASS is not set in environment variables.');
    return res.status(500).json({ ok: false, error: 'Email not configured on server.' });
  }

  const ts      = timestamp();
  const subject = `Quote Request — ${service || 'General'} — ${name}`;

  // ── Plain text version ───────────────────────────────────────────────────
  const text = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'NEW QUOTE REQUEST',
    '850 Design and Fabrication',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `NAME      ${name}`,
    `PHONE     ${phone || 'Not provided'}`,
    `EMAIL     ${email}`,
    `SERVICE   ${service || 'Not specified'}`,
    '',
    '──── PROJECT DETAILS ─────────────────',
    message,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Submitted  ${ts}`,
    `Reply to this email to reach ${name} directly.`,
  ].join('\n');

  // ── HTML version ─────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f2f0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f0;padding:32px 16px;">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">

    <!-- Header bar -->
    <tr>
      <td style="background:#090A0B;padding:26px 36px;">
        <p style="margin:0 0 5px;color:#AB8437;font-size:10px;letter-spacing:4px;text-transform:uppercase;font-family:Arial,sans-serif;">New Quote Request</p>
        <p style="margin:0;color:#F8F7F4;font-size:20px;font-weight:700;font-family:Arial,sans-serif;letter-spacing:0.3px;">850 Design and Fabrication</p>
      </td>
    </tr>

    <!-- Contact fields -->
    <tr>
      <td style="padding:32px 36px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">

          <tr>
            <td style="padding:11px 0;border-bottom:1px solid #ebebeb;width:88px;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;font-weight:700;vertical-align:top;font-family:Arial,sans-serif;">Name</td>
            <td style="padding:11px 0;border-bottom:1px solid #ebebeb;font-size:15px;color:#111;font-family:Arial,sans-serif;">${esc(name)}</td>
          </tr>

          <tr>
            <td style="padding:11px 0;border-bottom:1px solid #ebebeb;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;font-weight:700;vertical-align:top;font-family:Arial,sans-serif;">Phone</td>
            <td style="padding:11px 0;border-bottom:1px solid #ebebeb;font-size:15px;color:#111;font-family:Arial,sans-serif;">${esc(phone || 'Not provided')}</td>
          </tr>

          <tr>
            <td style="padding:11px 0;border-bottom:1px solid #ebebeb;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;font-weight:700;vertical-align:top;font-family:Arial,sans-serif;">Email</td>
            <td style="padding:11px 0;border-bottom:1px solid #ebebeb;font-size:15px;font-family:Arial,sans-serif;">
              <a href="mailto:${esc(email)}" style="color:#AB8437;text-decoration:none;">${esc(email)}</a>
            </td>
          </tr>

          <tr>
            <td style="padding:11px 0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;font-weight:700;vertical-align:top;font-family:Arial,sans-serif;">Service</td>
            <td style="padding:11px 0;font-size:15px;color:#111;font-family:Arial,sans-serif;">${esc(service || 'Not specified')}</td>
          </tr>

        </table>
      </td>
    </tr>

    <!-- Project details -->
    <tr>
      <td style="padding:28px 36px 0;">
        <p style="margin:0 0 10px;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;font-weight:700;font-family:Arial,sans-serif;">Project Details</p>
        <div style="background:#f8f7f4;border-left:3px solid #AB8437;padding:16px 20px;font-size:15px;color:#333;line-height:1.7;white-space:pre-wrap;font-family:Arial,sans-serif;">${esc(message)}</div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:28px 36px 32px;">
        <p style="margin:0;font-size:11px;color:#bbb;font-family:Arial,sans-serif;">Submitted: ${ts}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#bbb;font-family:Arial,sans-serif;">Reply to this email to reach ${esc(name)} directly.</p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from:    `"850 D&F Website" <${SMTP_USER}>`,
      to:      DEST_EMAIL,
      replyTo: email,
      subject,
      text,
      html,
    });

    console.log(`Contact form sent — ${name} <${email}> — ${service || 'general'}`);
    res.json({ ok: true });

  } catch (err) {
    console.error('sendMail error:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to send. Please call or email us directly.' });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`850 D&F server running on port ${PORT}`));
