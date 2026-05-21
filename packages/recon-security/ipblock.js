'use strict';

// IPv4 / IPv6 classification for SSRF protection.
// Flags loopback, private (RFC1918), link-local (including the cloud
// metadata address 169.254.169.254), CGNAT, multicast, documentation
// and other reserved ranges. classifyIp() returns a label string when
// an address falls inside such a range, or null when it is public.

const net = require('net');

function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n >>> 0;
}

const IPV4_RANGES = [
  { base: '0.0.0.0', bits: 8, label: 'this-network' },
  { base: '10.0.0.0', bits: 8, label: 'private' },
  { base: '100.64.0.0', bits: 10, label: 'cgnat' },
  { base: '127.0.0.0', bits: 8, label: 'loopback' },
  { base: '169.254.0.0', bits: 16, label: 'link-local / cloud-metadata' },
  { base: '172.16.0.0', bits: 12, label: 'private' },
  { base: '192.0.0.0', bits: 24, label: 'ietf-protocol' },
  { base: '192.0.2.0', bits: 24, label: 'documentation' },
  { base: '192.168.0.0', bits: 16, label: 'private' },
  { base: '198.18.0.0', bits: 15, label: 'benchmarking' },
  { base: '198.51.100.0', bits: 24, label: 'documentation' },
  { base: '203.0.113.0', bits: 24, label: 'documentation' },
  { base: '224.0.0.0', bits: 4, label: 'multicast' },
  { base: '240.0.0.0', bits: 4, label: 'reserved' }
].map((r) => {
  const baseInt = ipv4ToInt(r.base);
  const mask = (0xffffffff << (32 - r.bits)) >>> 0;
  return { ...r, network: (baseInt & mask) >>> 0, mask };
});

function classifyIpv4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return null;
  for (const r of IPV4_RANGES) {
    if (((n & r.mask) >>> 0) === r.network) return r.label;
  }
  return null;
}

function ipv6ToBigInt(ip) {
  let value = String(ip).trim();
  const pct = value.indexOf('%');
  if (pct !== -1) value = value.slice(0, pct); // strip zone id
  if (value === '') return null;

  // Embedded IPv4 form, e.g. ::ffff:192.168.1.1
  if (value.includes('.')) {
    const idx = value.lastIndexOf(':');
    if (idx === -1) return null;
    const v4 = ipv4ToInt(value.slice(idx + 1));
    if (v4 === null) return null;
    value =
      value.slice(0, idx + 1) +
      ((v4 >>> 16) & 0xffff).toString(16) +
      ':' +
      (v4 & 0xffff).toString(16);
  }

  let head;
  let tail;
  const dbl = value.indexOf('::');
  if (dbl !== -1) {
    if (value.indexOf('::', dbl + 1) !== -1) return null; // only one '::' allowed
    head = value.slice(0, dbl).split(':').filter((s) => s !== '');
    tail = value.slice(dbl + 2).split(':').filter((s) => s !== '');
  } else {
    head = value.split(':');
    tail = [];
  }
  const fill = 8 - head.length - tail.length;
  if (dbl === -1 ? fill !== 0 : fill < 0) return null;
  const groups = [...head, ...new Array(Math.max(fill, 0)).fill('0'), ...tail];
  if (groups.length !== 8) return null;

  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

const V6_FULL = (1n << 128n) - 1n;

const IPV6_RANGES = [
  { base: '::1', bits: 128, label: 'loopback' },
  { base: '::', bits: 128, label: 'unspecified' },
  { base: '::ffff:0:0', bits: 96, label: 'ipv4-mapped' },
  { base: 'fc00::', bits: 7, label: 'unique-local' },
  { base: 'fe80::', bits: 10, label: 'link-local' },
  { base: 'ff00::', bits: 8, label: 'multicast' },
  { base: '2001:db8::', bits: 32, label: 'documentation' }
].map((r) => {
  const baseInt = ipv6ToBigInt(r.base);
  const host = 128n - BigInt(r.bits);
  const mask = (V6_FULL >> host) << host;
  return { ...r, network: baseInt & mask, mask };
});

const V6_MAPPED = IPV6_RANGES.find((r) => r.label === 'ipv4-mapped');

function classifyIpv6(ip) {
  const n = ipv6ToBigInt(ip);
  if (n === null) return null;
  // IPv4-mapped addresses: classify the embedded IPv4 instead.
  if ((n & V6_MAPPED.mask) === V6_MAPPED.network) {
    const v4 = Number(n & 0xffffffffn) >>> 0;
    const dotted = [(v4 >>> 24) & 255, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join('.');
    return classifyIpv4(dotted);
  }
  for (const r of IPV6_RANGES) {
    if (r.label === 'ipv4-mapped') continue;
    if ((n & r.mask) === r.network) return r.label;
  }
  return null;
}

function classifyIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return classifyIpv4(ip);
  if (family === 6) return classifyIpv6(ip);
  return null;
}

function isBlockedIp(ip) {
  return classifyIp(ip) !== null;
}

module.exports = { isBlockedIp, classifyIp, classifyIpv4, classifyIpv6 };
