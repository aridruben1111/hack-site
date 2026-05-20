const express = require('express');
const whois = require('whois');
const { validateTarget, withTimeout } = require('../utils/validate');

const router = express.Router();

function lookup(target) {
  return new Promise((resolve, reject) => {
    whois.lookup(target, { timeout: 7000 }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function parseWhois(raw) {
  const result = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9 _\-/]+?):\s*(.+?)\s*$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (!value) continue;
    if (result[key]) {
      if (!Array.isArray(result[key])) result[key] = [result[key]];
      result[key].push(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function pickField(parsed, keys) {
  for (const k of keys) {
    if (parsed[k]) return Array.isArray(parsed[k]) ? parsed[k][0] : parsed[k];
  }
  return null;
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target);
  if (!v.ok) return res.status(400).json({ error: v.error });

  try {
    const raw = await withTimeout(lookup(v.value), 8000, 'whois');
    const parsed = parseWhois(raw);

    const summary = {
      registrar: pickField(parsed, ['registrar', 'sponsoring_registrar']),
      registrant: pickField(parsed, ['registrant_name', 'registrant_organization', 'registrant']),
      creationDate: pickField(parsed, ['creation_date', 'created', 'created_on', 'registered_on']),
      expiryDate: pickField(parsed, ['registry_expiry_date', 'expiration_date', 'expires_on', 'expiry_date']),
      updatedDate: pickField(parsed, ['updated_date', 'last_updated', 'changed']),
      nameServers: parsed.name_server || parsed.nserver || null,
      status: parsed.domain_status || parsed.status || null
    };

    res.json({
      target: v.value,
      summary,
      parsed,
      raw,
      disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
    });
  } catch (err) {
    res.status(502).json({ error: 'WHOIS lookup failed', message: err.message });
  }
});

module.exports = router;
