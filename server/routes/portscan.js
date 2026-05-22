const express = require('express');
const net = require('net');
const dns = require('dns').promises;
const { validateTarget, isIP } = require('../utils/validate');

const router = express.Router();

// Curated port database: service name + category per well-known port.
const PORT_DB = {
  21: ['FTP', 'file'],
  22: ['SSH', 'remote'],
  23: ['Telnet', 'remote'],
  25: ['SMTP', 'mail'],
  37: ['Time', 'other'],
  43: ['WHOIS', 'other'],
  53: ['DNS', 'infra'],
  67: ['DHCP', 'infra'],
  69: ['TFTP', 'file'],
  79: ['Finger', 'other'],
  80: ['HTTP', 'web'],
  81: ['HTTP-alt', 'web'],
  88: ['Kerberos', 'infra'],
  102: ['MS Exchange', 'mail'],
  110: ['POP3', 'mail'],
  111: ['RPCbind', 'infra'],
  113: ['Ident', 'other'],
  119: ['NNTP', 'other'],
  123: ['NTP', 'infra'],
  135: ['MSRPC', 'remote'],
  137: ['NetBIOS-NS', 'file'],
  139: ['NetBIOS-SSN', 'file'],
  143: ['IMAP', 'mail'],
  161: ['SNMP', 'infra'],
  179: ['BGP', 'infra'],
  389: ['LDAP', 'infra'],
  427: ['SLP', 'infra'],
  443: ['HTTPS', 'web'],
  445: ['SMB', 'file'],
  465: ['SMTPS', 'mail'],
  500: ['IKE/IPsec', 'infra'],
  512: ['exec', 'remote'],
  513: ['rlogin', 'remote'],
  514: ['syslog/shell', 'infra'],
  515: ['LPD printer', 'file'],
  543: ['klogin', 'remote'],
  544: ['kshell', 'remote'],
  548: ['AFP', 'file'],
  554: ['RTSP', 'other'],
  587: ['SMTP submission', 'mail'],
  593: ['HTTP-RPC-EPMAP', 'infra'],
  631: ['IPP', 'file'],
  636: ['LDAPS', 'infra'],
  873: ['rsync', 'file'],
  902: ['VMware', 'other'],
  989: ['FTPS data', 'file'],
  990: ['FTPS', 'file'],
  993: ['IMAPS', 'mail'],
  995: ['POP3S', 'mail'],
  1080: ['SOCKS proxy', 'infra'],
  1099: ['Java RMI', 'remote'],
  1194: ['OpenVPN', 'remote'],
  1433: ['MSSQL', 'database'],
  1434: ['MSSQL monitor', 'database'],
  1521: ['Oracle DB', 'database'],
  1701: ['L2TP', 'remote'],
  1723: ['PPTP', 'remote'],
  1883: ['MQTT', 'other'],
  1900: ['UPnP/SSDP', 'infra'],
  2049: ['NFS', 'file'],
  2082: ['cPanel', 'web'],
  2083: ['cPanel SSL', 'web'],
  2086: ['WHM', 'web'],
  2087: ['WHM SSL', 'web'],
  2095: ['Webmail', 'web'],
  2096: ['Webmail SSL', 'web'],
  2121: ['FTP-alt', 'file'],
  2181: ['ZooKeeper', 'infra'],
  2222: ['SSH-alt', 'remote'],
  2375: ['Docker API', 'remote'],
  2376: ['Docker API TLS', 'remote'],
  2483: ['Oracle DB', 'database'],
  2484: ['Oracle DB SSL', 'database'],
  3000: ['Dev/Grafana', 'web'],
  3128: ['Squid proxy', 'infra'],
  3260: ['iSCSI', 'file'],
  3306: ['MySQL', 'database'],
  3389: ['RDP', 'remote'],
  3690: ['SVN', 'file'],
  4369: ['Erlang EPMD', 'infra'],
  4444: ['Metasploit/alt', 'other'],
  4500: ['IPsec NAT-T', 'infra'],
  4848: ['GlassFish admin', 'web'],
  5000: ['Dev/UPnP', 'web'],
  5060: ['SIP', 'other'],
  5222: ['XMPP', 'other'],
  5353: ['mDNS', 'infra'],
  5432: ['PostgreSQL', 'database'],
  5555: ['Android ADB', 'remote'],
  5601: ['Kibana', 'web'],
  5672: ['AMQP/RabbitMQ', 'other'],
  5900: ['VNC', 'remote'],
  5938: ['TeamViewer', 'remote'],
  5984: ['CouchDB', 'database'],
  6000: ['X11', 'remote'],
  6379: ['Redis', 'database'],
  6443: ['Kubernetes API', 'infra'],
  6660: ['IRC', 'other'],
  6667: ['IRC', 'other'],
  7001: ['WebLogic', 'web'],
  7077: ['Spark', 'other'],
  8000: ['HTTP-alt', 'web'],
  8008: ['HTTP-alt', 'web'],
  8009: ['AJP', 'web'],
  8080: ['HTTP proxy', 'web'],
  8081: ['HTTP-alt', 'web'],
  8086: ['InfluxDB', 'database'],
  8088: ['Hadoop', 'web'],
  8161: ['ActiveMQ', 'other'],
  8443: ['HTTPS-alt', 'web'],
  8500: ['Consul', 'infra'],
  8888: ['HTTP-alt', 'web'],
  9000: ['SonarQube/dev', 'web'],
  9042: ['Cassandra', 'database'],
  9090: ['Prometheus', 'web'],
  9092: ['Kafka', 'other'],
  9200: ['Elasticsearch', 'database'],
  9300: ['Elasticsearch transport', 'database'],
  9418: ['Git', 'file'],
  10000: ['Webmin', 'web'],
  11211: ['Memcached', 'database'],
  15672: ['RabbitMQ mgmt', 'web'],
  27017: ['MongoDB', 'database'],
  27018: ['MongoDB shard', 'database'],
  50000: ['DB2/SAP', 'database']
};

