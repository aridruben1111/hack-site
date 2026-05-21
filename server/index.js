const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ssrfGuard, portscanGate } = require('recon-security');

const dnsRoute = require('./routes/dns');
const whoisRoute = require('./routes/whois');
const ipRoute = require('./routes/ip');
const portscanRoute = require('./routes/portscan');
const sslRoute = require('./routes/ssl');
const headersRoute = require('./routes/headers');
const techRoute = require('./routes/tech');
const subdomainsRoute = require('./routes/subdomains');
const faviconRoute = require('./routes/favicon');

const app = express();
const PORT = process.env.PORT || 5174;

// Behind a reverse proxy (nginx, Traefik, Caddy) set TRUST_PROXY so the
// rate limiter sees the real client IP instead of the proxy address.
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy', tp === 'true' ? 1 : isNaN(Number(tp)) ? tp : Number(tp));
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// Rate limiting. RATE_LIMIT_PER_MIN controls the per-IP limit; set it to 0
// to disable rate limiting entirely. Defaults to 10 requests/minute.
const rateLimitMax =
  process.env.RATE_LIMIT_PER_MIN !== undefined
    ? parseInt(process.env.RATE_LIMIT_PER_MIN, 10)
    : 10;
const rateLimitEnabled = Number.isFinite(rateLimitMax) && rateLimitMax > 0;

if (rateLimitEnabled) {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: `Rate limit exceeded. Max ${rateLimitMax} requests per minute.`,
      disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
    }
  });
  app.use('/api/', limiter);
}

app.use((req, res, next) => {
  res.setHeader('X-Recon-Disclaimer', 'Use only on systems you are authorized to test.');
  next();
});

// Security controls from the recon-security package.
// ALLOW_PRIVATE_TARGETS=true disables SSRF blocking (trusted LAN scanning).
// ENABLE_PORTSCAN=false disables the port scanner (recommended on a public VPS).
const allowPrivateTargets = process.env.ALLOW_PRIVATE_TARGETS === 'true';
const portscanEnabled = process.env.ENABLE_PORTSCAN !== 'false';
const guard = ssrfGuard({ allowPrivate: allowPrivateTargets });

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    portscanEnabled,
    ssrfProtection: !allowPrivateTargets,
    rateLimit: rateLimitEnabled ? `${rateLimitMax}/min` : 'disabled'
  });
});

app.use('/api/dns', dnsRoute);
app.use('/api/whois', whoisRoute);
app.use('/api/ip', guard, ipRoute);
app.use('/api/portscan', portscanGate({ enabled: portscanEnabled }), guard, portscanRoute);
app.use('/api/ssl', guard, sslRoute);
app.use('/api/headers', guard, headersRoute);
app.use('/api/tech', guard, techRoute);
app.use('/api/subdomains', guard, subdomainsRoute);
app.use('/api/favicon', guard, faviconRoute);

// Serve the built React client when present (production / Docker image).
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('[recon-tool] serving static client from', clientDist);
}

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error',
    disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`[recon-tool] server listening on http://localhost:${PORT}`);
  console.log(
    `[recon-tool] ssrf-protection=${!allowPrivateTargets} portscan=${portscanEnabled} ` +
      `rate-limit=${rateLimitEnabled ? rateLimitMax + '/min' : 'disabled'}`
  );
});
