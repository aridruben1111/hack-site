const express = require('express');
const { validateTarget, withTimeout } = require('../utils/validate');

const router = express.Router();

// Only allow known image MIME types into the data: URI; fall back to a
// safe default for anything else the scanned server reports.
const ALLOWED_IMAGE_TYPES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
  'image/bmp'
]);

function safeImageType(raw) {
  const type = String(raw || '').split(';')[0].trim().toLowerCase();
  return ALLOWED_IMAGE_TYPES.has(type) ? type : 'image/x-icon';
}

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
        const contentType = safeImageType(resp.headers.get('content-type'));
        return res.json({
          target: domain,
          url,
          size: buf.length,
          contentType,
          dataUri: `data:${contentType};base64,${buf.toString('base64')}`
        });
      }
    } catch (_) {}
  }
  res.status(404).json({ error: 'No favicon found' });
});

module.exports = router;
