const express = require('express');
const { isHostSafe } = require('recon-security');
const { validateTarget, withTimeout } = require('../utils/validate');

const router = express.Router();

const allowPrivateTargets = process.env.ALLOW_PRIVATE_TARGETS === 'true';

async function fetchCrtSh(domain) {
  const url = `https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`;
  const resp = await withTimeout(
    fetch(url, { headers: { 'User-Agent': 'ReconTool/1.0 (+authorized-research)' } }),
    8000,
    'crt.sh'
  );
  if (!resp.ok) throw new Error(`crt.sh returned ${resp.status}`);
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error('crt.sh returned non-JSON response');
  }
}

async function liveCheck(host, timeout = 4000) {
  // Skip discovered subdomains that resolve to non-public addresses so the
  // enumeration cannot be used to probe internal hosts.
  if (!allowPrivateTargets && !(await isHostSafe(host))) {
    return { live: false, status: null, url: null, skipped: 'non-public address' };
  }
  const tryUrl = async (url) => {
    try {
      const r = await withTimeout(
        fetch(url, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': 'ReconTool/1.0' } }),
        timeout,
        'head'
      );
      return { live: true, status: r.status, url };
    } catch (_) {
      return null;
    }
  };
  const https = await tryUrl(`https://${host}`);
  if (https) return https;
  const http = await tryUrl(`http://${host}`);
  if (http) return http;
  return { live: false, status: null, url: null };
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target, { allowIp: false });
  if (!v.ok) return res.status(400).json({ error: v.error });

  const domain = v.value;
  const validate = req.query.validate !== '0';

  try {
    const records = await fetchCrtSh(domain);
    const map = new Map();
    for (const r of records) {
      const names = (r.name_value || '').split('\n');
      for (const name of names) {
        const clean = name.trim().toLowerCase().replace(/^\*\./, '');
        if (!clean || !clean.endsWith(domain)) continue;
        if (!map.has(clean)) {
          map.set(clean, {
            name: clean,
            issuer: r.issuer_name || null,
            firstSeen: r.entry_timestamp || r.not_before || null,
            lastSeen: r.not_after || null
          });
        } else {
          const ex = map.get(clean);
          if (r.entry_timestamp && (!ex.firstSeen || r.entry_timestamp < ex.firstSeen)) {
            ex.firstSeen = r.entry_timestamp;
          }
        }
      }
    }

    const subdomains = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

    let liveResults = subdomains;
    if (validate) {
      const limit = Math.min(subdomains.length, 50);
      const slice = subdomains.slice(0, limit);
      const checked = await Promise.all(
        slice.map(async (s) => ({ ...s, ...(await liveCheck(s.name)) }))
      );
      liveResults = checked.concat(
        subdomains.slice(limit).map((s) => ({ ...s, live: null, status: null, url: null }))
      );
    }

    res.json({
      target: domain,
      total: subdomains.length,
      validatedCount: validate ? Math.min(subdomains.length, 50) : 0,
      subdomains: liveResults,
      disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
    });
  } catch (err) {
    res.status(502).json({ error: 'Subdomain enumeration failed', message: err.message });
  }
});

module.exports = router;
