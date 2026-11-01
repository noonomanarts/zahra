# Website access from Iraq – findings and fixes

Customers in Iraq report that zahrasdesignstudio.com does not open (connection timeout).

## What was checked (1 Nov 2026)

| | zahrasdesignstudio.com (live site) | zahra.noonomanarts.com (new site) |
| --- | --- | --- |
| Software | WordPress (PHP 8.3) | this Next.js app (Docker) |
| Server | Hostinger shared hosting, LiteSpeed | own server |
| IP | `46.202.138.31` (one IPv4, no IPv6) | Cloudflare (`104.21.65.152`, `172.67.146.174` + IPv6) |
| DNS | GoDaddy (`ns57/ns58.domaincontrol.com`) | Cloudflare |
| CDN | none – Cloudflare is **not** in front of the live site | Cloudflare proxy |

The live site loads normally from outside Iraq. It could not be tested from inside Iraq: none of the public
measurement networks has a probe there (Globalping: 0 of 5,384 probes; check-host.net: no node).

## Likely causes

1. **Network path to the Hostinger IP.** The live site has a single IPv4 address in a range Hostinger leases
   from another provider. Iraqi ISPs often route such ranges badly, or filter them after abuse reports from
   other sites on the same shared server. A timeout (instead of an error page) points to this.
2. **Hosting firewall.** Hostinger/LiteSpeed security (Imunify360, LiteSpeed reCAPTCHA, country blocking) can
   silently drop traffic from whole countries or ISP ranges that sent bot traffic.
3. **National shutdowns.** During the ministerial exams (usually May–August, mornings) Iraq cuts or filters the
   internet nationally. Reports that only come at certain hours match this.

## What to ask an affected customer (2 minutes)

- ISP (Earthlink, Zain, Asiacell, Korek, FastLine, …), city and time of the attempt.
- Does it open on mobile data instead of Wi-Fi? With a VPN?
- Does **https://zahra.noonomanarts.com** open? (Same shop on a different network – the most useful test.)

If the new address opens and the old one does not, the cause is the Hostinger server or its IP (1 or 2), not
the website itself.

## Fixes

1. **Now, on Hostinger:** hPanel → Security – make sure no country or IP blocking applies to Iraq. Ask Hostinger
   support to check the firewall logs (Imunify360/LiteSpeed) for blocked Iraqi IPs, or to move the site to
   another IP or data centre.
2. **When the new site goes live (recommended):** point zahrasdesignstudio.com to the new server through
   **Cloudflare** (proxied). Visitors then connect to Cloudflare's nearest edge (its network map lists
   locations in Iraq – check cloudflare.com/network) instead of one shared IP abroad. Move DNS from GoDaddy to
   Cloudflare at the same time. Settings: minimum TLS 1.2, IPv6 on, *Bot Fight Mode* off at first (it can
   challenge mobile networks), no country rules.
3. **Before switching:** lower the DNS TTL to 300 seconds a day earlier, so changes take effect quickly.
4. **Verify:** ask 2–3 customers on different Iraqi ISPs to open the site after the switch.

The new site does not depend on third-party services to render: fonts, scripts and images are served by the
site itself, so nothing slow or blocked in the region (Google Fonts, external CDNs) can hold a page back.
