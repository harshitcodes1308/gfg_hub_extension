// Runs on geeksforgeeks.org/problems/*. Watches for an accepted verdict, scrapes
// problem metadata from the DOM, and hands it to the service worker. It does NOT
// read the code — that needs the page's MAIN world, which only the SW can reach
// via chrome.scripting (isolated content scripts can't see window.ace).
import { waitForVerdict } from '../gfg/detect';
import { extractMeta, slugFromUrl, checkSelectorHealth } from '../gfg/extract';
import type { SubmissionAcceptedMsg } from '../messages';

// Slug we've already reported this page-load — avoids re-sending while the
// "accepted" banner lingers in the DOM. Server-side isSynced() is the real
// dedupe; this just keeps us from spamming the SW.
let lastReportedSlug = '';

async function watch(): Promise<void> {
  for (;;) {
    let verdict: 'accepted' | 'failed' | null = null;
    try {
      verdict = await waitForVerdict();
    } catch {
      // timeout — the observer disconnected; just re-arm below.
    }

    if (verdict === 'accepted') {
      const slug = slugFromUrl(location.href);
      if (slug && slug !== lastReportedSlug) {
        lastReportedSlug = slug;
        const meta = extractMeta(document.body, location.href);
        // Selector-rot canary: if the DOM yields nothing for a field, say so in
        // the console and pass it along, rather than silently committing gaps.
        const health = checkSelectorHealth(document.body);
        if (!health.ok) {
          console.warn(
            `GFGHub: page selectors returned nothing for ${health.missing.join(', ')} — ` +
              'extraction may be degraded (GFG layout changed?).',
          );
        }
        const msg: SubmissionAcceptedMsg = {
          type: 'SUBMISSION_ACCEPTED',
          meta,
          missing: health.missing,
        };
        chrome.runtime.sendMessage(msg).catch(() => {
          /* SW asleep or context torn down — next verdict re-arms. */
        });
      }
    }

    // Small pause so a persistent verdict banner can't spin this loop.
    await new Promise((r) => setTimeout(r, 1500));
  }
}

watch();
