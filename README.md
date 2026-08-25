# GFGHub

A Chrome (Manifest V3) extension that automatically syncs your **accepted
GeeksforGeeks solutions** to a GitHub repository — zero-copy after a one-time
setup. Solve a problem, get "Correct", and `solution.<ext>` lands under
`<Category>/<slug>/` in your repo.

This is the **walking skeleton**: one working end-to-end path. See
[`FURTHER_STEPS.md`](FURTHER_STEPS.md) for the deferred roadmap (README
maintenance, retry queue, store release, …).

## Prerequisites (one-time)

1. **Create a GitHub OAuth App** — <https://github.com/settings/applications/new>
   - Any name/homepage URL is fine.
   - **Tick "Enable Device Flow".** (This is what lets the extension authorize
     with no server and no client secret.)
2. Copy the **Client ID** and paste it into [`src/config.ts`](src/config.ts):
   ```ts
   export const GITHUB_CLIENT_ID = 'Iv1.xxxxxxxxxxxx'; // your Client ID
   ```

## Build & load

```bash
npm install
npm test        # unit suites: extract / detect / languages / categories / storage / github auth / github client / sync
npm run build   # bundles the extension into dist/
```

Then in Chrome:

1. Go to `chrome://extensions`, enable **Developer mode** (top-right).
2. **Load unpacked** → select the `dist/` folder.

## Use it

1. Click the GFGHub toolbar icon → **Authorize with GitHub**.
   - The device code is copied to your clipboard and GitHub's device page opens
     automatically; confirm there, and the popup flips to **✓ Connected**.
2. Pick a **target repository** from the dropdown.
3. Solve any problem at `geeksforgeeks.org/problems/...`. On a **Correct**
   verdict, your solution is committed to the repo within a few seconds. The
   popup shows the last sync status.

Wrong submissions push nothing; re-solving an already-synced problem is a no-op.

## How it works (architecture)

| Concern | File |
|---|---|
| GFG DOM selectors (the one high-churn file) | [`src/gfg/selectors.ts`](src/gfg/selectors.ts) |
| Verdict detection (MutationObserver) | [`src/gfg/detect.ts`](src/gfg/detect.ts) |
| Metadata scrape (title/difficulty/tags/slug) | [`src/gfg/extract.ts`](src/gfg/extract.ts) |
| Full-code read (Ace, MAIN world) | [`src/gfg/readCode.ts`](src/gfg/readCode.ts) |
| Language→extension, tag→folder | [`src/gfg/languages.ts`](src/gfg/languages.ts), [`src/gfg/categories.ts`](src/gfg/categories.ts) |
| Persisted state (token, repo, history, queue) | [`src/storage.ts`](src/storage.ts) |
| GitHub Device-Flow auth | [`src/github/auth.ts`](src/github/auth.ts) |
| GitHub REST client (thin `fetch`) | [`src/github/client.ts`](src/github/client.ts) |
| Sync pipeline (dedupe → commit → record) | [`src/sync.ts`](src/sync.ts) |
| Content script / service worker / popup | [`src/content/`](src/content/), [`src/background/`](src/background/), [`src/popup/`](src/popup/) |

The GitHub OAuth token is stored only in `chrome.storage.local` and is never
logged. Requested permissions are minimal: `storage` + `scripting`.
