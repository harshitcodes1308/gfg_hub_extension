// Smoke test: the extension's popup renders its first-run UI inside a real MV3
// context. Prerequisites: `npm run build` (produces ./dist), then a HEADED run
// (`npx playwright test`) — headless Chromium can't load unpacked extensions.
// This does NOT exercise the sync path (that needs a live GFG login + GitHub).
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

let context: BrowserContext;

test.afterEach(async () => {
  await context?.close();
});

test('popup renders the first-run UI', async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });

  // The MV3 service worker registers on startup; its URL carries the extension id.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extensionId = new URL(sw.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.getByRole('heading', { name: 'GFGHub' })).toBeVisible();

  // First run shows EITHER the connect button (client_id configured) OR the
  // "Not configured yet." warning — accept either so the smoke test is robust.
  const connect = page.getByRole('button', { name: /Authorize with GitHub/i });
  const notConfigured = page.getByText(/Not configured yet/i);
  await expect(connect.or(notConfigured)).toBeVisible();
});
