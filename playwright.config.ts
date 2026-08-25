import { defineConfig } from '@playwright/test';

// Playwright is intentionally NOT a dependency of the build/typecheck path —
// this config and the e2e/ specs are excluded from tsconfig's `include`, so
// `@playwright/test` being absent never breaks `npm run build` or `tsc`.
// Install it only when you actually want to run these tests (see e2e/README.md).
//
// MV3 extensions require a HEADED persistent context (headless Chromium can't
// load an unpacked extension the classic way — use xvfb in CI). Each spec
// launches its own persistent context via chromium.launchPersistentContext
// (see e2e/popup.spec.ts), so there is no shared `use.browser` here.
// Run `npm run build` first to produce ./dist, which the specs load.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one Chromium instance with the extension at a time
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
});
