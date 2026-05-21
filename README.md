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

## Run with Docker

The recommended way to run a single, self-contained instance. The image is a
two-stage build: it compiles the React client and then serves it as static
files from the same Express server that hosts the API — so the whole app runs
on **one port** with no separate frontend process.

### Prerequisites

- Docker Engine 20.10+ (and Docker Compose v2, included with modern Docker)

### Option A — Docker Compose (recommended)

```bash
# Build the image and start the container in the background
docker compose up -d --build

# View logs
docker compose logs -f

# Stop and remove the container
docker compose down
```

The app is then available at <http://localhost:5174>.

Shortcut npm scripts are also provided: `npm run docker:up` and
`npm run docker:down`.

### Option B — plain Docker

```bash
# Build the image
docker build -t recon-tool:latest .

# Run it (foreground, removed on exit)
docker run --rm -p 5174:5174 recon-tool:latest

# Or run detached with a restart policy
docker run -d --name recon-tool --restart unless-stopped \
  -p 5174:5174 recon-tool:latest
```

Shortcuts: `npm run docker:build` and `npm run docker:run`.

### Environment variables

Copy `.env.example` to `.env` (Compose picks it up automatically) or pass
variables with `-e` on `docker run`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5174` | Port the server listens on and serves the client from |
| `TRUST_PROXY` | _unset_ | Set to `1` when behind a reverse proxy so the rate limiter sees the real client IP |
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins. Not needed in the Docker image (client is served same-origin) |

### Changing the exposed port

Edit the `ports` mapping in `docker-compose.yml` (`host:container`), e.g. to
expose on host port 8080:

```yaml
    ports:
      - "8080:5174"
```

With plain Docker: `docker run -p 8080:5174 recon-tool:latest`.

### Health check

The image defines a `HEALTHCHECK` that polls `/api/health`. Inspect it with:

```bash
docker ps                  # shows "healthy" in STATUS once up
docker inspect --format '{{.State.Health.Status}}' recon-tool
```

### Updating

```bash
git pull
docker compose up -d --build   # rebuilds and recreates the container
```

## Deploying publicly — read this first

Unlike CyberChef (which is 100% static and runs entirely in the visitor's
browser), ReconTool has an **active backend** that performs DNS lookups, TLS
connections, HTTP requests and **port scans** against the target you give it.
On a public, anonymous instance, your server becomes a scanning relay: scans
originate from *your* server's IP, and the legal/abuse responsibility is yours.

If you expose this beyond your own machine:

1. **Put it behind authentication.** Terminate TLS and require a login at a
   reverse proxy (nginx/Traefik/Caddy) in front of the container. Restrict
   access to authorized users only.
2. **Set `TRUST_PROXY=1`** so the 10 req/min rate limiter keys on the real
   client IP rather than the proxy address.
3. **Restrict network egress / mitigate SSRF.** The `headers`, `tech`,
   `subdomains` and `favicon` modules fetch user-supplied URLs. Block the
   container from reaching private ranges (`10.0.0.0/8`, `172.16.0.0/12`,
   `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.0/8`) at the network layer.
4. **Consider disabling the port scanner** for an anonymous instance, or keep
   access limited to a trusted group — port scanning third parties without
   authorization is illegal in many jurisdictions.
5. **Keep abuse logs** and monitor for misuse.

Example nginx reverse proxy (TLS + basic auth) in front of the container:

```nginx
server {
    listen 443 ssl;
    server_name recon.example.com;
    ssl_certificate     /etc/letsencrypt/live/recon.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/recon.example.com/privkey.pem;

    auth_basic           "ReconTool — authorized users only";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass         http://127.0.0.1:5174;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

With this proxy, run the container with `TRUST_PROXY=1` and bind it to
localhost only (`-p 127.0.0.1:5174:5174`) so it is not reachable directly.

## Project structure

```
recon-tool/
├── package.json          # root: concurrently runner + docker scripts
├── Dockerfile            # two-stage build (client → static, server runtime)
├── docker-compose.yml    # one-command deploy
├── .dockerignore
├── .env.example          # documented environment variables
├── server/
│   ├── index.js          # express app (API + serves built client)
│   ├── routes/           # one file per module
│   ├── modules/
│   └── utils/validate.js # input validation + timeouts
└── client/
    ├── vite.config.js    # proxies /api → :5174 (dev only)
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
- CORS: localhost-only by default — override with `CORS_ORIGIN`
- Static client: served automatically when `client/dist` exists (production
  / Docker); in dev the Vite server proxies `/api` to the backend instead
- Reverse proxy: set `TRUST_PROXY` so rate limiting uses the real client IP

## Disclaimer

This tool is for educational purposes and authorized security research.
Use only on systems you have explicit written permission to test.
The authors are not liable for misuse.
