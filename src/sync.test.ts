import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sync, commitSubmission, buildPath, withRetry } from './sync';
import { GitHubError } from './github/client';
import { setToken, setRepo, markSynced, isSynced, getQueue } from './storage';
import type { Submission } from './gfg/types';

function installMockStorage() {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (obj: Record<string, unknown>) => void Object.assign(store, obj),
        remove: async (keys: string | string[]) =>
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]),
      },
    },
  };
}

function mockFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => r.body ?? {},
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

const SUBMISSION: Submission = {
  meta: { slug: 'two-sum', url: 'https://gfg/problems/two-sum/1', title: 'Two Sum', topics: ['Arrays'] },
  code: 'int main(){}',
  language: 'cpp',
  extension: '.cpp',
};

beforeEach(async () => {
  vi.unstubAllGlobals();
  installMockStorage();
  await setToken('gho_x', { login: 'me' });
  await setRepo({ owner: 'me', repo: 'gfg', branch: 'main' });
});

describe('buildPath', () => {
  it('is <Category>/<slug>/solution<ext>', () => {
    expect(buildPath(SUBMISSION.meta, '.cpp')).toBe('Arrays/two-sum/solution.cpp');
    expect(buildPath(SUBMISSION.meta, '.py')).toBe('Arrays/two-sum/solution.py');
  });
});

describe('withRetry', () => {
  it('retries a 5xx then succeeds', async () => {
    let n = 0;
    const out = await withRetry(
      async () => {
        if (n++ === 0) throw new GitHubError(503, 'down');
        return 'ok';
      },
      { baseDelayMs: 0 },
    );
    expect(out).toBe('ok');
    expect(n).toBe(2);
  });

  it('does not retry a 422', async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n++;
          throw new GitHubError(422, 'invalid');
        },
        { baseDelayMs: 0 },
      ),
    ).rejects.toBeInstanceOf(GitHubError);
    expect(n).toBe(1);
  });
});

describe('sync', () => {
  it('short-circuits an already-synced slug without touching the network', async () => {
    await markSynced({ slug: 'two-sum', url: 'u', githubPath: 'p', timestamp: 1 });
    const fn = mockFetch([]);
    expect(await sync(SUBMISSION)).toMatchObject({ status: 'duplicate', slug: 'two-sum' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('commits the solution + READMEs in one commit and records it', async () => {
    mockFetch([
      { status: 404 }, //                    getTextFile README → none yet
      { body: { object: { sha: 'base' } } }, // GET ref/heads/main
      { body: { tree: { sha: 'basetree' } } }, // GET base commit
      { body: { sha: 'newtree' } }, //        POST git/trees
      { body: { sha: 'c0ffee' } }, //         POST git/commits
      { body: {} }, //                        PATCH ref
    ]);
    const out = await sync(SUBMISSION);
    expect(out).toEqual({ status: 'synced', slug: 'two-sum', githubPath: 'Arrays/two-sum/solution.cpp' });
    expect(await isSynced('two-sum')).toBe(true);
  });

  it('fails when not connected, without marking synced', async () => {
    installMockStorage(); // wipe the seeded token/repo
    const out = await sync(SUBMISSION);
    expect(out.status).toBe('failed');
    expect(await isSynced('two-sum')).toBe(false);
  });

  it('queues the submission on a terminal failure', async () => {
    mockFetch([{ status: 404 }, { status: 422 }]); // README read, then the commit's first call rejects
    const out = await sync(SUBMISSION);
    expect(out.status).toBe('failed');
    expect(await isSynced('two-sum')).toBe(false);
    expect(await getQueue()).toHaveLength(1);
  });

  it('commitSubmission reports failure WITHOUT queuing (the drain calls it directly)', async () => {
    mockFetch([{ status: 404 }, { status: 422 }]);
    const out = await commitSubmission(SUBMISSION);
    expect(out.status).toBe('failed');
    expect(await getQueue()).toHaveLength(0);
  });
});
