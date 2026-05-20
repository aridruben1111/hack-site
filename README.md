# ReconTool — OSINT reconnaissance

A full-stack OSINT reconnaissance webapp for authorized security research,
pentesting and education.

> **Legal:** use this tool only on systems you are explicitly authorized to
> test. Unauthorized scanning is illegal in many jurisdictions.

## Modules

- **DNS** — A/AAAA/MX/NS/TXT/CNAME/SOA with SPF/DKIM/DMARC detection
- **WHOIS** — registrar, dates, name servers, parsed fields
- **IP** — geolocation, ASN, ISP via ip-api.com + Leaflet map
- **Port scan** — top 20 TCP ports (requires explicit confirmation)
- **SSL/TLS** — certificate inspection with A–F grading
- **HTTP headers** — security header analysis + recommendations
- **Tech detection** — CMS, frameworks, servers, CDNs, analytics
- **Subdomains** — crt.sh enumeration + live HEAD validation
- **Favicon** — favicon extractor for the scanned domain

## Stack

- Frontend: React 18 + Vite + TailwindCSS (dark theme, light toggle)
- Backend: Node.js + Express with rate limiting (10 req/min/IP)
- No database — results live in component state + localStorage history

## Setup

```bash
# Install root + client + server dependencies
npm run install:all

# Start client (port 5173) + server (port 5174) concurrently
npm run dev
```

Open <http://localhost:5173>.

## Project structure

```
recon-tool/
├── package.json          # root: concurrently runner
├── server/
│   ├── index.js          # express app
│   ├── routes/           # one file per module
│   ├── modules/
│   └── utils/validate.js # input validation + timeouts
└── client/
    ├── vite.config.js    # proxies /api → :5174
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── components/   # UI + per-module views
        └── hooks/        # useApi, useToast
```

## API

All endpoints return JSON and include a `disclaimer` field. Validate input
via the regex/`is-valid-domain` checks in `server/utils/validate.js`.

| Endpoint | Params | Notes |
|---|---|---|
| `GET /api/dns` | `target=domain` | Resolves all common record types |
| `GET /api/whois` | `target=domain\|ip` | Parses raw WHOIS output |
| `GET /api/ip` | `target=ip\|domain` | Uses ip-api.com (free, no key) |
| `GET /api/portscan` | `target=ip\|domain` | TCP connect on 20 ports, 1.5s timeout |
| `GET /api/ssl` | `target=domain&port=443` | TLS cert + cipher grading |
| `GET /api/headers` | `target=domain` | Security header scoring |
| `GET /api/tech` | `target=domain` | Regex signatures on body + headers |
| `GET /api/subdomains` | `target=domain&validate=0\|1` | crt.sh + HEAD check (max 50) |
| `GET /api/favicon` | `target=domain` | Returns base64 data URI |

## Configuration

- Rate limit: 10 requests/min per IP (see `server/index.js`)
- Request timeouts: 5–8 seconds per external call
- CORS: localhost-only by default — adjust in `server/index.js` to deploy

## Disclaimer

This tool is for educational purposes and authorized security research.
Use only on systems you have explicit written permission to test.
The authors are not liable for misuse.
