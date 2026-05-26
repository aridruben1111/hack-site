# ReconTool — OSINT reconnaissance

A full-stack OSINT reconnaissance webapp for authorized security research,
pentesting and education.

> **Legal:** use this tool only on systems you are explicitly authorized to
> test. Unauthorized scanning is illegal in many jurisdictions.

> **Vibe-coded:** this project was built rapidly and largely with AI
> assistance ("vibe coding"). Review the code yourself before relying on it
> in production.

## Modules

- **DNS** — A/AAAA/MX/NS/TXT/CNAME/SOA with SPF/DKIM/DMARC detection
- **WHOIS** — registrar, dates, name servers, parsed fields
- **IP** — geolocation, ASN, ISP via ip-api.com + Leaflet map
- **Port scan** — TCP scan with profiles (top 20 / ~120 common / custom
  ports & ranges), banner grabbing, latency and service category per port
- **SSL/TLS** — certificate inspection with A–F grading
- **HTTP headers** — security header analysis + recommendations
- **Tech detection** — CMS, frameworks, servers, CDNs, analytics
- **Subdomains** — crt.sh enumeration + live HEAD validation
- **Favicon** — favicon extractor for the scanned domain

## Stack

- Frontend: React 18 + Vite + TailwindCSS (dark theme, light toggle)
- Backend: Node.js + Express with configurable rate limiting
- Security: `recon-security` local package — SSRF protection + access controls
- No database — completed scan results are kept in a localStorage history
  (open the **History** panel from the header to review or reopen them)

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
> On a public host, combine it with a network-level block of the
> cloud-metadata IP (see the VPS section).

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

### Option C — prebuilt image (no clone, no build)

A published image is available on Docker Hub as `arid69/recon-tool`, built
and pushed automatically by the [`Publish Docker image`](.github/workflows/docker-publish.yml)
GitHub Actions workflow. To run it you only need one file —
[`docker-compose.prebuilt.yml`](docker-compose.prebuilt.yml):

```bash
# In an empty folder:
curl -O https://raw.githubusercontent.com/aridruben1111/hack-site/claude/osint-recon-tool-QCGAi/docker-compose.prebuilt.yml
docker compose -f docker-compose.prebuilt.yml up -d
```

This pulls `arid69/recon-tool:latest` — no repository checkout and no local
build. The app is then on <http://127.0.0.1:5174>.

#### Automatic updates with Watchtower

