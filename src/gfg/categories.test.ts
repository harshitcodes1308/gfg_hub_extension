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

  it('is deterministic and defaults when nothing matches', () => {
    expect(primaryCategory([])).toBe(DEFAULT_CATEGORY);
    expect(primaryCategory(['totally-unknown'])).toBe(DEFAULT_CATEGORY);
  });
});
