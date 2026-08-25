# GFGHub — Privacy Policy

_Last updated: 2026-08-25_

GFGHub is a browser extension that syncs your accepted GeeksforGeeks solutions to
a GitHub repository you own. It runs entirely in your browser and talks only to
GitHub. **There is no GFGHub server.**

## What GFGHub handles

- **Your GitHub access token.** Obtained through GitHub's official Device Flow
  when you click "Authorize with GitHub". Stored locally in `chrome.storage.local`.
  Sent only to GitHub's own API, and never logged.
- **Your solution code and problem metadata.** When you get an "Accepted" verdict,
  GFGHub reads the code you wrote and the problem's title/difficulty/tags from the
  page, and commits them to the GitHub repository you chose.

## Where your data goes

- **Only to GitHub** — `https://api.github.com` and `https://github.com` (the
  latter solely for the sign-in / device-flow step).
- **Nowhere else.** No analytics, no telemetry, no third-party servers, no
  advertising, no data brokers. GFGHub does not collect, sell, or share your data.

## What is stored, and for how long

Everything GFGHub stores lives in your browser's local extension storage:

- your GitHub token,
- your selected target repository,
- a local record of which problems you've already synced (to avoid duplicates),
- a small queue of solutions awaiting retry if a sync failed.

This data stays until you remove it. **Uninstalling the extension clears it.** You
can revoke GFGHub's access at any time from your GitHub account settings
(Settings → Applications), which invalidates the stored token.

## Permissions and why they're needed

- **storage** — save your token, chosen repo, and sync history locally.
- **scripting** — read the full solution from the page's editor at the moment of
  an accepted verdict.
- **alarms** — retry a failed sync later, reliably, after the service worker has
  gone idle.
- **notifications** — tell you when a sync succeeded or needs attention.
- **host access to geeksforgeeks.org** — detect accepted submissions and read
  your solution.
- **host access to api.github.com and github.com** — sign in and commit to your
  repository.

## Contact

Questions about this policy: `<your-contact-email>`
