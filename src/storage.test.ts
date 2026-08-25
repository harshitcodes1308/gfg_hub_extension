import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSynced,
  markSynced,
  enqueue,
  getQueue,
  setToken,
  getToken,
  getUser,
  clearAuth,
} from './storage';

// Minimal in-memory chrome.storage.local, covering the shapes storage.ts uses.
function installMockStorage(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(store, obj);
        },
        remove: async (keys: string | string[]) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
        },
      },
    },
  };
  return store;
}

beforeEach(() => installMockStorage());

describe('sync history dedupe', () => {
  it('reports synced only after markSynced', async () => {
    expect(await isSynced('two-sum')).toBe(false);
    await markSynced({
      slug: 'two-sum',
      url: 'u',
      githubPath: 'Arrays/two-sum/solution.cpp',
      timestamp: 1,
    });
    expect(await isSynced('two-sum')).toBe(true);
    expect(await isSynced('three-sum')).toBe(false);
  });
});

describe('pending queue', () => {
  it('appends and reads back', async () => {
    expect(await getQueue()).toEqual([]);
    await enqueue({
      meta: { slug: 's', url: 'u', title: 't', topics: [] },
      code: 'x',
      language: 'cpp',
      extension: '.cpp',
      attempts: 0,
    });
    expect(await getQueue()).toHaveLength(1);
  });
});

describe('auth', () => {
  it('stores and clears credentials without wiping history', async () => {
    await setToken('gho_secret', { login: 'octocat' });
    await markSynced({ slug: 'two-sum', url: 'u', githubPath: 'p', timestamp: 1 });
    expect(await getToken()).toBe('gho_secret');
    expect(await getUser()).toEqual({ login: 'octocat' });

    await clearAuth();
    expect(await getToken()).toBeUndefined();
    expect(await getUser()).toBeUndefined();
    expect(await isSynced('two-sum')).toBe(true); // history preserved (PRD Test 6)
  });
});
