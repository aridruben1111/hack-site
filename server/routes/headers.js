const express = require('express');
const { validateTarget, withTimeout } = require('../utils/validate');

const router = express.Router();

const SECURITY_HEADERS = [
  {
    name: 'Strict-Transport-Security',
    description: 'Forces browsers to use HTTPS only (HSTS).',
    recommendation: 'Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.'
  },
  {
    name: 'Content-Security-Policy',
    description: 'Mitigates XSS and data injection attacks.',
    recommendation: 'Define a CSP that whitelists trusted sources (e.g. `default-src \'self\'`).'
  },
  {
    name: 'X-Frame-Options',
    description: 'Protects against clickjacking.',
    recommendation: 'Set `X-Frame-Options: DENY` or `SAMEORIGIN` (or use CSP frame-ancestors).'
  },
  {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME-sniffing.',
    recommendation: 'Set `X-Content-Type-Options: nosniff`.'
  },
  {
    name: 'Referrer-Policy',
    description: 'Controls how much referrer info is sent.',
    recommendation: 'Set `Referrer-Policy: strict-origin-when-cross-origin`.'
  },
  {
    name: 'Permissions-Policy',
    description: 'Controls access to browser features.',
    recommendation: 'Restrict features you don\'t use, e.g. `Permissions-Policy: geolocation=(), camera=()`.'
  },
  {
    name: 'X-XSS-Protection',
    description: 'Legacy XSS filter (modern browsers ignore this).',
    recommendation: 'Set `X-XSS-Protection: 0` and rely on CSP instead.'
  },
  {
    name: 'Cross-Origin-Opener-Policy',
    description: 'Isolates browsing contexts.',
    recommendation: 'Set `Cross-Origin-Opener-Policy: same-origin`.'
  }
];

async function fetchHeaders(url) {
  const resp = await withTimeout(
    fetch(url, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': 'ReconTool/1.0 (+authorized-research)' } }),
    7000,
    'fetch headers'
  );
  const headers = {};
  resp.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return { status: resp.status, headers };
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target, { allowIp: false });
  if (!v.ok) return res.status(400).json({ error: v.error });

  const domain = v.value;
  const candidates = [`https://${domain}`, `http://${domain}`];
  let lastError = null;
  let result = null;
  let usedUrl = null;

  for (const url of candidates) {
    try {
      const r = await fetchHeaders(url);
      result = r;
      usedUrl = url;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!result) {
    return res.status(502).json({ error: 'HTTP header fetch failed', message: lastError ? lastError.message : 'unknown' });
  }

  const headersLower = {};
  for (const [k, val] of Object.entries(result.headers)) {
    headersLower[k.toLowerCase()] = val;
  }

  const analysis = SECURITY_HEADERS.map((h) => {
    const present = h.name.toLowerCase() in headersLower;
    return {
      name: h.name,
      present,
      value: present ? headersLower[h.name.toLowerCase()] : null,
      description: h.description,
      recommendation: present ? null : h.recommendation
    };
  });

  const presentCount = analysis.filter((a) => a.present).length;
  const score = Math.round((presentCount / SECURITY_HEADERS.length) * 100);

  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else if (score >= 20) grade = 'E';

  res.json({
    target: domain,
    url: usedUrl,
    status: result.status,
    headers: result.headers,
    security: { analysis, score, grade, presentCount, totalChecked: SECURITY_HEADERS.length },
    disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
  });
});

module.exports = router;
