import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient, GitHubError, encodePath, messageForStatus } from './client';

describe('pure helpers', () => {
  it('encodes path segments but keeps slashes', () => {
    expect(encodePath('Dynamic Programming/two-sum/solution.cpp')).toBe(
      'Dynamic%20Programming/two-sum/solution.cpp',
    );
  });

  it('maps statuses to messages', () => {
    expect(messageForStatus(401)).toMatch(/reconnect/i);
    expect(messageForStatus(404)).toMatch(/not found/i);
    expect(messageForStatus(503)).toMatch(/will retry/i);
  });
});

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

describe('GitHubClient', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('sends auth + version headers', async () => {
    const fn = mockFetch([{ body: { login: 'octocat' } }]);
    await new GitHubClient('gho_x').getUser();
    const [, init] = fn.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer gho_x');
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('throws GitHubError with mapped message on failure', async () => {
    mockFetch([{ status: 401 }]);
    await expect(new GitHubClient('t').getUser()).rejects.toBeInstanceOf(GitHubError);
  });
});
