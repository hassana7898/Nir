# NIR — Internet Access (no Cloudflare, no VPS)

This document explains how `app.artadan.ir` is published to the Internet using
only the factory PC and its router, with **no VPS** and **no Cloudflare**.

## Target architecture

```
INTERNET ──► app.artadan.ir ──► FACTORY ROUTER ──► FACTORY WINDOWS PC
                                                        │
                                                   Caddy :443 (HTTPS, Let's Encrypt)
                                                        │
                                                   NIR server :3000 (0.0.0.0)
                                                        │
                                                   PostgreSQL (127.0.0.1)
```

The factory LAN keeps working even when the Internet link is down.

## How the installer decides

`INSTALL-INTERNET.ps1` detects the environment and picks a strategy:

| Detected | Strategy | What is configured |
|----------|----------|--------------------|
| Public IPv4, not CGNAT | `public-ipv4` | DDNS updater + Caddy HTTPS on 443 + router port-forward 443→PC |
| No public IPv4 but public IPv6 | `ipv6` | Caddy HTTPS on 443 + `AAAA` record (no port-forward needed) |
| CGNAT and no usable IPv6 | `none` | Guidance + fallbacks below; LAN keeps working |

Detection uses: local IPv4, default gateway, public IPv4 (ipify/icanhazip),
public IPv6, CGNAT range check (`100.64.0.0/10` and RFC1918), and — when the
router supports UPnP — the router's real WAN IP (a WAN IP different from the
public IP is a CGNAT signal).

## DNS record to create

* `public-ipv4` → **A** record: `app.artadan.ir  →  <factory public IPv4>` (or a CNAME to your DDNS hostname)
* `ipv6` → **AAAA** record: `app.artadan.ir  →  <factory IPv6>`

Use `NIR-HEALTH.ps1` to print the exact record. Do **not** delete existing DNS
records for other subdomains (for example `camera.artadan.ir`).

## Port forwarding (router)

* `public-ipv4`: forward **external TCP 443 → this PC TCP 443**.
  The installer attempts this automatically over UPnP; otherwise configure it
  manually in the router.
* **Do not touch** the existing camera rules:
  * external 80 → 192.168.0.100:80
  * external 81 → 192.168.0.200:81
* PostgreSQL (5432) is **never** forwarded.

## HTTPS

Caddy obtains and renews a Let's Encrypt certificate automatically for
`app.artadan.ir`. Because external port 80 belongs to the cameras, Caddy uses
the **TLS-ALPN-01** challenge on 443 (it falls back automatically from HTTP-01).

## DDNS

`NIR-DDNS.ps1` (scheduled every 5 minutes) keeps the A/AAAA record current.
Supported providers: `duckdns`, `dynu`, `noip`, and `custom` (URL template with
`{ip}` / `{host}`). Config lives in `data\config\ddns.config.json` and is never
committed to git.

**Note for `.ir` domains:** many `.ir` registrars do not expose a DDNS/API for
individual hosts. If yours does not, use one of:
1. A DDNS provider's hostname (e.g. `artadan.duckdns.org`) and create
   `app.artadan.ir` as a **CNAME** to it.
2. A static public IP from the ISP (no DDNS needed).
3. Manual DNS updates.

## When CGNAT blocks everything (strategy `none`)

Zero-cost public HTTPS with a *custom domain* is not technically possible
without either a public IP or a relay. Practical, near-zero-cost options:

1. **Ask the ISP for a public/static IPv4** — the cleanest fix; often a small
   monthly fee, still far cheaper than a VPS.
2. **Use an IPv6-capable plan/ISP** and re-run with `-Strategy ipv6`.
3. **Zero-cost public relay** where end users install nothing, then point
   `app.artadan.ir` at it via CNAME. (Cloudflare Tunnel is intentionally not
   used per project constraints.)

In every case the factory LAN and all NIR operations keep working.

## Verifying

* On the factory PC: `NIR-HEALTH.ps1` (checks 443, Caddy, health, DNS target).
* From an external network: open `https://app.artadan.ir/api/health` — it must
  return `{"status":"ok", ...}`.
