// Typed wrapper over chrome.storage.local. The single source of persisted
// state: GitHub token, target repo, sync history (dedupe), and the
// pending-sync queue that survives service-worker restarts (MV3 kills the SW
// after ~30s idle, so nothing durable may live only in memory).
//
// Storing the OAuth token in chrome.storage.local (not localStorage) per
// PRD §28. Never logged.
import type { ProblemMeta } from './gfg/types';

export interface RepoTarget {
  owner: string;
  repo: string;
  branch: string;
}

/** One synced problem, keyed by slug (PRD §38). */
export interface SyncRecord {
  slug: string;
  url: string;
  githubPath: string;
  commitSha?: string;
  timestamp: number;
  /** Display fields for the README index + popup history (optional: older
   *  records and tag-less problems may lack them). */
  title?: string;
  difficulty?: string;
  category?: string;
}

/** A submission awaiting (re)sync after a failure/offline (PRD §34). */
export interface PendingSync {
  meta: ProblemMeta;
  code: string;
  language: string;
  extension: string;
  attempts: number;
}

/** An in-progress device-flow login. Persisted so the popup can re-show the
 *  code after it auto-closes (Chrome closes popups when a new tab takes focus). */
export interface PendingAuth {
  userCode: string;
  verificationUri: string;
  expiresAt: number;
}

interface Schema {
  token?: string;
  user?: { login: string };
  repo?: RepoTarget;
  history?: Record<string, SyncRecord>;
  queue?: PendingSync[];
  pendingAuth?: PendingAuth;
}

async function get<K extends keyof Schema>(key: K): Promise<Schema[K]> {
  const obj = await chrome.storage.local.get(key);
  return obj[key] as Schema[K];
}

async function set<K extends keyof Schema>(key: K, value: Schema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// --- Auth -----------------------------------------------------------------
export const getToken = () => get('token');
export const setToken = (token: string, user: { login: string }) =>
  chrome.storage.local.set({ token, user });
export const getUser = () => get('user');
/** Clear credentials only (PRD Test 6: logout → re-auth, keep sync history). */
export const clearAuth = () => chrome.storage.local.remove(['token', 'user']);

// --- Pending device-flow login --------------------------------------------
export const getPendingAuth = () => get('pendingAuth');
export const setPendingAuth = (p: PendingAuth) => set('pendingAuth', p);
export const clearPendingAuth = () => chrome.storage.local.remove('pendingAuth');

// --- Repo -----------------------------------------------------------------
export const getRepo = () => get('repo');
export const setRepo = (repo: RepoTarget) => set('repo', repo);

// --- Sync history (dedupe) ------------------------------------------------
export async function isSynced(slug: string): Promise<boolean> {
  const history = (await get('history')) ?? {};
  return slug in history;
}

export async function markSynced(record: SyncRecord): Promise<void> {
  const history = (await get('history')) ?? {};
  history[record.slug] = record;
  await set('history', history);
}

// --- Pending queue --------------------------------------------------------
export async function enqueue(item: PendingSync): Promise<void> {
  const queue = (await get('queue')) ?? [];
  queue.push(item);
  await set('queue', queue);
}

export async function getQueue(): Promise<PendingSync[]> {
  return (await get('queue')) ?? [];
}

/** Replace the whole queue — used by the alarm-driven drain to write back the
 *  remaining items after a pass (FURTHER_STEPS §2). */
export const setQueue = (queue: PendingSync[]) => set('queue', queue);

// --- Sync history (view) --------------------------------------------------
/** All synced problems, most-recent first, for the popup history list (§38). */
export async function listHistory(): Promise<SyncRecord[]> {
  const history = (await get('history')) ?? {};
  return Object.values(history).sort((a, b) => b.timestamp - a.timestamp);
}
