// The content-script ↔ service-worker ↔ popup message contract. One typed
// union so the boundary can't drift. Request/response over chrome.runtime.
import type { ProblemMeta } from './gfg/types';
import type { RepoTarget, SyncRecord } from './storage';

// --- content → SW ---------------------------------------------------------
export interface SubmissionAcceptedMsg {
  type: 'SUBMISSION_ACCEPTED';
  meta: ProblemMeta;
  /** DOM fields the selectors read nothing for (selector-rot canary, §46).
   *  Surfaced by the SW so a silent selector break is visible, not invisible. */
  missing?: string[];
}

// --- popup → SW (request/response) ----------------------------------------
export interface GetStateMsg {
  type: 'GET_STATE';
}
export interface ConnectMsg {
  type: 'CONNECT_GITHUB';
}
export interface ListReposMsg {
  type: 'LIST_REPOS';
}
export interface SetRepoMsg {
  type: 'SET_REPO';
  repo: RepoTarget;
}
/** Create a new repo the user owns, then use it as the target (§7). */
export interface CreateRepoMsg {
  type: 'CREATE_REPO';
  name: string;
  private: boolean;
}

export type Message =
  | SubmissionAcceptedMsg
  | GetStateMsg
  | ConnectMsg
  | ListReposMsg
  | SetRepoMsg
  | CreateRepoMsg;

// --- responses ------------------------------------------------------------
export interface AppState {
  connected: boolean;
  user?: { login: string };
  repo?: RepoTarget;
  lastStatus?: string;
  /** Set while a device-flow login is in progress (not yet connected). Lets the
   *  popup re-show the code after it auto-closed when the GitHub tab opened. */
  pendingAuth?: { userCode: string; verificationUri: string };
  /** Recently synced problems, most-recent first, for the popup history list. */
  recentSyncs?: SyncRecord[];
}

/** Device-flow handshake: the popup shows the code and opens the verify page. */
export interface ConnectResponse {
  userCode: string;
  verificationUri: string;
}

export interface RepoOption {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
}

export interface ReposResponse {
  repos: RepoOption[];
}
