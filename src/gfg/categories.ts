// Fixed DSA taxonomy + a deterministic primary-category picker.
// The PRD's "configurable taxonomy" (§15) is cut (ponytail): one fixed list,
// one synonym map. Re-add configurability only if a user actually needs it.
//
// Strategy (PRD §16 priority 1): GFG already exposes Topic Tags on the page, so
// the category is derived from the FIRST topic tag, normalized. No keyword
// inference, no AI. Deterministic — same tags always map to the same folder
// (PRD Test 9).

/** Canonical folder names. */
export const CATEGORIES = [
  'Arrays',
  'Strings',
  'Linked List',
  'Stack',
  'Queue',
  'Hashing',
  'Binary Search',
  'Sorting',
  'Two Pointers',
  'Sliding Window',
  'Recursion',
  'Backtracking',
  'Trees',
  'BST',
  'Heap',
  'Graphs',
  'Greedy',
  'Dynamic Programming',
  'Trie',
  'Bit Manipulation',
  'Math',
  'Matrix',
  'Searching',
  'Miscellaneous',
] as const;

export const DEFAULT_CATEGORY = 'Miscellaneous';

/** Lowercased GFG tag → canonical category. Only non-identity mappings need an
 *  entry; an exact (case-insensitive) match to a CATEGORIES name is handled
 *  automatically. */
const SYNONYMS: Record<string, string> = {
  array: 'Arrays',
  arrays: 'Arrays',
  string: 'Strings',
  strings: 'Strings',
  'linked-list': 'Linked List',
  'linked list': 'Linked List',
  hash: 'Hashing',
  map: 'Hashing',
  'binary-search': 'Binary Search',
  'binary search tree': 'BST',
  bst: 'BST',
  tree: 'Trees',
  'binary tree': 'Trees',
  graph: 'Graphs',
  dp: 'Dynamic Programming',
  'dynamic programming': 'Dynamic Programming',
  'priority queue': 'Heap',
  heap: 'Heap',
  'bit magic': 'Bit Manipulation',
  'bit manipulation': 'Bit Manipulation',
  mathematical: 'Math',
  math: 'Math',
  matrix: 'Matrix',
  'sliding-window': 'Sliding Window',
  'two-pointer': 'Two Pointers',
  'two pointers': 'Two Pointers',
  // Real GFG tag spellings observed on live problem pages — routed into the
  // fixed folders above so they don't fall to Miscellaneous. (primaryCategory
  // already walks past a leading unknown tag, so these only decide the folder
  // when they're the first KNOWN tag.)
  'two pointer algorithm': 'Two Pointers',
  'two-pointer-algorithm': 'Two Pointers',
  'prefix sum': 'Arrays',
  'prefix-sum': 'Arrays',
  'segment tree': 'Trees',
  'segment-tree': 'Trees',
  'pattern searching': 'Strings',
  'disjoint set': 'Graphs',
  'union find': 'Graphs',
  'doubly linked list': 'Linked List',
  'circular linked list': 'Linked List',
  hashmap: 'Hashing',
  'number theory': 'Math',
  combinatorial: 'Math',
  geometric: 'Math',
  geometry: 'Math',
};

const CANON = new Map<string, string>(CATEGORIES.map((c) => [c.toLowerCase(), c]));

function normalizeTag(tag: string): string | undefined {
  const key = tag.trim().toLowerCase();
  return CANON.get(key) ?? SYNONYMS[key];
}

/** Deterministically pick the primary category from GFG topic tags.
 *  Walks tags in page order and returns the first that maps to a known
 *  category; otherwise DEFAULT_CATEGORY. */
export function primaryCategory(topics: string[]): string {
  for (const tag of topics) {
    const cat = normalizeTag(tag);
    if (cat) return cat;
  }
  return DEFAULT_CATEGORY;
}
