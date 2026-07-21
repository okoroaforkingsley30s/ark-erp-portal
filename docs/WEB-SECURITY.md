# Web Security Policy

The hosted portal receives its browser security policy from `vercel.json`. Vercel
must remain the source of these response headers; do not replace them with a CSP
meta tag in `index.html`.

## Enforced controls

- Scripts may load only from the deployed application origin. Inline and
  evaluated scripts are prohibited.
- Supabase HTTPS and Realtime WebSocket connections are allowed. Arbitrary API
  destinations are blocked.
- Images are restricted to local assets, signed Supabase objects, Leaflet marker
  assets and OpenStreetMap tiles.
- The portal cannot be embedded in a frame and cannot load plugins or child
  frames.
- Geolocation and camera access are limited to the portal itself. Microphone,
  payment, USB, serial, Bluetooth and motion sensors are disabled.
- OAuth and printable-report popups remain usable through
  `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
- HTTPS is forced for production visits and HSTS is retained for two years.

The style policy currently permits inline styles because the component and chart
libraries generate style attributes at runtime. This exception does not apply to
scripts.

## Verification

Run:

```bash
npm run validate:security-headers
```

CI fails if a required header disappears, the essential CSP directives change,
or unsafe script execution is enabled. After staging deployment, inspect the
browser Network panel for the document response and confirm that the headers are
present. Review CSP console violations while exercising authentication, maps,
document downloads, Gmail OAuth and report printing before production promotion.

If a new external service is introduced, add only its exact required origin to
the narrowest CSP directive and document the reason here. Never add a blanket
wildcard to make a browser error disappear.
