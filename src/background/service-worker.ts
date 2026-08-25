// Service worker — the extension's coordinator. Handles popup requests
// (connect / state / repos), and on an accepted submission reads the code from
// the page's MAIN world (the one thing content scripts can't do) then runs the
// sync pipeline. MV3 kills this after ~30s idle, so it holds no durable state:
// everything persists through src/storage.ts.
import { requestDeviceCode, pollForToken } from '../github/auth';
import { GitHubClient } from '../github/client';
import { readAceCode } from '../gfg/readCode';
import { GFG_SELECTORS } from '../gfg/selectors';
import { resolveLanguage } from '../gfg/languages';
import { sync, commitSubmission, type SyncOutcome } from '../sync';
import { drainQueue } from '../drain';
import {
  getToken,
  getUser,
  getRepo,
  setRepo,
  setToken,
  getPendingAuth,
  setPendingAuth,
  clearPendingAuth,
  getQueue,
  setQueue,
  listHistory,
} from '../storage';
import type { RepoTarget } from '../storage';
import type {
  Message,
  AppState,
  ConnectResponse,
  ReposResponse,
} from '../messages';

// Best-effort, in-memory only (dies with the SW). Durable state is in storage.
let lastStatus: string | undefined;

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  handle(msg, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err?.message ?? String(err) }));
  return true; // async response
});

// --- Reliability: drain the pending-sync queue on a durable timer -----------
// MV3 kills the SW after ~30s idle, so a setTimeout retry would die with it.
// chrome.alarms survive SW restarts (FURTHER_STEPS §2).
const DRAIN_ALARM = 'gfghub-drain';

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(DRAIN_ALARM, { periodInMinutes: 5 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create(DRAIN_ALARM, { periodInMinutes: 5 }));
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DRAIN_ALARM) {
    runDrain().catch((e) => console.warn('GFGHub drain:', e?.message ?? e));
  }
});

/** One drain pass over the queue. syncOne is commitSubmission (NOT sync) so a
 *  queued item that fails again isn't re-queued — drain owns its retry count. */
async function runDrain(): Promise<void> {
  const result = await drainQueue({
    getQueue,
    setQueue,
    syncOne: (item) =>
      commitSubmission({
        meta: item.meta,
        code: item.code,
        language: item.language,
        extension: item.extension,
      }),
  });
  if (result.drained > 0) notify(`Synced ${result.drained} queued solution${result.drained === 1 ? '' : 's'}.`);
  if (result.dropped > 0) {
    notify(`Gave up on ${result.dropped} solution${result.dropped === 1 ? '' : 's'} after repeated failures.`);
  }
}

/** Fire-and-forget desktop notification. Best-effort: the permission or OS may
 *  suppress it, and chrome.notifications is absent if the permission is removed,
 *  so guard + ignore failures. Chrome requires a raster iconUrl for 'basic'. */
function notify(message: string): void {
  chrome.notifications?.create({ type: 'basic', iconUrl: 'icon-128.png', title: 'GFGHub', message });
}

async function handle(msg: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (msg.type) {
    case 'GET_STATE':
      return getState();
    case 'CONNECT_GITHUB':
      return startConnect();
    case 'LIST_REPOS':
      return listRepos();
    case 'SET_REPO':
      await setRepo(msg.repo);
      return { ok: true };
    case 'CREATE_REPO':
      return createRepo(msg);
    case 'SUBMISSION_ACCEPTED':
      return handleSubmission(msg, sender);
  }
}

/** Create a repo the user owns and set it as the sync target (§7). auto_init
 *  gives it a default branch so the first solve can commit onto it. */
async function createRepo(
  msg: Extract<Message, { type: 'CREATE_REPO' }>,
): Promise<{ repo: RepoTarget } | { error: string }> {
  const token = await getToken();
  if (!token) return { error: 'Not connected to GitHub.' };
  const info = await new GitHubClient(token).createRepo(msg.name, { private: msg.private });
  const repo: RepoTarget = {
    owner: info.owner.login,
    repo: info.name,
    branch: info.default_branch,
  };
  await setRepo(repo);
  lastStatus = `Created ${info.full_name}`;
  return { repo };
}

