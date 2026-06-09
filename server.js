'use strict';
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Web3Forms access key — set WEB3FORMS_KEY in Railway environment variables.
// Get your free key at https://web3forms.com — enter 850designandfab@gmail.com,
// click the verify link in your inbox, copy the key.
const W3F_KEY = process.env.WEB3FORMS_KEY;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ── Helpers ───────────────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toLocaleString('en-US', {
    timeZone:     'America/Chicago',
    weekday:      'short',
    year:         'numeric',
    month:        'short',
    day:          'numeric',
    hour:         '2-digit',
    minute:       '2-digit',
    timeZoneName: 'short',
  });
}

// ── POST /contact ─────────────────────────────────────────────────────────────
app.post('/contact', async (req, res) => {
  const { name, phone, email, service, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Name, email, and project details are required.' });
  }

  if (!W3F_KEY) {
    console.error('WEB3FORMS_KEY is not set in environment variables.');
    return res.status(500).json({ ok: false, error: 'Email not configured on server.' });
  }

  const ts = timestamp();

  // Structured message body — appears clearly in the email inbox
  const body = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'NEW QUOTE REQUEST',
    '850 Design and Fabrication',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `NAME       ${name}`,
    `PHONE      ${phone || 'Not provided'}`,
    `EMAIL      ${email}`,
    `SERVICE    ${service || 'Not specified'}`,
    '',
    'PROJECT DETAILS:',
    message,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Submitted  ${ts}`,
    `Reply to this email to reach ${name} directly.`,
  ].join('\n');

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key:   W3F_KEY,
        subject:      `Quote Request — ${service || 'General'} — ${name}`,
        from_name:    '850 D&F Website',
        replyto:      email,
        name,
        email,
        phone:        phone  || 'Not provided',
        service:      service || 'Not specified',
        message:      body,
        botcheck:     '',            // honeypot — leave blank
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`Form sent — ${name} <${email}> — ${service || 'general'}`);
      res.json({ ok: true });
    } else {
      console.error('Web3Forms error:', result.message);
      res.status(500).json({ ok: false, error: result.message || 'Failed to send.' });
    }

  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ ok: false, error: 'Network error sending email.' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`850 D&F server on :${PORT}`));
