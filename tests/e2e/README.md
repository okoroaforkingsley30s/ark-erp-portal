# Browser journey tests

Run `npm run test:e2e` after installing Chromium with
`npx playwright install chromium`. The default suite starts a local Vite server
with non-production Supabase placeholders and clears browser storage before each
test.

The suite covers desktop and mobile authentication entry, registration switching,
empty reset-email validation, expired password links, protected-route denial, and
unknown-route recovery. Authenticated ERP journeys should use disposable Supabase
test users and `PLAYWRIGHT_BASE_URL`; never point these tests at production.
