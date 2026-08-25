// Thin fetch wrapper over api.github.com — only the calls the skeleton needs.
// No Octokit (native: fetch + a few endpoints is the whole surface). The token
// is held in a closure and set only in the Authorization header — never logged.
const GITHUB_API_VERSION = '2022-11-28';

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/** GitHub API status → user-facing message (PRD §58). */
export function messageForStatus(status: number): string {
  if (status === 401) return 'GitHub sign-in expired — please reconnect.';
  if (status === 403) return 'GitHub denied the request (permission or rate limit).';
  if (status === 404) return 'Repository or file not found.';
  if (status === 409) return 'GitHub reported a conflict — will retry.';
  if (status === 422) return 'GitHub rejected the request as invalid.';
  if (status === 429) return 'GitHub rate limit reached — queued to retry.';
  if (status >= 500) return 'GitHub is having problems — will retry.';
  return `GitHub request failed (${status}).`;
}

/** Percent-encode each path segment but keep the slashes (for contents API). */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}

/** UTF-8-safe base64 decode (GitHub's contents API returns base64). Strips the
 *  whitespace GitHub inserts into that base64. */
export function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface RepoInfo {
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
}

/** One file in a multi-file commit (see commitFiles). Content is raw UTF-8. */
export interface CommitFile {
  path: string;
  content: string;
}

export class GitHubClient {
  constructor(private readonly token: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        ...(init.headers ?? {}),
      },
    });
  }

  private async json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new GitHubError(res.status, messageForStatus(res.status));
    return res.json() as Promise<T>;
  }

  /** Whoami — confirms the token and gives the @login for the popup. */
  getUser(): Promise<{ login: string }> {
    return this.request('/user').then((r) => this.json(r));
  }

  /** Repos the user owns, most-recently-updated first, for the picker. */
  listRepos(): Promise<RepoInfo[]> {
    return this.request('/user/repos?per_page=100&sort=updated&affiliation=owner').then((r) =>
      this.json<RepoInfo[]>(r),
    );
  }

  /** Create a repo the user owns. `auto_init` gives it an initial commit + branch
   *  so commitFiles has a ref to build on (FURTHER_STEPS §3). */
  createRepo(name: string, opts: { private: boolean; description?: string }): Promise<RepoInfo> {
    return this.request('/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        private: opts.private,
        description: opts.description,
        auto_init: true,
      }),
    }).then((r) => this.json<RepoInfo>(r));
  }

  /** Decoded text of a file on `branch`, or undefined if it doesn't exist. Used
   *  to read the current main README before rewriting its managed section (§22). */
  async getTextFile(
    owner: string,
    repo: string,
    path: string,
    branch: string,
  ): Promise<string | undefined> {
    const res = await this.request(
      `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
    );
    if (res.status === 404) return undefined;
    const data = await this.json<{ content?: string } | unknown[]>(res);
    if (Array.isArray(data) || !data.content) return undefined;
    return fromBase64(data.content);
  }

  /**
   * Commit several files in ONE commit via the Git Data API (§20: one logical
   * push per solve). Overwrites any existing paths (create-or-update), so no sha
   * bookkeeping is needed. Five calls: read ref → base commit → new tree →
   * new commit → move ref.
   */
  async commitFiles(
    owner: string,
    repo: string,
    opts: { branch: string; message: string; files: CommitFile[] },
  ): Promise<{ commitSha: string }> {
    const base = `/repos/${owner}/${repo}/git`;
    const branch = encodeURIComponent(opts.branch);

    const ref = await this.request(`${base}/ref/heads/${branch}`).then((r) =>
      this.json<{ object: { sha: string } }>(r),
    );
    const baseCommitSha = ref.object.sha;
    const baseCommit = await this.request(`${base}/commits/${baseCommitSha}`).then((r) =>
      this.json<{ tree: { sha: string } }>(r),
    );

    const tree = await this.request(`${base}/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: opts.files.map((f) => ({
          path: f.path,
          mode: '100644',
          type: 'blob',
          content: f.content,
        })),
      }),
    }).then((r) => this.json<{ sha: string }>(r));

    const commit = await this.request(`${base}/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: opts.message, tree: tree.sha, parents: [baseCommitSha] }),
    }).then((r) => this.json<{ sha: string }>(r));

    await this.request(`${base}/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commit.sha }),
    }).then((r) => this.json(r));

    return { commitSha: commit.sha };
  }
}
