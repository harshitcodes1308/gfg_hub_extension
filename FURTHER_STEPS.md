# GFGHub — Further Steps

The walking skeleton is the one end-to-end path: solve a GeeksforGeeks problem →
accepted verdict → `solution.<ext>` committed under `<Category>/<slug>/` in your
chosen GitHub repo, deduped, with status shown in the popup.

Everything below is **deliberately deferred**. It is ordered, and still held to
the ponytail-strict rule: build one concrete thing per concern, add abstraction
only when a second real implementation exists. Do **not** pre-build seams for the
Phase 2/3 items in §7.

---

## 1. README maintenance
- Per-problem `README.md` from a deterministic template (PRD §57) — problem title,
  link, difficulty, tags. No invented fields.
- Main-repo `README.md` managed section between `<!-- GFGHUB:START -->` /
  `<!-- GFGHUB:END -->` markers, preserving everything the user wrote outside them
  (PRD §22).
- Commit the solution file + both READMEs together (one logical push per solve).

## 2. Reliability (MV3-correct)
- **Drain the pending queue via `chrome.alarms`, not `setTimeout`** — the service
  worker dies after ~30s idle, so a timer-based retry never fires. `storage.ts`
  already persists the queue (`enqueue`/`getQueue`/`setQueue`); add an alarm-driven
  `drain()`.
- Exponential backoff, max 3 attempts, then surface a clear failure.
- GitHub error → user message map (started in `client.ts` `messageForStatus`; extend
  for rate-limit reset time, PRD §35/§58).
- Report partial/atomic-sync state honestly (PRD §37) — never claim success on a
  failed push.

## 3. Repository lifecycle
- "Create new repo" flow (default **Private**, PRD §7) when the user has no target.
- Branch selection + default-branch detection (PRD §7–8) — the client already reads
  `default_branch`; expose it in the picker.
- Re-solve policy (PRD §24): update / keep-versions / ignore. Today a re-solve is a
  no-op via local dedupe (`isSynced`) — make the behavior a setting.

## 4. Full options + UX
- Options page: folder scheme, file naming, notification prefs, debug logging.
- Chrome notifications on sync success/failure (PRD §33) — throttled, never spammy.
- Sync-history view backed by `getHistory()` (PRD §38).
- **Selector health-check** (PRD §46): when a selector matches nothing, surface
  "couldn't read <X>" instead of silently skipping — this is the #1 GFG risk
  (hashed CSS-module classes changed silently ~March 2026). Also probe
  `__NEXT_DATA__` as a more stable metadata source than hashed classes.

## 5. Store release
- Privacy policy (HTTPS-hosted), extension icons (`public/`, wired in `manifest.json`),
  screenshots, store listing copy.
- Minimal-permission audit (PRD §27/§70) — we ship `storage` + `scripting` only today;
  keep it that way.
- Production ZIP + Chrome Web Store review submission.

## 6. Testing
- Playwright integration test against a real `/problems/` page (or a saved fixture DOM).
- The manual browser matrix from PRD §47/§69.

## 7. Explicitly out of scope (Phase 2/3 — do not build seams for these)
- AI explanations / AI categorization.
- Multi-platform adapters (LeetCode, etc.). The PRD's `CodingPlatformAdapter`
  interface was intentionally **not** built — reintroduce an interface only when a
  second platform actually lands.
- Analytics.

---

## Known skeleton limitations (fix in the milestones above)
- **SPA navigation:** the verdict observer is armed at page load; GeeksforGeeks is a
  Next.js SPA, so navigating between problems without a full reload may leave the
  observer watching a stale container. A full reload re-arms it. (→ §2/§4.)
- **No retry drain yet:** failed syncs are queued but only retried on the next manual
  solve. (→ §2.)
- **`client_id` must be filled in:** see `src/config.ts` and the README. Until then,
  "Authorize with GitHub" cannot complete.
