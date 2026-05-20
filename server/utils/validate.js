const isValidDomain = require('is-valid-domain');

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/;
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

function isIP(value) {
  if (typeof value !== 'string') return false;
  return IPV4_REGEX.test(value) || IPV6_REGEX.test(value);
}

function isDomain(value) {
  if (typeof value !== 'string') return false;
  return isValidDomain(value, { subdomain: true, wildcard: false });
}

function validateTarget(target, { allowIp = true, allowDomain = true } = {}) {
  if (!target || typeof target !== 'string') {
    return { ok: false, error: 'Missing target parameter' };
  }
  const trimmed = target.trim().toLowerCase();
  if (trimmed.length > 253) {
    return { ok: false, error: 'Target too long' };
  }
  if (allowIp && isIP(trimmed)) return { ok: true, value: trimmed, type: 'ip' };
  if (allowDomain && isDomain(trimmed)) return { ok: true, value: trimmed, type: 'domain' };
  return { ok: false, error: 'Invalid domain or IP address' };
}

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

module.exports = { isIP, isDomain, validateTarget, withTimeout };