async function getState(): Promise<AppState> {
  const [token, user, repo, pending, recentSyncs] = await Promise.all([
    getToken(),
    getUser(),
    getRepo(),
    getPendingAuth(),
    listHistory(),
  ]);
  const connected = !!token;
  const pendingAuth =
    !connected && pending && pending.expiresAt > Date.now()
      ? { userCode: pending.userCode, verificationUri: pending.verificationUri }
      : undefined;
  return { connected, user, repo, lastStatus, pendingAuth, recentSyncs: recentSyncs.slice(0, 20) };
}

/**
 * Device flow: get a code, persist it (so the popup can re-show it after it
 * auto-closes), respond to the popup, then keep polling in the background until
 * authorized. The pending fetch loop keeps the SW alive across poll intervals.
 */
async function startConnect(): Promise<ConnectResponse> {
  const dc = await requestDeviceCode();
  await setPendingAuth({
    userCode: dc.userCode,
    verificationUri: dc.verificationUri,
    expiresAt: Date.now() + dc.expiresIn * 1000,
  });
  pollForToken(dc)
    .then(async (token) => {
      const user = await new GitHubClient(token).getUser();
      await setToken(token, { login: user.login });
      await clearPendingAuth();
      lastStatus = `Connected as @${user.login}`;
    })
    .catch(async (err) => {
      await clearPendingAuth();
      lastStatus = 'GitHub sign-in failed.';
      console.warn('device-flow:', err?.message ?? err); // never logs the token
    });
  return { userCode: dc.userCode, verificationUri: dc.verificationUri };
}

async function listRepos(): Promise<ReposResponse> {
  const token = await getToken();
  if (!token) return { repos: [] };
  const repos = await new GitHubClient(token).listRepos();
  return {
    repos: repos.map((r) => ({
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      defaultBranch: r.default_branch,
      private: r.private,
    })),
  };
}

async function handleSubmission(
  msg: Extract<Message, { type: 'SUBMISSION_ACCEPTED' }>,
  sender: chrome.runtime.MessageSender,
): Promise<SyncOutcome | { status: 'failed'; slug: string; message: string }> {
  const { meta } = msg;
  const tabId = sender.tab?.id;
  if (tabId == null) {
    return { status: 'failed', slug: meta.slug, message: 'No source tab.' };
  }

  // Selector-rot canary from the content script: log which fields came back
  // empty so a silent GFG layout change is visible (§46). We still sync — meta
  // is best-effort and the slug/URL (the parts that matter) come from the URL.
  if (msg.missing?.length) {
    console.warn('GFGHub: content script read nothing for', msg.missing.join(', '));
  }

  // Read the full buffer from the page's MAIN world — the whole reason the SW
  // is in this path. DOM scraping truncates Ace's virtualized lines.
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: readAceCode,
    args: [GFG_SELECTORS.aceEditorId],
  });
  const read = injection?.result as { code: string; aceModeId?: string } | null;
  if (!read?.code) {
    lastStatus = `Couldn't read code for ${meta.slug}.`;
    notify(lastStatus);
    return { status: 'failed', slug: meta.slug, message: lastStatus };
  }

  const { language, extension } = resolveLanguage(read.aceModeId);
  const outcome = await sync({ meta, code: read.code, language, extension });
  lastStatus = describe(outcome);
  if (outcome.status === 'synced') notify(`Synced ${outcome.slug} to GitHub.`);
  else if (outcome.status === 'failed') notify(`Couldn't sync ${outcome.slug}: ${outcome.message ?? 'failed'}`);
  return outcome;
}

function describe(o: SyncOutcome): string {
  if (o.status === 'synced') return `Synced ${o.slug} → ${o.githubPath}`;
  if (o.status === 'duplicate') return `Already synced: ${o.slug}`;
  return o.message ?? `Failed: ${o.slug}`;
}
