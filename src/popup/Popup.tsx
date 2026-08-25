import { useEffect, useRef, useState } from 'react';
import { clientIdConfigured } from '../config';
import type {
  Message,
  AppState,
  ConnectResponse,
  ReposResponse,
  RepoOption,
} from '../messages';

function send<T = unknown>(msg: Message): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

// Presentation helper: format a sync's timestamp as "Aug 25, 2026 • 7:47 PM".
function fmtWhen(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} • ${time}`;
}

export function Popup() {
  const [state, setState] = useState<AppState | null>(null);
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function refresh(): Promise<AppState> {
    const s = await send<AppState>({ type: 'GET_STATE' });
    setState(s);
    return s;
  }

  // The SW polls GitHub in the background; the popup just re-checks state until
  // it flips to connected. Idempotent so mount + connect() can both call it.
  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = window.setInterval(async () => {
      const s = await refresh();
      if (s.connected) {
        stopPolling();
        setPendingCode(null);
        setPendingUri(null);
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => {
    refresh();
    return () => stopPolling();
  }, []);

  // Recover an in-progress login. Chrome closes the popup when the GitHub tab
  // opens, so on reopen we re-show the code the SW persisted and resume polling.
  useEffect(() => {
    if (state?.pendingAuth && !state.connected) {
      setPendingCode(state.pendingAuth.userCode);
      setPendingUri(state.pendingAuth.verificationUri);
      startPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.pendingAuth?.userCode, state?.connected]);

  useEffect(() => {
    if (state?.connected) {
      send<ReposResponse>({ type: 'LIST_REPOS' }).then((r) => setRepos(r.repos));
    }
  }, [state?.connected]);

  async function connect() {
    setError(null);
    const resp = await send<ConnectResponse & { error?: string }>({ type: 'CONNECT_GITHUB' });
    // Never open a blank tab: bail loudly if the handshake didn't return a code.
    if (!resp || resp.error || !resp.verificationUri) {
      setError(resp?.error ?? 'Could not start GitHub sign-in. See the service-worker console.');
      return;
    }
    setPendingCode(resp.userCode);
    setPendingUri(resp.verificationUri);
    // Copy the code now so all the user does on GitHub is paste it. The big code
    // below is the fallback if the clipboard is blocked.
    try {
      await navigator.clipboard.writeText(resp.userCode);
    } catch {
      /* no clipboard permission — the visible code covers it */
    }
    startPolling();
  }

  // Opening a tab closes the popup, so do it only on an explicit click, after
  // the code is already on screen. The SW persisted the code, so reopening the
  // popup re-shows it (see the pendingAuth effect above).
  function openGitHub() {
    if (pendingUri) chrome.tabs.create({ url: pendingUri });
  }

  async function chooseRepo(fullName: string) {
    const r = repos.find((x) => x.fullName === fullName);
    if (!r) return;
    await send({ type: 'SET_REPO', repo: { owner: r.owner, repo: r.name, branch: r.defaultBranch } });
    refresh();
  }

  // Create a new repo (default private) and adopt it as the target. The SW sets
  // it as the repo, so we just refresh state + the picker afterward.
  async function createRepo() {
    const name = newRepoName.trim();
    if (!name) return;
    setError(null);
    setCreating(true);
    try {
      const resp = await send<{ error?: string }>({ type: 'CREATE_REPO', name, private: newRepoPrivate });
      if (resp?.error) {
        setError(resp.error);
        return;
      }
      setNewRepoName('');
      const s = await refresh();
      if (s.connected) send<ReposResponse>({ type: 'LIST_REPOS' }).then((r) => setRepos(r.repos));
    } finally {
      setCreating(false);
    }
  }

  const currentRepo = state?.repo ? `${state.repo.owner}/${state.repo.repo}` : '';

  return (
    <div className="panel">
      <h1 className="brand">
        <span className="brand-gfg">GFG</span>
        <span className="brand-hub">Hub</span>
      </h1>

      {!state && <p className="muted">Loading…</p>}

      {state && !state.connected && !pendingCode && !clientIdConfigured && (
        <div className="warn">
          <strong>Not configured yet.</strong>
          <p>
            Create a GitHub OAuth App with <em>Device Flow</em> enabled, paste its Client ID into{' '}
            <code>src/config.ts</code>, then run <code>npm run build</code> and reload the
            extension.
          </p>
        </div>
      )}

      {state && !state.connected && !pendingCode && clientIdConfigured && (
        <button className="btn-primary" onClick={connect}>
          Authorize with GitHub
        </button>
      )}

      {error && <p className="error">{error}</p>}

      {pendingCode && !state?.connected && (
        <div>
          <p className="muted">Your one-time code (copied to your clipboard):</p>
          <div className="code">{pendingCode}</div>
          <button className="btn-primary" onClick={openGitHub}>
            Open GitHub sign-in page
          </button>
          <p className="hint">
            On the GitHub tab, paste the code (⌘V / Ctrl-V) and confirm. This popup updates
            on its own — if it closes, click the extension icon again to see the code.
          </p>
        </div>
      )}

      {state?.connected && (
        <div>
          <div className="status-pill">
            Connected as <span className="user">@{state.user?.login}</span>
          </div>

          <label className="field">
            <span className="field-label">Target repository</span>
            <select
              className="select"
              value={currentRepo}
              onChange={(e) => chooseRepo(e.target.value)}
            >
              <option value="" disabled>
                {repos.length ? 'Choose a repository…' : 'Loading repositories…'}
              </option>
              {repos.map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}
                  {r.private ? ' (private)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="or-divider">…or create a new one</div>

          <div className="create-row">
            <input
              className="text-input"
              placeholder="new-repo-name"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createRepo()}
            />
            <button className="btn-create" disabled={!newRepoName.trim() || creating} onClick={createRepo}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={newRepoPrivate}
              onChange={(e) => setNewRepoPrivate(e.target.checked)}
            />
            Private repository
          </label>

          <div className="stats">
            <div className="stat easy">
              <span className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6" />
                </svg>
              </span>
              <span className="stat-label">Easy</span>
              <span className="stat-count">{state.stats?.easy ?? 0}</span>
            </div>
            <div className="stat medium">
              <span className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 10h8" />
                  <path d="M8 14h8" />
                </svg>
              </span>
              <span className="stat-label">Medium</span>
              <span className="stat-count">{state.stats?.medium ?? 0}</span>
            </div>
            <div className="stat hard">
              <span className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 20v-6" />
                  <path d="M12 20V8" />
                  <path d="M18 20v-9" />
                </svg>
              </span>
              <span className="stat-label">Hard</span>
              <span className="stat-count">{state.stats?.hard ?? 0}</span>
            </div>
          </div>

          {state.recentSyncs && state.recentSyncs.length > 0 && (
            <div className="recent">
              <p className="recent-head">Recent syncs</p>
              <ul className="sync-list">
                {state.recentSyncs.slice(0, 8).map((r) => (
                  <li key={r.slug} className="sync-row">
                    <span className="sync-main">
                      <span className="sync-title">{r.title ?? r.slug}</span>
                      {r.timestamp ? <span className="sync-date">{fmtWhen(r.timestamp)}</span> : null}
                    </span>
                    {r.category ? <span className="sync-cat">{r.category}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state?.lastStatus && (
        <p className="status-bar">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v5h-5" />
          </svg>
          {state.lastStatus}
        </p>
      )}
    </div>
  );
}
