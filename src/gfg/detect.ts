// Watches the GFG submission UI for a verdict. The verdict is delivered as DOM
// text (no confirmed submission API), so we observe the result container and
// classify its text. The classifier is a pure function so it can be unit-tested
// without a live observer.
import type { Verdict } from './types';
import { GFG_SELECTORS, VERDICT_ACCEPTED, VERDICT_FAILED } from './selectors';

/** Classify result-area text. Returns null while no verdict is present yet. */
export function classifyVerdict(containerText: string): Verdict | null {
  const s = containerText.toLowerCase();
  if (VERDICT_ACCEPTED.some((t) => s.includes(t.toLowerCase()))) return 'accepted';
  if (VERDICT_FAILED.some((t) => s.includes(t.toLowerCase()))) return 'failed';
  return null;
}

export interface WaitOptions {
  root?: Document | Element;
  timeoutMs?: number;
}

/** Resolve with the first verdict ('accepted' | 'failed') that appears in the
 *  result container. Rejects with `verdict-timeout` if none arrives in time so
 *  the caller can quietly stop waiting. Checks synchronously first to catch a
 *  verdict already on screen when we start (race guard).
 *
 *  Requires a DOM (`MutationObserver`); used only in the content script. */
export function waitForVerdict(opts: WaitOptions = {}): Promise<Verdict> {
  const root = opts.root ?? document;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const target: Node =
    root.querySelector(GFG_SELECTORS.resultContainer) ??
    (root instanceof Document ? root.body : root);

  return new Promise<Verdict>((resolve, reject) => {
    let done = false;
    const observer = new MutationObserver(check);
    const timer = setTimeout(() => finish(() => reject(new Error('verdict-timeout'))), timeoutMs);

    function finish(emit: () => void) {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      emit();
    }

    function check() {
      const verdict = classifyVerdict((target as Element | Document).textContent ?? '');
      if (verdict) finish(() => resolve(verdict));
    }

    observer.observe(target, { childList: true, subtree: true, characterData: true });
    check();
  });
}
