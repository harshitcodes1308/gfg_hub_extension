// Pure extraction functions — no browser globals, no network. Everything here
// is unit-tested against saved HTML fixtures (PRD Rule 1). All GFG-specific
// selectors come from ./selectors so this file survives GFG UI churn.
import type { ProblemMeta } from './types';
import { GFG_SELECTORS, TOPIC_TAGS_HEADING } from './selectors';

const DIFFICULTIES = ['School', 'Basic', 'Easy', 'Medium', 'Hard'];

/** Stable dedupe key from a problem URL: the slug with GFG's trailing numeric
 *  id stripped. `/problems/two-sum-1587115621/1` → `two-sum`. */
export function slugFromUrl(url: string): string {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* not an absolute URL — treat the whole string as a path */
  }
  const m = path.match(/\/problems\/([^/]+)/i);
  const raw = m ? m[1] : (path.split('/').filter(Boolean).pop() ?? '');
  return raw.replace(/-\d{6,}$/, '').toLowerCase();
}

/** Problem URL without query/hash. */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function text(root: ParentNode, selector: string): string | undefined {
  return root.querySelector(selector)?.textContent?.trim() || undefined;
}

function extractDifficulty(root: ParentNode): string | undefined {
  const raw = text(root, GFG_SELECTORS.difficulty);
  if (!raw) return undefined;
  return DIFFICULTIES.find((d) => raw.toLowerCase().includes(d.toLowerCase()));
}

/** Topic tags in page order. Finds the tag container whose heading text is
 *  "Topic Tags" and reads the chip anchors inside it. Returns [] if absent —
 *  the sync must still work without tags (PRD §14). */
export function extractTopics(root: ParentNode): string[] {
  const containers = root.querySelectorAll(GFG_SELECTORS.tagContainer);
  for (const c of containers) {
    if (!c.textContent?.includes(TOPIC_TAGS_HEADING)) continue;
    return Array.from(c.querySelectorAll('a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter(Boolean);
  }
  return [];
}

/** Walk a parsed-JSON value (nested objects/arrays) depth-first and return the
 *  first value found under any of the candidate `keys`. GFG's __NEXT_DATA__
 *  shape is not a stable contract, so we SEARCH for the fields rather than index
 *  a fixed path that would silently break on the next build. */
function findFirst(obj: unknown, keys: string[]): unknown {
  if (obj === null || typeof obj !== 'object') return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findFirst(item, keys);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = obj as Record<string, unknown>;
  // Prefer a hit at the current level before descending into children.
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  for (const value of Object.values(record)) {
    const found = findFirst(value, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Coerce a recovered "tags" value into a string[]. Accepts an array of plain
 *  strings, or an array of objects carrying the tag under name/title/topic. */
function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t): string => {
      if (typeof t === 'string') return t.trim();
      if (t !== null && typeof t === 'object') {
        const o = t as Record<string, unknown>;
        const name = o.name ?? o.title ?? o.topic;
        return typeof name === 'string' ? name.trim() : '';
      }
      return '';
    })
    .filter(Boolean);
}

/** Pull the topic tags out of parsed __NEXT_DATA__.
 *
 *  GFG nests them as `tags.topic_tags` — a `tags` OBJECT that ALSO holds
 *  `company_tags` — while older/other shapes expose them flat as `topicTags`
 *  or `topic_tags`. So we search the specific topic-tag keys FIRST: findFirst
 *  descends depth-first and reaches the nested array wherever it lives. We must
 *  NOT search the bare `tags` key for the primary case, because it resolves to
 *  the wrapper object (its value is not an array) and normalizeTags would drop
 *  every tag — the bug that filed real GFG solves under "Miscellaneous".
 *  Only when no topic-tag key exists do we fall back to a top-level `tags`
 *  ARRAY (e.g. `[{name:'Greedy'}, …]`). */
function findTopics(data: unknown): string[] {
  const direct = findFirst(data, ['topicTags', 'topic_tags']);
  if (direct !== undefined) return normalizeTags(direct);
  return normalizeTags(findFirst(data, ['tags']));
}

/** Pull the problem title out of parsed __NEXT_DATA__.
 *
 *  Prefer the problem-specific keys ANYWHERE in the tree before the generic
 *  `title`/`name`. Those generic keys also match unrelated nodes — nav menus,
 *  course cards — that sit earlier in the depth-first walk, so searching them
 *  together titled every real solve "Courses". */
function findTitle(data: unknown): string {
  const raw = findFirst(data, ['problemName', 'problem_name']) ?? findFirst(data, ['title', 'name']);
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Recover problem metadata from the embedded `#__NEXT_DATA__` JSON, which is
 *  often more stable than the hashed CSS-module class names. Returns undefined
 *  when the script is absent, the JSON is unparseable, or no title is found —
 *  the DOM scrapers in extractMeta cover that case. */
export function metaFromNextData(root: ParentNode, url: string): ProblemMeta | undefined {
  const json = root.querySelector('#__NEXT_DATA__')?.textContent;
  if (!json) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return undefined;
  }
  const title = findTitle(data);
  if (!title) return undefined;
  const rawDifficulty = findFirst(data, ['difficulty']);
  const difficulty =
    typeof rawDifficulty === 'string' ? rawDifficulty.trim() || undefined : undefined;
  return {
    slug: slugFromUrl(url),
    url: canonicalUrl(url),
    title,
    difficulty,
    topics: findTopics(data),
  };
}

/** Best-effort problem metadata from a page root (Document or a subtree).
 *  Prefers the embedded __NEXT_DATA__ JSON when it yields a title, backfilling
 *  any field it lacks (difficulty, topics) from the DOM scrapers so we never
 *  regress; otherwise falls back to scraping the DOM directly. */
export function extractMeta(root: ParentNode, url: string): ProblemMeta {
  const fromNext = metaFromNextData(root, url);
  if (fromNext && fromNext.title) {
    return {
      ...fromNext,
      difficulty: fromNext.difficulty ?? extractDifficulty(root),
      topics: fromNext.topics.length ? fromNext.topics : extractTopics(root),
    };
  }
  return {
    slug: slugFromUrl(url),
    url: canonicalUrl(url),
    title: text(root, GFG_SELECTORS.title) ?? slugFromUrl(url),
    difficulty: extractDifficulty(root),
    topics: extractTopics(root),
  };
}

/** Result of the DOM selector health-check: which best-effort fields the current
 *  selectors yield nothing for, so callers can surface "couldn't read X" instead
 *  of failing silently. */
export interface SelectorHealth {
  ok: boolean;
  missing: string[];
}

/** Report which of 'title' | 'difficulty' | 'topics' the DOM selectors return
 *  nothing for. DOM-only by design — this exists to catch selector rot, so it
 *  deliberately ignores __NEXT_DATA__. */
export function checkSelectorHealth(root: ParentNode): SelectorHealth {
  const missing: string[] = [];
  if (!text(root, GFG_SELECTORS.title)) missing.push('title');
  if (!extractDifficulty(root)) missing.push('difficulty');
  if (extractTopics(root).length === 0) missing.push('topics');
  return { ok: missing.length === 0, missing };
}
