const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

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

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded. Max 10 requests per minute.',
    disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
  }
});

app.use('/api/', limiter);

app.use((req, res, next) => {
  res.setHeader('X-Recon-Disclaimer', 'Use only on systems you are authorized to test.');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/dns', dnsRoute);
app.use('/api/whois', whoisRoute);
app.use('/api/ip', ipRoute);
app.use('/api/portscan', portscanRoute);
app.use('/api/ssl', sslRoute);
app.use('/api/headers', headersRoute);
app.use('/api/tech', techRoute);
app.use('/api/subdomains', subdomainsRoute);
app.use('/api/favicon', faviconRoute);

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
});
