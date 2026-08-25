// Tests for the README markdown builders. Pure string assertions — no chrome,
// no network, no DOM. describe/it/expect are vitest globals (tsconfig
// "types": ["chrome", "vitest/globals"]), so they are intentionally NOT imported.
import type { ProblemMeta } from '../gfg/types';
import type { SyncRecord } from '../storage';
import {
  GFGHUB_START,
  GFGHUB_END,
  problemReadme,
  renderIndex,
  upsertManagedSection,
} from './readme';

const URL = 'https://www.geeksforgeeks.org/problems/two-sum';

function meta(over: Partial<ProblemMeta> = {}): ProblemMeta {
  return {
    slug: 'two-sum',
    url: URL,
    title: 'Two Sum',
    difficulty: 'Easy',
    topics: ['Arrays', 'Hashing'],
    ...over,
  };
}

function rec(over: Partial<SyncRecord> = {}): SyncRecord {
  return {
    slug: 'two-sum',
    url: URL,
    githubPath: 'Arrays/two-sum/solution.cpp',
    timestamp: 1000,
    title: 'Two Sum',
    difficulty: 'Easy',
    category: 'Arrays',
    ...over,
  };
}

describe('problemReadme', () => {
  it('includes the title, url, difficulty, and each topic', () => {
    const out = problemReadme(meta());
    expect(out).toContain(`# [Two Sum](${URL})`);
    expect(out).toContain(URL);
    expect(out).toContain('Easy');
    expect(out).toContain('Arrays');
    expect(out).toContain('Hashing');
  });

  it('omits the difficulty line when difficulty is undefined', () => {
    const out = problemReadme(meta({ difficulty: undefined }));
    expect(out).not.toContain('Difficulty');
    // The rest of the README still renders.
    expect(out).toContain('# [Two Sum]');
  });

  it('omits the topics line when topics is empty', () => {
    const out = problemReadme(meta({ topics: [] }));
    expect(out).not.toContain('Topics');
  });
});

describe('renderIndex', () => {
  it('renders the empty-state text when there are no records', () => {
    expect(renderIndex([])).toBe('_No solutions synced yet._');
  });

  it('lists each record with its display text and a link to its url', () => {
    const out = renderIndex([rec()]);
    expect(out).toContain(`[Two Sum](${URL})`);
    expect(out).toContain('solutions synced');
    expect(out).toContain('[Solution](<Arrays/two-sum/solution.cpp>)');
  });

  it('falls back to the slug when a record has no title', () => {
    const out = renderIndex([rec({ title: undefined, slug: 'my-slug' })]);
    expect(out).toContain('[my-slug]');
  });

  it('falls back to an em dash for missing difficulty/category', () => {
    const out = renderIndex([rec({ difficulty: undefined, category: undefined })]);
    expect(out).toContain('—');
  });

  it('sorts most-recent first (timestamp desc)', () => {
    const older = rec({ slug: 'older', title: 'Older', url: 'https://x/older', timestamp: 1 });
    const newer = rec({ slug: 'newer', title: 'Newer', url: 'https://x/newer', timestamp: 2 });
    const out = renderIndex([older, newer]);
    expect(out.indexOf('Newer')).toBeLessThan(out.indexOf('Older'));
  });
});

describe('upsertManagedSection', () => {
  it('creates a new README with an H1 and both markers when existing is undefined', () => {
    const out = upsertManagedSection(undefined, [rec()]);
    expect(out).toContain('# GeeksforGeeks Solutions');
    expect(out).toContain(GFGHUB_START);
    expect(out).toContain(GFGHUB_END);
    expect(out).toContain('[Two Sum]');
  });

  it('replaces between markers while preserving prose on both sides', () => {
    const existing = [
      '# My Cool Repo',
      'Intro paragraph before.',
      '',
      GFGHUB_START,
      '_stale inner content_',
      GFGHUB_END,
      '',
      'Closing paragraph after.',
      '',
    ].join('\n');
    const out = upsertManagedSection(existing, [rec()]);
    expect(out).toContain('Intro paragraph before.');
    expect(out).toContain('Closing paragraph after.');
    expect(out).not.toContain('_stale inner content_');
    expect(out).toContain('[Two Sum]');
    // The markers are replaced in place, not duplicated.
    expect(out.split(GFGHUB_START)).toHaveLength(2);
    expect(out.split(GFGHUB_END)).toHaveLength(2);
  });

  it('appends the section when existing has no markers, keeping its content', () => {
    const existing = '# Existing\n\nSome custom content.\n';
    const out = upsertManagedSection(existing, [rec()]);
    expect(out).toContain('Some custom content.');
    expect(out).toContain(GFGHUB_START);
    expect(out).toContain(GFGHUB_END);
    // Existing content stays above the appended section.
    expect(out.indexOf('Some custom content.')).toBeLessThan(out.indexOf(GFGHUB_START));
  });

  it('is idempotent when created then re-rendered', () => {
    const once = upsertManagedSection(undefined, [rec()]);
    const twice = upsertManagedSection(once, [rec()]);
    expect(twice).toEqual(once);
  });

  it('is idempotent across the append-then-replace transition', () => {
    const base = '# Existing\n\nSome custom content.\n';
    const a = upsertManagedSection(base, [rec()]);
    const b = upsertManagedSection(a, [rec()]);
    expect(b).toEqual(a);
  });
});
