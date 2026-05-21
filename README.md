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
- Security: `recon-security` local package — SSRF protection + access controls
- No database — results live in component state + localStorage history

## Security package (`recon-security`)

SSRF protection and access controls live in a separate local package at
`packages/recon-security/`, kept independent from the route code so it can
be reviewed and reused on its own. The server depends on it via a
`file:` reference.

It provides:

- **`ssrfGuard()`** — Express middleware that resolves the request `target`
  and returns `403` when *any* resolved address is private, loopback,
  link-local (incl. the cloud-metadata address `169.254.169.254`), CGNAT,
  multicast, documentation or otherwise reserved. Applied to every route
  that connects to the target (`ip`, `portscan`, `ssl`, `headers`, `tech`,
  `subdomains`, `favicon`). Bypassed when `ALLOW_PRIVATE_TARGETS=true`.
- **`portscanGate()`** — Express middleware that returns `403` for the
  port-scan route when `ENABLE_PORTSCAN=false`.
- **`isHostSafe(host)`** — helper used inside the subdomain module to skip
  discovered subdomains that resolve to non-public addresses.
- **`isBlockedIp()` / `classifyIp()`** — IPv4/IPv6 range classification.

> The guard checks at request time and does not pin the resolved IP for the
> subsequent connection, so it is not a hard defence against DNS rebinding.
> On a public host, combine it with network-level egress filtering (below).

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
- On a fresh VPS Docker is **not** installed by default — see
  [Running on a VPS](#running-on-a-vps) for installation and the important
  note on Docker bypassing UFW.

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

# Run it (foreground, removed on exit). The port is bound to 127.0.0.1 so
# it is not exposed to the internet — see the UFW note in the VPS section.
docker run --rm -p 127.0.0.1:5174:5174 recon-tool:latest

# Or run detached with a restart policy
docker run -d --name recon-tool --restart unless-stopped \
  -p 127.0.0.1:5174:5174 recon-tool:latest
```

To reach the container from other machines on a trusted LAN (local dev
only), drop the `127.0.0.1:` prefix.

Shortcuts: `npm run docker:build` and `npm run docker:run`.

### Environment variables

Copy `.env.example` to `.env` (Compose picks it up automatically) or pass
variables with `-e` on `docker run`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5174` | Port the server listens on and serves the client from |
| `TRUST_PROXY` | _unset_ | Set to `1` when behind a reverse proxy so the rate limiter sees the real client IP |
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins. Not needed in the Docker image (client is served same-origin) |
| `ALLOW_PRIVATE_TARGETS` | `false` | When `true`, disables SSRF blocking so private/loopback targets are allowed. Use only on a trusted, non-public instance |
| `ENABLE_PORTSCAN` | `true` | Set to `false` to disable the `/api/portscan` route (returns 403). Recommended on a public VPS |

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
3. **SSRF protection is on by default** (`recon-security` package) — it
   blocks targets resolving to private/loopback/link-local addresses. Keep
   `ALLOW_PRIVATE_TARGETS` unset. As defence-in-depth, also block egress to
   private ranges at the network layer (see the VPS section below).
4. **Disable the port scanner** on a public instance (`ENABLE_PORTSCAN=false`)
   — port scanning third parties without authorization is illegal in many
   jurisdictions and usually violates the VPS provider's acceptable-use policy.
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

## Running on a VPS

A step-by-step hardened setup for a fresh VPS (Debian/Ubuntu shown).
Run the commands as root or with `sudo`.

> ### ⚠️ Docker bypasses UFW — read this
>
> Docker writes its own `iptables` rules into the `DOCKER` / `DOCKER-USER`
> chains, which are evaluated **before** UFW's rules. As a result:
>
> - A published port like `-p 5174:5174` binds `0.0.0.0` and is reachable
>   from the internet **even with `ufw default deny incoming`**. UFW does
>   *not* protect Docker-published ports.
> - The fix used here is to **bind the container to `127.0.0.1`**
>   (`127.0.0.1:5174:5174`). Docker then only adds a loopback rule, so the
>   port is reachable solely from the host — the reverse proxy — and never
>   directly from outside. `docker-compose.yml` already ships this default.
>
> Do **not** rely on UFW alone to keep the container port closed.

### 1. Install Docker

Docker is not installed by default. Use the official convenience script
(includes the Compose v2 plugin):

```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version   # verify
```

### 2. Host firewall (UFW)

UFW still protects the **host's own** services (SSH, and the nginx ports).
It does not govern Docker-published ports — that is handled by the
localhost binding above.

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

If you specifically want UFW to manage Docker-published ports, install the
[`ufw-docker`](https://github.com/chaifeng/ufw-docker) helper — but with the
`127.0.0.1` binding it is not required here.

### 3. Block egress to internal ranges (metadata SSRF defence)

Most VPS providers expose a cloud-metadata service at `169.254.169.254`
that can leak credentials. The `recon-security` guard already blocks this
at the application layer; add a network-layer block as defence-in-depth.
The `DOCKER-USER` chain is intended for exactly this and is **not** flushed
when Docker restarts (it must exist first, so run this after step 1):

```bash
for net in 169.254.0.0/16 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
  iptables -I DOCKER-USER -d "$net" -j DROP
done
# Persist across reboots:
apt install -y iptables-persistent && netfilter-persistent save
```

### 4. Deploy the container

```bash
git clone https://github.com/aridruben1111/hack-site.git recon-tool && cd recon-tool
```

The shipped `docker-compose.yml` already uses the safe defaults: the port
is bound to `127.0.0.1`, `ENABLE_PORTSCAN` is `false` and
`ALLOW_PRIVATE_TARGETS` is `false`. Uncomment `TRUST_PROXY: "1"` before
starting, then:

```bash
docker compose up -d --build
docker compose logs -f      # the server logs its security posture on startup
```

### 5. Reverse proxy + TLS + auth

Install nginx and certbot, create an `.htpasswd` file, and use the nginx
config from the [public deployment section](#deploying-publicly--read-this-first):

```bash
apt install -y nginx certbot python3-certbot-nginx apache2-utils
htpasswd -c /etc/nginx/.htpasswd youruser
certbot --nginx -d recon.example.com
```

### 6. Recommended posture for a public VPS

| Setting | Value | Why |
|---|---|---|
| Container port binding | `127.0.0.1:5174:5174` | Not internet-reachable (UFW does not cover Docker) |
| `ENABLE_PORTSCAN` | `false` | Outbound scanning breaks most provider AUPs |
| `ALLOW_PRIVATE_TARGETS` | `false` (unset) | Keep SSRF protection active |
| `TRUST_PROXY` | `1` | Correct client IP for rate limiting |
| Reverse proxy auth | basic auth or SSO | No anonymous access |
| `DOCKER-USER` egress block | enabled | Defence-in-depth against metadata SSRF |

### 7. Updates & monitoring

```bash
git pull && docker compose up -d --build   # update
```

Consider `fail2ban` on the nginx auth log and unattended host security
updates. Container resource limits can be added under the service in
`docker-compose.yml` (`mem_limit`, `cpus`).

## Project structure

```
recon-tool/
├── package.json              # root: concurrently runner + docker scripts
├── Dockerfile                # two-stage build (client → static, server runtime)
├── docker-compose.yml        # one-command deploy
├── .dockerignore
├── .env.example              # documented environment variables
├── packages/
│   └── recon-security/       # SSRF protection + access controls (local package)
│       ├── index.js          # ssrfGuard, portscanGate, isHostSafe
│       └── ipblock.js        # IPv4/IPv6 range classification
├── server/
│   ├── index.js              # express app (API + serves built client)
│   ├── routes/               # one file per module
│   ├── modules/
│   └── utils/validate.js     # input validation + timeouts
└── client/
    ├── vite.config.js        # proxies /api → :5174 (dev only)
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── components/       # UI + per-module views
        └── hooks/            # useApi, useToast
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
