import { drainQueue, type DrainDeps } from './drain';
import type { PendingSync } from './storage';

// A pending item with a distinct slug and a given prior attempt count.
function item(attempts = 0, slug = 's'): PendingSync {
  return {
    meta: { slug, url: `https://gfg/problems/${slug}`, title: slug, topics: [] },
    code: 'x',
    language: 'cpp',
    extension: '.cpp',
    attempts,
  };
}

// Inline fake deps over a plain array, with int/array spies for setQueue.
function fakeDeps(
  queue: PendingSync[],
  syncOne: DrainDeps['syncOne'],
  maxAttempts?: number,
) {
  const spy = { setQueueCalls: 0, written: null as PendingSync[] | null };
  const deps: DrainDeps = {
    getQueue: async () => queue,
    setQueue: async (q) => {
      spy.setQueueCalls++;
      spy.written = q;
    },
    syncOne,
    maxAttempts,
  };
  return { deps, spy };
}

describe('drainQueue', () => {
  it('is a no-op on an empty queue and never calls setQueue', async () => {
    const { deps, spy } = fakeDeps([], async () => ({ status: 'synced' }));
    expect(await drainQueue(deps)).toEqual({ drained: 0, kept: 0, dropped: 0 });
    expect(spy.setQueueCalls).toBe(0);
    expect(spy.written).toBeNull();
  });

  it('drains a synced item and writes an empty queue', async () => {
    const { deps, spy } = fakeDeps([item()], async () => ({ status: 'synced' }));
    expect(await drainQueue(deps)).toEqual({ drained: 1, kept: 0, dropped: 0 });
    expect(spy.setQueueCalls).toBe(1);
    expect(spy.written).toEqual([]);
  });

  it('treats a duplicate as success and removes it', async () => {
    const { deps, spy } = fakeDeps([item()], async () => ({ status: 'duplicate' }));
    expect(await drainQueue(deps)).toEqual({ drained: 1, kept: 0, dropped: 0 });
    expect(spy.written).toEqual([]);
  });

  it('keeps a failure under maxAttempts, bumping attempts', async () => {
    const it0 = item(0);
    const { deps, spy } = fakeDeps([it0], async () => ({ status: 'failed' }), 3);
    expect(await drainQueue(deps)).toEqual({ drained: 0, kept: 1, dropped: 0 });
    expect(spy.setQueueCalls).toBe(1);
    expect(spy.written).toEqual([{ ...it0, attempts: 1 }]);
    expect(spy.written?.[0].attempts).toBe(1);
  });

  it('drops a failure that reaches maxAttempts', async () => {
    const { deps, spy } = fakeDeps([item(2)], async () => ({ status: 'failed' }), 3);
    expect(await drainQueue(deps)).toEqual({ drained: 0, kept: 0, dropped: 1 });
    expect(spy.setQueueCalls).toBe(1);
    expect(spy.written).toEqual([]);
  });

  describe('a thrown syncOne is treated as a failure', () => {
    it('bumps and keeps when under maxAttempts', async () => {
      const it0 = item(0);
      const { deps, spy } = fakeDeps([it0], async () => {
        throw new Error('boom');
      }, 3);
      expect(await drainQueue(deps)).toEqual({ drained: 0, kept: 1, dropped: 0 });
      expect(spy.written).toEqual([{ ...it0, attempts: 1 }]);
    });

    it('bumps and drops when it reaches maxAttempts', async () => {
      const { deps, spy } = fakeDeps([item(2)], async () => {
        throw new Error('boom');
      }, 3);
      expect(await drainQueue(deps)).toEqual({ drained: 0, kept: 0, dropped: 1 });
      expect(spy.written).toEqual([]);
    });

    it('does not abort the rest of the pass', async () => {
      let calls = 0;
      const { deps } = fakeDeps([item(0, 'a'), item(0, 'b')], async (entry) => {
        calls++;
        if (entry.meta.slug === 'a') throw new Error('boom');
        return { status: 'synced' };
      }, 3);
      // 'a' throws (kept), 'b' still syncs (drained) — the throw didn't stop us.
      expect(await drainQueue(deps)).toEqual({ drained: 1, kept: 1, dropped: 0 });
      expect(calls).toBe(2);
    });
  });

  it('processes items sequentially, never overlapping', async () => {
    let inFlight = false;
    let overlap = false;
    const { deps } = fakeDeps([item(0, 'a'), item(0, 'b'), item(0, 'c')], async () => {
      if (inFlight) overlap = true;
      inFlight = true;
      await Promise.resolve();
      inFlight = false;
      return { status: 'synced' };
    });
    await drainQueue(deps);
    expect(overlap).toBe(false);
  });

  it('handles a mixed batch and writes exactly the survivors', async () => {
    const a = item(0, 'a'); // syncs → drained
    const b = item(0, 'b'); // fails under max → kept, attempts 1
    const c = item(2, 'c'); // fails at max → dropped
    const { deps, spy } = fakeDeps([a, b, c], async (entry) => {
      if (entry.meta.slug === 'a') return { status: 'synced' };
      return { status: 'failed' };
    }, 3);
    expect(await drainQueue(deps)).toEqual({ drained: 1, kept: 1, dropped: 1 });
    expect(spy.setQueueCalls).toBe(1);
    expect(spy.written).toEqual([{ ...b, attempts: 1 }]);
  });
});
