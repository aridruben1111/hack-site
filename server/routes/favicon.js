const express = require('express');
const { validateTarget, withTimeout } = require('../utils/validate');

const router = express.Router();

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target, { allowIp: false });
  if (!v.ok) return res.status(400).json({ error: v.error });

  const domain = v.value;
  const candidates = [`https://${domain}/favicon.ico`, `http://${domain}/favicon.ico`];
  for (const url of candidates) {
    try {
      const resp = await withTimeout(fetch(url), 5000, 'favicon');
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        return res.json({
          target: domain,
          url,
          size: buf.length,
          contentType: resp.headers.get('content-type') || 'image/x-icon',
          dataUri: `data:${resp.headers.get('content-type') || 'image/x-icon'};base64,${buf.toString('base64')}`
        });
      }
    } catch (_) {}
  }
  res.status(404).json({ error: 'No favicon found' });
});

module.exports = router;
