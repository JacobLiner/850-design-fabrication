'use strict';
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const W3F_KEY = process.env.WEB3FORMS_KEY;

// ── 1. Remove framework fingerprint ──────────────────────────────────────────
app.disable('x-powered-by');

// ── 2. Security headers on every response ────────────────────────────────────
app.use((req, res, next) => {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options',  'nosniff');
  // Block this site from being embedded in iframes (clickjacking)
  res.setHeader('X-Frame-Options',         'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  // Control referrer info sent to third parties
  res.setHeader('Referrer-Policy',         'strict-origin-when-cross-origin');
  // Restrict browser feature access
  res.setHeader('Permissions-Policy',      'camera=(), microphone=(), geolocation=()');
  // Legacy XSS filter (older browsers)
  res.setHeader('X-XSS-Protection',        '1; mode=block');
  next();
});

// ── 3. Body size limit (16 KB max — plenty for a contact form) ────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// ── 4. Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── 5. Rate limiter — 5 submissions per IP per 15 minutes ────────────────────
const RATE_MAX    = 5;
const RATE_WINDOW = 15 * 60 * 1000;
const rateStore   = new Map();

// Purge stale entries every 30 minutes so memory doesn't grow indefinitely
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of rateStore) {
    if (now > rec.resetAt) rateStore.delete(ip);
  }
}, 30 * 60 * 1000).unref();

function rateLimit(req, res, next) {
  const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = rateStore.get(ip);

  if (!rec || now > rec.resetAt) {
    rateStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return next();
  }
  if (rec.count >= RATE_MAX) {
    return res.status(429).json({
      ok: false,
      error: 'Too many requests. Please try again in 15 minutes.',
    });
  }
  rec.count++;
  next();
}

// ── 6. Input validation helpers ───────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/;
const MAX = { name: 120, phone: 30, email: 254, service: 80, message: 3000 };

function clean(val) {
  return String(val ?? '').trim();
}

// ── 7. Timestamp ──────────────────────────────────────────────────────────────
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
app.post('/contact', rateLimit, async (req, res) => {

  // Sanitise and trim all inputs
  const name    = clean(req.body.name);
  const phone   = clean(req.body.phone);
  const email   = clean(req.body.email);
  const service = clean(req.body.service);
  const message = clean(req.body.message);

  // Required fields
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Name, email, and project details are required.' });
  }

  // Email format
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  // Length limits — prevent oversized payloads reaching Web3Forms
  if (
    name.length    > MAX.name    ||
    phone.length   > MAX.phone   ||
    email.length   > MAX.email   ||
    service.length > MAX.service ||
    message.length > MAX.message
  ) {
    return res.status(400).json({ ok: false, error: 'One or more fields exceed maximum length.' });
  }

  // Key check
  if (!W3F_KEY) {
    console.error('WEB3FORMS_KEY is not configured.');
    // Vague on purpose — don't expose config state to clients
    return res.status(500).json({ ok: false, error: 'Contact form is not available. Please call or email us directly.' });
  }

  const ts = timestamp();

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
    const w3fRes = await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: W3F_KEY,
        subject:    `Quote Request — ${service || 'General'} — ${name}`,
        from_name:  '850 D&F Website',
        replyto:    email,
        name,
        email,
        phone:      phone   || 'Not provided',
        service:    service || 'Not specified',
        message:    body,
        botcheck:   '',   // honeypot — must stay empty
      }),
    });

    const result = await w3fRes.json();

    if (result.success) {
      console.log(`Form sent — ${name} <${email}>`);
      res.json({ ok: true });
    } else {
      // Log internally but don't expose Web3Forms error text to the client
      console.error('Web3Forms rejected submission:', result.message);
      res.status(500).json({ ok: false, error: 'Failed to send. Please call or email us directly.' });
    }

  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ ok: false, error: 'Network error. Please call or email us directly.' });
  }
});

// ── 404 — serve index for any unknown route ───────────────────────────────────
app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`850 D&F server on :${PORT}`));
