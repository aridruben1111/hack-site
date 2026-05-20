const express = require('express');
const { validateTarget, withTimeout } = require('../utils/validate');

const router = express.Router();

const SIGNATURES = [
  { name: 'WordPress', category: 'CMS', body: [/wp-content\//i, /wp-includes\//i, /<meta name="generator"[^>]*WordPress/i] },
  { name: 'Joomla', category: 'CMS', body: [/<meta name="generator"[^>]*Joomla/i, /\/media\/jui\//i] },
  { name: 'Drupal', category: 'CMS', body: [/Drupal\.settings/i, /<meta name="Generator"[^>]*Drupal/i] },
  { name: 'Shopify', category: 'CMS', body: [/cdn\.shopify\.com/i], headers: { 'x-shopify-stage': /.*/ } },
  { name: 'Magento', category: 'CMS', body: [/Mage\.Cookies/i, /\/skin\/frontend\//i] },
  { name: 'Ghost', category: 'CMS', body: [/<meta name="generator"[^>]*Ghost/i] },
  { name: 'React', category: 'Framework', body: [/<div id="root">/i, /__REACT_DEVTOOLS_GLOBAL_HOOK__/i, /react(-dom)?(\.production)?\.min\.js/i] },
  { name: 'Vue.js', category: 'Framework', body: [/<div id="app"[^>]*data-v-/i, /vue(\.runtime)?(\.min)?\.js/i] },
  { name: 'Angular', category: 'Framework', body: [/ng-version="/i, /ng-app=/i] },
  { name: 'Next.js', category: 'Framework', body: [/\/_next\//i, /__NEXT_DATA__/i] },
  { name: 'Nuxt.js', category: 'Framework', body: [/__NUXT__/i, /\/_nuxt\//i] },
  { name: 'Svelte', category: 'Framework', body: [/svelte-/i] },
  { name: 'Gatsby', category: 'Framework', body: [/___gatsby/i, /gatsby-/i] },
  { name: 'jQuery', category: 'Library', body: [/jquery(-\d|\.min)?\.js/i] },
  { name: 'Bootstrap', category: 'Library', body: [/bootstrap(\.min)?\.(js|css)/i] },
  { name: 'Tailwind CSS', category: 'Library', body: [/tailwind(\.min)?\.css/i, /class="[^"]*(?:flex|grid|bg-\w+|text-\w+)/] },
  { name: 'nginx', category: 'Server', headers: { server: /nginx/i } },
  { name: 'Apache', category: 'Server', headers: { server: /apache/i } },
  { name: 'IIS', category: 'Server', headers: { server: /iis/i } },
  { name: 'Caddy', category: 'Server', headers: { server: /caddy/i } },
  { name: 'LiteSpeed', category: 'Server', headers: { server: /litespeed/i } },
  { name: 'Cloudflare', category: 'CDN', headers: { server: /cloudflare/i, 'cf-ray': /.+/ } },
  { name: 'Fastly', category: 'CDN', headers: { 'x-served-by': /fastly|cache-/i, 'x-fastly-request-id': /.+/ } },
  { name: 'Akamai', category: 'CDN', headers: { 'x-akamai-transformed': /.+/, 'x-akamai-request-id': /.+/ } },
  { name: 'Amazon CloudFront', category: 'CDN', headers: { via: /cloudfront/i, 'x-amz-cf-id': /.+/ } },
  { name: 'Vercel', category: 'Hosting', headers: { server: /vercel/i, 'x-vercel-id': /.+/ } },
  { name: 'Netlify', category: 'Hosting', headers: { server: /netlify/i, 'x-nf-request-id': /.+/ } },
  { name: 'Google Analytics', category: 'Analytics', body: [/www\.google-analytics\.com\/analytics\.js/i, /gtag\(['"]config['"]/i, /UA-\d+-\d+/] },
  { name: 'Google Tag Manager', category: 'Analytics', body: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]+/] },
  { name: 'Hotjar', category: 'Analytics', body: [/static\.hotjar\.com/i] },
  { name: 'Matomo', category: 'Analytics', body: [/matomo\.js|piwik\.js/i] },
  { name: 'Plausible', category: 'Analytics', body: [/plausible\.io\/js/i] },
  { name: 'Express', category: 'Framework', headers: { 'x-powered-by': /express/i } },
  { name: 'PHP', category: 'Language', headers: { 'x-powered-by': /php/i } },
  { name: 'ASP.NET', category: 'Framework', headers: { 'x-powered-by': /asp\.net/i, 'x-aspnet-version': /.+/ } },
  { name: 'Django', category: 'Framework', headers: { server: /wsgiserver|gunicorn/i, 'x-frame-options': /sameorigin/i } }
];

function matchSignature(sig, body, headers) {
  let matched = false;
  if (sig.body) {
    for (const re of sig.body) {
      if (re.test(body)) {
        matched = true;
        break;
      }
    }
  }
  if (sig.headers) {
    for (const [key, re] of Object.entries(sig.headers)) {
      const val = headers[key.toLowerCase()];
      if (val && re.test(val)) {
        matched = true;
        break;
      }
    }
  }
  return matched;
}

async function fetchBody(url) {
  const resp = await withTimeout(
    fetch(url, { headers: { 'User-Agent': 'ReconTool/1.0 (+authorized-research)' } }),
    8000,
    'fetch body'
  );
  const headers = {};
  resp.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const body = await resp.text();
  return { status: resp.status, body: body.slice(0, 500_000), headers };
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target, { allowIp: false });
  if (!v.ok) return res.status(400).json({ error: v.error });

  const domain = v.value;
  const candidates = [`https://${domain}`, `http://${domain}`];
  let result = null;
  let usedUrl = null;
  let lastError = null;

  for (const url of candidates) {
    try {
      result = await fetchBody(url);
      usedUrl = url;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!result) {
    return res.status(502).json({ error: 'Tech detection failed', message: lastError ? lastError.message : 'unknown' });
  }

  const detected = SIGNATURES.filter((s) => matchSignature(s, result.body, result.headers));
  const grouped = {};
  for (const d of detected) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d.name);
  }

  const generator = (result.body.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i) || [])[1] || null;

  res.json({
    target: domain,
    url: usedUrl,
    status: result.status,
    detected: detected.map((d) => ({ name: d.name, category: d.category })),
    grouped,
    generator,
    poweredBy: result.headers['x-powered-by'] || null,
    server: result.headers['server'] || null,
    disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
  });
});

module.exports = router;
