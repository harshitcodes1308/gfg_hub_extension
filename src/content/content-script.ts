// Runs on geeksforgeeks.org/problems/*. Watches for an accepted verdict, scrapes
// problem metadata from the DOM, and hands it to the service worker. It does NOT
// read the code — that needs the page's MAIN world, which only the SW can reach
// via chrome.scripting (isolated content scripts can't see window.ace).
import { waitForVerdict } from '../gfg/detect';
import { extractMeta, slugFromUrl, missingMetaFields } from '../gfg/extract';
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
        // Warn only about fields we genuinely couldn't recover (from __NEXT_DATA__
        // OR the DOM), so a real GFG layout change stays visible (§46) without
        // crying wolf when only the fallback DOM selector rotted but __NEXT_DATA__
        // still had the data. The sync proceeds regardless — slug/URL come from
        // the address bar, so the commit itself is never blocked.
        const missing = missingMetaFields(meta);
        if (missing.length) {
          console.warn(
            `GFGHub: couldn't read ${missing.join(', ')} for this problem — it will still ` +
              'sync, but its category or details may be incomplete (GFG layout may have changed).',
          );
        }
        const msg: SubmissionAcceptedMsg = {
          type: 'SUBMISSION_ACCEPTED',
          meta,
          missing,
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