const TOP20 = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 6379, 8080, 8443, 27017];
const COMMON = Object.keys(PORT_DB).map(Number).sort((a, b) => a - b);

const TLS_PORTS = new Set([443, 465, 563, 636, 853, 989, 990, 992, 993, 995, 2083, 2087, 2096, 2376, 2484, 5061, 8443]);
const HTTP_PORTS = new Set([80, 81, 280, 591, 2080, 3000, 4848, 5000, 5601, 7001, 8000, 8008, 8080, 8081, 8088, 8888, 9000, 9090, 9200, 10000]);

const MAX_CUSTOM_PORTS = 1024;
const CONCURRENCY = 200;
const CONNECT_TIMEOUT = 1500;
const BANNER_TIMEOUT = 1500;

function describe(port) {
  return PORT_DB[port] ? { service: PORT_DB[port][0], category: PORT_DB[port][1] } : { service: 'unknown', category: 'other' };
}

function parsePortSpec(spec) {
  const out = new Set();
  for (const raw of String(spec).split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const range = part.match(/^(\d{1,5})-(\d{1,5})$/);
    if (range) {
      let a = Number(range[1]);
      let b = Number(range[2]);
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > 65535) return { error: `Port out of range: ${part}` };
      for (let p = a; p <= b; p++) {
        out.add(p);
        if (out.size > MAX_CUSTOM_PORTS) return { error: `Too many ports (max ${MAX_CUSTOM_PORTS})` };
      }
    } else if (/^\d{1,5}$/.test(part)) {
      const p = Number(part);
      if (p < 1 || p > 65535) return { error: `Port out of range: ${part}` };
      out.add(p);
    } else {
      return { error: `Invalid port or range: ${part}` };
    }
    if (out.size > MAX_CUSTOM_PORTS) return { error: `Too many ports (max ${MAX_CUSTOM_PORTS})` };
  }
  if (out.size === 0) return { error: 'No valid ports given' };
  return { ports: [...out].sort((a, b) => a - b) };
}

function scanPort(host, port, grabBanner) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const start = Date.now();
    let state = 'closed';
    let chunks = Buffer.alloc(0);
    let settled = false;
    let bannerTimer = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (bannerTimer) clearTimeout(bannerTimer);
      socket.destroy();
      const text = chunks
        .toString('latin1')
        .replace(/[^\x20-\x7e\r\n\t]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      resolve({
        port,
        ...describe(port),
        state,
        latencyMs: state === 'open' ? Date.now() - start : null,
        banner: text ? text.slice(0, 220) : null
      });
    };

    socket.setTimeout(CONNECT_TIMEOUT);
    socket.once('connect', () => {
      state = 'open';
      if (!grabBanner || TLS_PORTS.has(port)) return finish();
      socket.setTimeout(0);
      if (HTTP_PORTS.has(port)) {
        try {
          socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\nUser-Agent: ReconTool\r\n\r\n`);
        } catch (_) {
          /* ignore */
        }
      }
      bannerTimer = setTimeout(finish, BANNER_TIMEOUT);
      socket.on('data', (chunk) => {
        chunks = Buffer.concat([chunks, chunk]);
        if (chunks.length >= 2048) finish();
      });
      socket.once('end', finish);
    });
    socket.once('timeout', () => {
      if (state !== 'open') state = 'filtered';
      finish();
    });
    socket.once('error', () => finish());
    socket.connect(port, host);
  });
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

router.get('/', async (req, res) => {
  const v = validateTarget(req.query.target);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const profile = ['top20', 'common', 'custom'].includes(req.query.profile) ? req.query.profile : 'top20';
  const grabBanner = req.query.banners !== '0';

  let ports;
  if (profile === 'custom') {
    if (!req.query.ports) return res.status(400).json({ error: 'Custom profile requires a "ports" parameter' });
    const parsed = parsePortSpec(req.query.ports);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    ports = parsed.ports;
  } else {
    ports = profile === 'common' ? COMMON : TOP20;
  }

  let host = v.value;
  let resolvedFrom = null;

  try {
    if (!isIP(host)) {
      const addresses = await dns.resolve4(host);
      if (!addresses.length) throw new Error('No A records');
      resolvedFrom = host;
      host = addresses[0];
    }

    const started = Date.now();
    const results = await mapLimit(ports, CONCURRENCY, (port) => scanPort(host, port, grabBanner));
    const durationMs = Date.now() - started;

    const open = results.filter((r) => r.state === 'open');
    const byCategory = {};
    for (const r of open) {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    }

    res.json({
      target: v.value,
      host,
      resolvedFrom,
      profile,
      bannerGrab: grabBanner,
      scanned: ports.length,
      openCount: open.length,
      durationMs,
      openByCategory: byCategory,
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
