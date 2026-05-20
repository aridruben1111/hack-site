const express = require('express');
const dns = require('dns').promises;
const { validateTarget, isIP, withTimeout } = require('../utils/validate');

const router = express.Router();

async function fetchGeo(ip) {
  const fields = 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,reverse,mobile,proxy,hosting,query';
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`;
  const resp = await withTimeout(fetch(url), 7000, 'ip-api');
  if (!resp.ok) throw new Error(`ip-api returned ${resp.status}`);
  const data = await resp.json();
  if (data.status !== 'success') throw new Error(data.message || 'ip-api lookup failed');
  return data;
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target);
  if (!v.ok) return res.status(400).json({ error: v.error });

  let ip = v.value;
  let resolvedFrom = null;

  try {
    if (!isIP(ip)) {
      const addresses = await withTimeout(dns.resolve4(ip), 5000, 'dns.resolve4');
      if (!addresses || !addresses.length) throw new Error('No A records found');
      resolvedFrom = ip;
      ip = addresses[0];
    }

    const geo = await fetchGeo(ip);

    const flags = {
      isProxy: !!geo.proxy,
      isHosting: !!geo.hosting,
      isMobile: !!geo.mobile,
      likelyDatacenter: !!geo.hosting,
      likelyVpnOrTor: !!geo.proxy
    };

    res.json({
      ip,
      resolvedFrom,
      geo,
      flags,
      disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
    });
  } catch (err) {
    res.status(502).json({ error: 'IP lookup failed', message: err.message });
  }
});

module.exports = router;
