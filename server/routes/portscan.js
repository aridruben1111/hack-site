const express = require('express');
const net = require('net');
const dns = require('dns').promises;
const { validateTarget, isIP } = require('../utils/validate');

const router = express.Router();

const PORTS = [
  { port: 21, service: 'FTP' },
  { port: 22, service: 'SSH' },
  { port: 23, service: 'Telnet' },
  { port: 25, service: 'SMTP' },
  { port: 53, service: 'DNS' },
  { port: 80, service: 'HTTP' },
  { port: 110, service: 'POP3' },
  { port: 143, service: 'IMAP' },
  { port: 443, service: 'HTTPS' },
  { port: 445, service: 'SMB' },
  { port: 993, service: 'IMAPS' },
  { port: 995, service: 'POP3S' },
  { port: 1433, service: 'MSSQL' },
  { port: 3306, service: 'MySQL' },
  { port: 3389, service: 'RDP' },
  { port: 5432, service: 'PostgreSQL' },
  { port: 6379, service: 'Redis' },
  { port: 8080, service: 'HTTP-alt' },
  { port: 8443, service: 'HTTPS-alt' },
  { port: 27017, service: 'MongoDB' }
];

function probe(host, port, timeout = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (state) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(state);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish('open'));
    socket.once('timeout', () => finish('filtered'));
    socket.once('error', () => finish('closed'));
    socket.connect(port, host);
  });
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target);
  if (!v.ok) return res.status(400).json({ error: v.error });

  let host = v.value;
  let resolvedFrom = null;

  try {
    if (!isIP(host)) {
      const addresses = await dns.resolve4(host);
      if (!addresses.length) throw new Error('No A records');
      resolvedFrom = host;
      host = addresses[0];
    }

    const results = await Promise.all(
      PORTS.map(async ({ port, service }) => {
        const state = await probe(host, port);
        return { port, service, state };
      })
    );

    const open = results.filter((r) => r.state === 'open');

    res.json({
      target: v.value,
      host,
      resolvedFrom,
      scanned: PORTS.length,
      openCount: open.length,
      results,
      warning:
        'PORT SCANNING zonder toestemming kan strafbaar zijn. Scan alleen systemen waarvoor je expliciete autorisatie hebt.',
      disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
    });
  } catch (err) {
    res.status(502).json({ error: 'Port scan failed', message: err.message });
  }
});

module.exports = router;
