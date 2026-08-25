// Empties the pending-sync queue on a chrome.alarms tick (FURTHER_STEPS §2).
// MV3 kills the service worker after ~30s idle, so retries can't use setTimeout;
// an alarm wakes the SW and calls this. The alarm interval IS the backoff — no
// timer/backoff logic lives here (per-attempt retry is withRetry in sync.ts).
//
// Pure orchestration: no chrome APIs and no storage import at runtime —
// everything is dependency-injected so the SW can wire real deps and tests can
// pass plain fakes.
import type { PendingSync } from './storage';

export interface DrainDeps {
  getQueue(): Promise<PendingSync[]>;
  setQueue(queue: PendingSync[]): Promise<void>;
  /** Attempt one item. Resolves to the outcome. */
  syncOne(item: PendingSync): Promise<{ status: 'synced' | 'duplicate' | 'failed' }>;
  /** Max attempts before giving up on an item. Default 3. */
  maxAttempts?: number;
}

export interface DrainResult {
  drained: number;
  kept: number;
  dropped: number;
}

/**
 * Process the pending queue once, sequentially. Successful/duplicate items are
 * removed; failures (or a thrown syncOne) have their attempts bumped and are
 * kept for the next alarm, or dropped once they hit maxAttempts. Survivors are
 * written back with their bumped attempts. An empty queue is a no-op (setQueue
 * is not called). A single throw never aborts the whole pass.
 */
export async function drainQueue(deps: DrainDeps): Promise<DrainResult> {
  const maxAttempts = deps.maxAttempts ?? 3;
  const queue = await deps.getQueue();
  if (queue.length === 0) return { drained: 0, kept: 0, dropped: 0 };

  let drained = 0;
  let dropped = 0;
  const remaining: PendingSync[] = [];

  for (const item of queue) {
    let status: 'synced' | 'duplicate' | 'failed';
    try {
      status = (await deps.syncOne(item)).status;
    } catch {
      status = 'failed'; // a throw is just a failure — bump and keep/drop below.
    }

    if (status === 'synced' || status === 'duplicate') {
      drained++;
      continue;
    }

    const attempts = item.attempts + 1;
    if (attempts >= maxAttempts) dropped++;
    else remaining.push({ ...item, attempts });
  }

  await deps.setQueue(remaining);
  return { drained, kept: remaining.length, dropped };
}
