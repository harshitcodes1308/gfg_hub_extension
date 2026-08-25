# End-to-end tests (Playwright)

A single smoke test that loads the built extension into a real Chromium MV3
context and checks the popup's first-run UI renders.

## Prerequisites

1. Add Playwright (not yet a dependency):
   - add `"@playwright/test"` to `devDependencies` and run `npm install`,
   - add an npm script: `"e2e": "playwright test"`.
2. Install the browser: `npx playwright install chromium`.
3. Build the extension (produces `./dist`, which the test loads):
   `npm run build`.

## Run

```bash
npx playwright test
```

**Headed only.** MV3 unpacked extensions can't be loaded by headless Chromium the
classic way, so the config runs headed (use `xvfb-run` in CI).

## Scope

This test covers the popup's first-run render (the "GFGHub" heading plus either
the "Authorize with GitHub" button or the "Not configured yet." notice). It does
**not** exercise the sync path — that needs a live GeeksforGeeks login and a
GitHub account, which are out of scope for an automated smoke test.
