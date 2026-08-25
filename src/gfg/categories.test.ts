import { describe, it, expect } from 'vitest';
import { primaryCategory, DEFAULT_CATEGORY } from './categories';

describe('primaryCategory', () => {
  it('uses the first topic tag, in page order', () => {
    expect(primaryCategory(['Arrays', 'Hashing'])).toBe('Arrays');
    expect(primaryCategory(['Hashing', 'Arrays'])).toBe('Hashing');
  });

  it('maps synonyms/aliases to canonical folders', () => {
    expect(primaryCategory(['dp'])).toBe('Dynamic Programming');
    expect(primaryCategory(['graph'])).toBe('Graphs');
    expect(primaryCategory(['Binary Search Tree'])).toBe('BST');
  });

  it('skips unknown tags until it finds a known one', () => {
    expect(primaryCategory(['SomethingWeird', 'graph'])).toBe('Graphs');
  });

  it('maps real GFG tag spellings to canonical folders', () => {
    expect(primaryCategory(['sliding-window'])).toBe('Sliding Window');
    expect(primaryCategory(['Two Pointer Algorithm'])).toBe('Two Pointers');
    expect(primaryCategory(['Prefix Sum'])).toBe('Arrays');
    expect(primaryCategory(['Number Theory'])).toBe('Math');
    expect(primaryCategory(['Pattern Searching'])).toBe('Strings');
  });

  it('categorizes a real GFG tag list by its first known tag, not Miscellaneous', () => {
    // subarray-with-given-sum: exactly what GFG emits for this problem.
    expect(primaryCategory(['Arrays', 'Prefix Sum', 'Searching', 'sliding-window'])).toBe('Arrays');
  });

  it('is deterministic and defaults when nothing matches', () => {
    expect(primaryCategory([])).toBe(DEFAULT_CATEGORY);
    expect(primaryCategory(['totally-unknown'])).toBe(DEFAULT_CATEGORY);
  });
});
