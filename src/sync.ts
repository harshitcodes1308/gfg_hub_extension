// The whole sync path in one linear function — the PRD's state machine (§11),
// retry-manager (§34), and 5-strategy duplicate-detector (§23) collapsed to:
// dedupe → build files → one atomic commit (with a couple of retries) → record.
// Status is a plain string union (src/gfg/types.ts), not a state engine.
//
// Each solve commits THREE files in one commit (§20): the solution, a per-problem
// README, and the repo's main README with its auto-maintained index refreshed.
import type { Submission, SyncStatus } from './gfg/types';
import { primaryCategory } from './gfg/categories';
import { GitHubClient, GitHubError } from './github/client';
import { problemReadme, upsertManagedSection } from './github/readme';
import {
  getToken,
  getRepo,
  isSynced,
  markSynced,
  enqueue,
  listHistory,
} from './storage';
import type { SyncRecord } from './storage';

export interface SyncOutcome {
  status: Extract<SyncStatus, 'synced' | 'duplicate' | 'failed'>;
  slug: string;
  githubPath?: string;
  message?: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transient failures worth retrying: GitHub 5xx/429, or a network error. */
function isRetryable(err: unknown): boolean {
  if (err instanceof GitHubError) return err.status >= 500 || err.status === 429;
  return err instanceof TypeError; // fetch network failure
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === retries) throw err;
      await delay(baseDelayMs * 2 ** attempt); // 500ms, 1s
    }
  }
  throw lastErr;
}

/** `<Category>/<slug>/solution<ext>` — deterministic, category = first Topic Tag.
 *  File naming is fixed to `solution`; the options page (FURTHER_STEPS §4) can
 *  reintroduce a setting once there's UI to change it. */
export function buildPath(meta: Submission['meta'], extension: string): string {
  const category = primaryCategory(meta.topics);
  return `${category}/${meta.slug}/solution${extension}`;
}

/**
 * Attempt to commit one accepted submission to GitHub. Idempotent: local dedupe
 * short-circuits, and the commit overwrites by path (create-or-update), so a
 * retry after a partial success can't double-write.
 *
 * Pure attempt — it does NOT touch the pending queue. `sync()` wraps this to
 * enqueue on failure; the alarm-driven drain calls it directly (so a queued item
 * can't be re-queued on each pass).
 */
export async function commitSubmission(submission: Submission): Promise<SyncOutcome> {
  const { meta, code, extension } = submission;

  if (await isSynced(meta.slug)) {
    return { status: 'duplicate', slug: meta.slug };
  }

  const token = await getToken();
  const repo = await getRepo();
  if (!token) return { status: 'failed', slug: meta.slug, message: 'Not connected to GitHub.' };
  if (!repo) return { status: 'failed', slug: meta.slug, message: 'No target repository set.' };

  const solutionPath = buildPath(meta, extension);
  const dir = solutionPath.slice(0, solutionPath.lastIndexOf('/'));
  const record: SyncRecord = {
    slug: meta.slug,
    url: meta.url,
    githubPath: solutionPath,
    timestamp: Date.now(),
    title: meta.title,
    difficulty: meta.difficulty,
    category: primaryCategory(meta.topics),
  };
  const client = new GitHubClient(token);

  try {
    const { commitSha } = await withRetry(async () => {
      // Re-read the main README each attempt so a retry rebases its managed
      // section onto the latest content (getTextFile → undefined if absent).
      const existingIndex = await client.getTextFile(repo.owner, repo.repo, 'README.md', repo.branch);
      const index = [record, ...(await listHistory()).filter((r) => r.slug !== record.slug)];
      return client.commitFiles(repo.owner, repo.repo, {
        branch: repo.branch,
        message: `Add ${meta.title} [GFGHub]`,
        files: [
          { path: solutionPath, content: code },
          { path: `${dir}/README.md`, content: problemReadme(meta) },
          { path: 'README.md', content: upsertManagedSection(existingIndex, index) },
        ],
      });
    });
    await markSynced({ ...record, commitSha });
    return { status: 'synced', slug: meta.slug, githubPath: solutionPath };
  } catch (err) {
    const message = err instanceof GitHubError ? err.message : 'Sync failed.';
    return { status: 'failed', slug: meta.slug, message };
  }
}

/**
 * Sync an accepted submission and, on a *transient* failure, queue it for the
 * alarm-driven drain (FURTHER_STEPS §2). Config problems (no token / no repo)
 * aren't queued — retrying can't fix them until the user acts.
 */
export async function sync(submission: Submission): Promise<SyncOutcome> {
  const outcome = await commitSubmission(submission);
  if (outcome.status === 'failed' && (await getToken()) && (await getRepo())) {
    const { meta, code, language, extension } = submission;
    await enqueue({ meta, code, language, extension, attempts: 1 });
  }
  return outcome;
}
