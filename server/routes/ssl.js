const express = require('express');
const tls = require('tls');
const { validateTarget } = require('../utils/validate');

const router = express.Router();

function inspectCert(host, servername, port = 443, timeout = 7000) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername,
        rejectUnauthorized: false,
        timeout
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();
        const authorized = socket.authorized;
        const authError = socket.authorizationError;
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          return reject(new Error('No certificate returned'));
        }
        resolve({ cert, cipher, protocol, authorized, authError });
      }
    );
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('TLS connection timed out'));
    });
    socket.once('error', (err) => reject(err));
  });
}

function gradeCertificate(info) {
  const issues = [];
  let score = 100;
  const now = Date.now();
  const validTo = new Date(info.cert.valid_to).getTime();
  const validFrom = new Date(info.cert.valid_from).getTime();
  const daysLeft = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

  if (validTo < now) {
    issues.push('Certificate expired');
    score -= 60;
  } else if (daysLeft < 14) {
    issues.push(`Certificate expires soon (${daysLeft} days)`);
    score -= 25;
  } else if (daysLeft < 30) {
    issues.push(`Certificate expires within 30 days (${daysLeft} days)`);
    score -= 10;
  }
  if (validFrom > now) {
    issues.push('Certificate not yet valid');
    score -= 30;
  }

  const issuerCN = info.cert.issuer && info.cert.issuer.CN;
  const subjectCN = info.cert.subject && info.cert.subject.CN;
  if (issuerCN && subjectCN && issuerCN === subjectCN) {
    issues.push('Self-signed certificate');
    score -= 40;
  }

  if (!info.authorized) {
    issues.push(`Not authorized: ${info.authError || 'unknown reason'}`);
    score -= 20;
  }

  if (info.protocol && /TLSv1(\.0|\.1)?$/.test(info.protocol)) {
    issues.push(`Outdated TLS version: ${info.protocol}`);
    score -= 25;
  }

  if (info.cipher && /RC4|DES|MD5|NULL/i.test(info.cipher.name || '')) {
    issues.push(`Weak cipher: ${info.cipher.name}`);
    score -= 20;
  }

  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 45) grade = 'D';
  else if (score >= 30) grade = 'E';

  return { score: Math.max(0, score), grade, issues, daysLeft };
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const port = Math.min(Math.max(parseInt(req.query.port, 10) || 443, 1), 65535);

  try {
    // Connect to the address the SSRF guard already validated (no TOCTOU
    // re-resolution); keep the original target as the TLS servername.
    const connectHost = (req.reconResolved && req.reconResolved[0]) || v.value;
    const info = await inspectCert(connectHost, v.value, port);
    const cert = info.cert;
    const sans = (cert.subjectaltname || '')
      .split(',')
      .map((s) => s.trim().replace(/^DNS:/i, ''))
      .filter(Boolean);
    const isWildcard = sans.some((s) => s.startsWith('*.'));
    const evaluation = gradeCertificate(info);

    res.json({
      target: v.value,
      port,
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: cert.valid_from,
      validTo: cert.valid_to,
      serialNumber: cert.serialNumber,
      fingerprint: cert.fingerprint,
      fingerprint256: cert.fingerprint256,
      subjectAltNames: sans,
      isWildcard,
      protocol: info.protocol,
      cipher: info.cipher,
      authorized: info.authorized,
      authError: info.authError || null,
      evaluation,
      disclaimer: 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.'
    });
  } catch (err) {
    res.status(502).json({ error: 'SSL/TLS inspection failed', message: err.message });
  }
});

module.exports = router;
