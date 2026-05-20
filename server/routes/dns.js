const express = require('express');
const dns = require('dns').promises;
const { validateTarget, withTimeout } = require('../utils/validate');

const router = express.Router();

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];

async function resolveType(domain, type) {
  try {
    const records = await withTimeout(dns.resolve(domain, type), 6000, `dns ${type}`);
    return { type, records: normalize(type, records), error: null };
  } catch (err) {
    return { type, records: [], error: err.code || err.message };
  }
}

function normalize(type, records) {
  if (!records) return [];
  if (type === 'TXT') {
    return records.map((r) => ({ value: Array.isArray(r) ? r.join('') : String(r) }));
  }
  if (type === 'MX') {
    return records.map((r) => ({ exchange: r.exchange, priority: r.priority }));
  }
  if (type === 'SOA') {
    return [records];
  }
  return records.map((r) => ({ value: typeof r === 'string' ? r : JSON.stringify(r) }));
}

function detectEmailSecurity(txtRecords) {
  const flat = txtRecords.map((r) => r.value || '').join(' ').toLowerCase();
  return {
    spf: txtRecords.some((r) => (r.value || '').toLowerCase().startsWith('v=spf1')),
    dmarc: flat.includes('v=dmarc1'),
    dkim: flat.includes('dkim') || flat.includes('v=dkim1')
  };
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target, { allowIp: false });
  if (!v.ok) return res.status(400).json({ error: v.error });

  const domain = v.value;
  const results = await Promise.all(RECORD_TYPES.map((t) => resolveType(domain, t)));

  const byType = {};
  for (const r of results) byType[r.type] = r;

  let dmarcRecord = null;
  try {
    const dmarcTxt = await withTimeout(dns.resolveTxt(`_dmarc.${domain}`), 4000, 'dmarc lookup');
    dmarcRecord = dmarcTxt.map((parts) => parts.join(''));
  } catch (_) {
    dmarcRecord = null;
  }

  const security = detectEmailSecurity(byType.TXT.records);
  if (dmarcRecord && dmarcRecord.length) security.dmarc = true;

  res.json({
    domain,
    records: byType,
    emailSecurity: security,
    dmarcRecord,
    disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
  });
});

module.exports = router;
