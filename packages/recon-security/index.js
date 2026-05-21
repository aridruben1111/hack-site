'use strict';

const dns = require('dns').promises;
const net = require('net');
const { isBlockedIp, classifyIp } = require('./ipblock');

const DISCLAIMER = 'Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.';

// Resolve a host (or accept an IP literal) and classify every address it
// points at. A target is "safe" only when ALL resolved addresses are public.
async function inspectTarget(target) {
  const host = String(target || '').trim().toLowerCase();
  if (!host) return { resolvable: false, safe: true, addresses: [], blocked: [] };

  if (net.isIP(host)) {
    const label = classifyIp(host);
    return {
      resolvable: true,
      safe: label === null,
      addresses: [host],
      blocked: label ? [{ address: host, label }] : []
    };
  }

  // dns.lookup mirrors what fetch()/net use (getaddrinfo), so the guard
  // sees the same addresses the request would actually connect to.
  const records = await dns.lookup(host, { all: true });
  const addresses = records.map((r) => r.address);
  const blocked = [];
  for (const address of addresses) {
    const label = classifyIp(address);
    if (label) blocked.push({ address, label });
  }
  return {
    resolvable: addresses.length > 0,
    safe: blocked.length === 0,
    addresses,
    blocked
  };
}

// Boolean helper for use inside route handlers, e.g. to validate each
// discovered subdomain before probing it.
async function isHostSafe(host) {
  try {
    const result = await inspectTarget(host);
    return result.safe;
  } catch (_) {
    return false;
  }
}

// Express middleware: blocks requests whose `target` query parameter
// resolves to a non-public address. Pass { allowPrivate: true } to
// disable the guard on a trusted, non-public instance.
//
// Note: this checks at request time and does not pin the resolved IP for
// the subsequent connection, so it is not a hard defence against DNS
// rebinding. For that, also apply egress filtering at the network layer.
function ssrfGuard(options = {}) {
  const allowPrivate = options.allowPrivate === true;
  return async function ssrfGuardMiddleware(req, res, next) {
    if (allowPrivate) return next();
    const target = req.query && req.query.target;
    if (!target) return next(); // empty-target handling is left to the route

    try {
      const result = await inspectTarget(target);
      if (!result.safe) {
        const hit = result.blocked[0];
        return res.status(403).json({
          error: 'Blocked by SSRF protection',
          message:
            `Target resolves to a non-public address (${hit.address} — ${hit.label}). ` +
            'Set ALLOW_PRIVATE_TARGETS=true only on a trusted, non-public instance.',
          blocked: result.blocked,
          disclaimer: DISCLAIMER
        });
      }
      req.reconResolved = result.addresses;
      return next();
    } catch (_) {
      // Resolution failed (NXDOMAIN etc.) — there is nothing to connect
      // to, so let the route surface its own error.
      return next();
    }
  };
}

// Express middleware: returns 403 when the port scanner is disabled.
function portscanGate(options = {}) {
  const enabled = options.enabled !== false;
  return function portscanGateMiddleware(req, res, next) {
    if (enabled) return next();
    return res.status(403).json({
      error: 'Port scanner disabled',
      message:
        'The port scanner is disabled on this instance. Set ENABLE_PORTSCAN=true ' +
        'to enable it — only where you are authorized to scan.',
      disclaimer: DISCLAIMER
    });
  };
}

module.exports = {
  inspectTarget,
  isHostSafe,
  ssrfGuard,
  portscanGate,
  isBlockedIp,
  classifyIp
};