`docker-compose.prebuilt.yml` includes a [Watchtower](https://containrrr.dev/watchtower/)
service under the `autoupdate` profile. Start it with the profile enabled to
poll Docker Hub every hour and recreate the container as soon as a newer
image is published:

```bash
docker compose -f docker-compose.prebuilt.yml --profile autoupdate up -d
```

Watchtower only touches containers carrying the
`com.centurylinklabs.watchtower.enable=true` label, so it cannot
accidentally update anything else on the host.

#### Migrating an existing build-based deployment

If you already have the source-built stack running (the project's
`docker-compose.yml` with `build: .`), use the bundled script to switch over
in one go — it stops the old stack, removes the locally-built image, pulls
the published image, and starts it with auto-update enabled. Your
`docker-compose.override.yml` (e.g. `TRUST_PROXY: "1"`) is preserved:

```bash
sudo bash scripts/switch-to-prebuilt.sh
```

### Environment variables

Copy `.env.example` to `.env` (Compose picks it up automatically) or pass
variables with `-e` on `docker run`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5174` | Port the server listens on and serves the client from |
| `TRUST_PROXY` | _unset_ | Set to `1` when behind a reverse proxy so the rate limiter sees the real client IP |
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins. Not needed in the Docker image (client is served same-origin) |
| `ALLOW_PRIVATE_TARGETS` | `false` | When `true`, disables SSRF blocking so private/loopback targets are allowed. Use only on a trusted, non-public instance |
| `ENABLE_PORTSCAN` | `true` | Set to `false` to disable the `/api/portscan` route (returns 403). Consider disabling on an anonymous public instance |
| `RATE_LIMIT_PER_MIN` | `10` | Per-IP request limit per minute. Set to `0` to disable rate limiting |

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
   the cloud-metadata IP `169.254.169.254` at the network layer (see the
   VPS section below — do not block whole RFC1918 ranges, it breaks DNS).
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

### Quick install (interactive script)

The fastest path is the bundled installer. On a fresh Debian/Ubuntu VPS:

```bash
git clone https://github.com/aridruben1111/hack-site.git recon-tool
cd recon-tool
sudo bash scripts/setup-vps.sh
```

It installs Docker and nginx, builds and starts the container (bound to
`127.0.0.1`), sets up an HTTP basic-auth login, blocks container egress to
the cloud-metadata IP, and **asks during the run how to terminate TLS**:

1. **Own domain** — real Let's Encrypt certificate
2. **DuckDNS hostname** — free, real Let's Encrypt certificate
3. **Self-signed** — reached via `https://<vps-ip>`, one-time browser warning

For domain / DuckDNS modes, point a DNS record at the VPS *before* running
the script. The manual steps below document what the script automates.

---

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

### 3. Block container egress to the cloud-metadata IP

Most VPS providers expose a metadata service at `169.254.169.254` that can
leak credentials. The `recon-security` guard already blocks this for recon
targets; add a narrow network-layer rule as defence-in-depth.

> ⚠️ **Block only the metadata address.** Dropping whole RFC1918 ranges
> (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) in `DOCKER-USER` will
> break container DNS and image builds whenever your resolver — or the
> route to it — sits in one of those ranges. A single-host `/32` rule does
> not have that problem.
>
> Do **not** use `iptables-persistent` on Debian: it conflicts with `ufw`
> and `apt` will silently **remove ufw**. Persist with a systemd unit
> instead.

```bash
# Add the rule now
iptables -I DOCKER-USER -d 169.254.169.254/32 -j DROP

# Persist it across reboots without iptables-persistent
cat >/etc/systemd/system/docker-metadata-block.service <<'EOF'
[Unit]
Description=Block container egress to the cloud metadata IP
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/sbin/iptables -I DOCKER-USER -d 169.254.169.254/32 -j DROP

[Install]
WantedBy=multi-user.target
EOF
systemctl enable docker-metadata-block.service
```

### 4. Deploy the container

```bash
# The default branch holds the code — a plain clone is enough.
git clone https://github.com/aridruben1111/hack-site.git recon-tool && cd recon-tool
```

The shipped `docker-compose.yml` binds the port to `127.0.0.1` and keeps
`ALLOW_PRIVATE_TARGETS` off (SSRF protection on). The port scanner is
enabled and rate limiting is off — review `ENABLE_PORTSCAN` and
`RATE_LIMIT_PER_MIN` if the instance will be shared or anonymous. Uncomment
`TRUST_PROXY: "1"` before starting, then:

```bash
docker compose up -d --build
docker compose logs -f      # the server logs its security posture on startup
```

### 5. Reverse proxy + TLS + auth

`scripts/setup-vps.sh` (see *Quick install* above) automates this. To do it
by hand, mind the order — request the certificate **last**, because
`certbot --nginx` needs a working HTTP server block first:

```bash
apt install -y nginx certbot python3-certbot-nginx apache2-utils

# 1. Create the login (use your own username, not "youruser")
htpasswd -c /etc/nginx/.htpasswd <your-username>

# 2. Create an HTTP-only site block for YOUR real hostname. Replace
#    recon.example.com — Let's Encrypt rejects the reserved example.com.
#    The block needs: listen 80; server_name <host>; and the proxy_pass +
#    auth_basic location from the public-deployment section above.

# 3. Enable it and reload
ln -sf /etc/nginx/sites-available/recon-tool /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 4. Request the certificate — certbot rewrites the block to add HTTPS.
#    A DNS A record for <host> must already point at this VPS.
certbot --nginx -d recon.yourdomain.com
```

### 6. Recommended posture for a public VPS

| Setting | Value | Why |
|---|---|---|
| Container port binding | `127.0.0.1:5174:5174` | Not internet-reachable (UFW does not cover Docker) |
| `ENABLE_PORTSCAN` | `true` behind auth, `false` if anonymous | Only scan with authorization; AUP risk on shared/anonymous instances |
| `RATE_LIMIT_PER_MIN` | `0` for a single trusted user, else `10`+ | Throttle abuse on shared/anonymous instances |
| `ALLOW_PRIVATE_TARGETS` | `false` (unset) | Keep SSRF protection active |
| `TRUST_PROXY` | `1` | Correct client IP for rate limiting |
| Reverse proxy auth | basic auth or SSO | No anonymous access |
| `DOCKER-USER` rule | `169.254.169.254/32` DROP only | Defence-in-depth against metadata SSRF (do not block whole RFC1918 ranges — it breaks DNS) |

### 7. Updates & monitoring

```bash
git pull && docker compose up -d --build   # update
```

Consider `fail2ban` on the nginx auth log and unattended host security
updates. Container resource limits can be added under the service in
`docker-compose.yml` (`mem_limit`, `cpus`).

### Troubleshooting

**Build fails with `npm error EAI_AGAIN ... registry.npmjs.org`** — the
build container cannot resolve DNS. This is almost always caused by an
over-broad `DOCKER-USER` DROP rule blocking the path to your DNS resolver.
Remove the RFC1918 rules and keep only the `/32` metadata rule:

```bash
iptables -D DOCKER-USER -d 10.0.0.0/8 -j DROP
iptables -D DOCKER-USER -d 172.16.0.0/12 -j DROP
iptables -D DOCKER-USER -d 192.168.0.0/16 -j DROP
iptables -D DOCKER-USER -d 169.254.0.0/16 -j DROP
iptables -L DOCKER-USER -n --line-numbers   # verify
docker run --rm alpine nslookup registry.npmjs.org   # should resolve now
```

**`ufw` disappeared after installing `iptables-persistent`** — they
conflict on Debian. Reinstall ufw (this removes `iptables-persistent`),
then persist the metadata rule with the systemd unit from step 3:

```bash
apt install -y ufw && ufw enable && ufw status
```

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
| `GET /api/portscan` | `target=ip\|domain`, `profile=top20\|common\|custom`, `ports=22,80,8000-8100`, `banners=0\|1` | TCP connect scan; banner grab + latency per open port (custom max 1024 ports) |
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
