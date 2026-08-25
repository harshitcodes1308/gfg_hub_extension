// Shared contracts for the GFG extraction layer. Kept tiny and concrete —
// one platform (GFG), so no generic adapter interface (ponytail: cut).

/** Problem metadata scraped from a GFG /problems/ page. Fields are best-effort:
 *  the sync must still work when optional fields are missing (PRD §14). */
export interface ProblemMeta {
  /** Normalized, stable slug from the URL (dedupe key). e.g. "two-sum". */
  slug: string;
  /** Canonical problem URL. */
  url: string;
  title: string;
  difficulty?: string;
  /** GFG "Topic Tags", in page order. First one drives the category. */
  topics: string[];
}

/** A fully-extracted accepted submission, ready to sync. */
export interface Submission {
  meta: ProblemMeta;
  code: string;
  /** Normalized language key, e.g. "cpp" | "python" | "java" | "javascript". */
  language: string;
  /** File extension including the dot, e.g. ".cpp". */
  extension: string;
}

/** Result of watching the submission UI. */
export type Verdict = 'accepted' | 'failed';

/** Human-readable status strings shown in the popup. This is all that
 *  survives from the PRD's proposed state machine (ponytail: cut the engine,
 *  keep the labels). */
export type SyncStatus =
  | 'idle'
  | 'detecting'
  | 'extracting'
  | 'syncing'
  | 'synced'
  | 'duplicate'
  | 'failed';
