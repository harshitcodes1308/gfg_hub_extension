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
    <div style={S.root}>
      <h1 style={S.h1}>GFGHub</h1>

      {!state && <p style={S.muted}>Loading…</p>}

      {state && !state.connected && !pendingCode && !clientIdConfigured && (
        <div style={S.warn}>
          <strong>Not configured yet.</strong>
          <p style={{ margin: '6px 0 0' }}>
            Create a GitHub OAuth App with <em>Device Flow</em> enabled, paste its Client ID into{' '}
            <code>src/config.ts</code>, then run <code>npm run build</code> and reload the
            extension.
          </p>
        </div>
      )}

      {state && !state.connected && !pendingCode && clientIdConfigured && (
        <button style={S.primary} onClick={connect}>
          Authorize with GitHub
        </button>
      )}

      {error && <p style={S.error}>{error}</p>}

      {pendingCode && !state?.connected && (
        <div>
          <p style={S.muted}>Your one-time code (copied to your clipboard):</p>
          <div style={S.code}>{pendingCode}</div>
          <button style={S.primary} onClick={openGitHub}>
            Open GitHub sign-in page
          </button>
          <p style={S.hint}>
            On the GitHub tab, paste the code (⌘V / Ctrl-V) and confirm. This popup updates
            on its own — if it closes, click the extension icon again to see the code.
          </p>
        </div>
      )}

      {state?.connected && (
        <div>
          <p style={S.connected}>✓ Connected as @{state.user?.login}</p>
          <label style={S.label}>
            Target repository
            <select
              style={S.select}
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

          <p style={S.orLabel}>…or create a new one</p>
          <div style={S.createRow}>
            <input
              style={S.input}
              placeholder="new-repo-name"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createRepo()}
            />
            <button style={S.secondary} disabled={!newRepoName.trim() || creating} onClick={createRepo}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
          <label style={S.checkRow}>
            <input
              type="checkbox"
              checked={newRepoPrivate}
              onChange={(e) => setNewRepoPrivate(e.target.checked)}
            />
            Private repository
          </label>

          {state.recentSyncs && state.recentSyncs.length > 0 && (
            <div style={S.history}>
              <p style={S.historyHead}>Recent syncs</p>
              <ul style={S.list}>
                {state.recentSyncs.slice(0, 8).map((r) => (
                  <li key={r.slug} style={S.item}>
                    <span style={S.itemTitle}>{r.title ?? r.slug}</span>
                    <span style={S.itemMeta}>{r.category ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state?.lastStatus && <p style={S.status}>{state.lastStatus}</p>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    width: 320,
    padding: 16,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 14,
    color: '#1a1a1a',
    boxSizing: 'border-box',
  },
  h1: { margin: '0 0 12px', fontSize: 18, color: '#2f8d46' },
  muted: { color: '#666', margin: '8px 0' },
  primary: {
    width: '100%',
    padding: '10px 12px',
    background: '#2f8d46',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
  },
  hint: { color: '#666', fontSize: 12, lineHeight: 1.4, margin: '10px 0 0' },
  code: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: 24,
    letterSpacing: 2,
    textAlign: 'center',
    padding: '10px 0',
    background: '#f3f4f6',
    borderRadius: 6,
    marginBottom: 10,
  },
  connected: { color: '#2f8d46', fontWeight: 600, margin: '0 0 12px' },
  warn: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    color: '#7c2d12',
    lineHeight: 1.4,
  },
  error: {
    marginTop: 12,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    color: '#991b1b',
    wordBreak: 'break-word',
  },
  label: { display: 'block', color: '#444', fontSize: 12 },
  select: { display: 'block', width: '100%', marginTop: 4, padding: 6, fontSize: 14 },
  orLabel: { color: '#888', fontSize: 12, margin: '12px 0 4px' },
  createRow: { display: 'flex', gap: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 6,
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    boxSizing: 'border-box',
  },
  secondary: {
    padding: '6px 12px',
    background: '#fff',
    color: '#2f8d46',
    border: '1px solid #2f8d46',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: 6, color: '#444', fontSize: 12, marginTop: 6 },
  history: { marginTop: 14, borderTop: '1px solid #eee', paddingTop: 10 },
  historyHead: { margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#444' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    padding: '3px 0',
    fontSize: 12,
    borderBottom: '1px solid #f3f4f6',
  },
  itemTitle: { color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemMeta: { color: '#888', whiteSpace: 'nowrap' },
  status: {
    marginTop: 12,
    padding: 8,
    background: '#f3f4f6',
    borderRadius: 6,
    fontSize: 12,
    color: '#444',
    wordBreak: 'break-word',
  },
};
