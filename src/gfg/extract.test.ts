import { describe, it, expect } from 'vitest';
import {
  slugFromUrl,
  canonicalUrl,
  extractMeta,
  extractTopics,
  metaFromNextData,
  checkSelectorHealth,
} from './extract';

// Representative GFG problem-page structure (hashed CSS-module class names,
// a Company Tags block before the Topic Tags block to prove gating).
const FIXTURE = `
  <div class="problems_header_content__title__ABC"><h3>Two Sum</h3></div>
  <div class="problems_header_description__XYZ">Difficulty: Medium</div>
  <div class="problems_tag_container__k1">
    <div class="heading">Company Tags</div>
    <a href="#">Amazon</a><a href="#">Google</a>
  </div>
  <div class="problems_tag_container__k2">
    <div class="heading">Topic Tags</div>
    <a href="#">Arrays</a><a href="#">Hashing</a>
  </div>
`;

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('slugFromUrl', () => {
  it('strips the trailing numeric id', () => {
    expect(slugFromUrl('https://www.geeksforgeeks.org/problems/two-sum-1587115621/1')).toBe('two-sum');
  });
  it('keeps a slug that has no numeric id', () => {
    expect(slugFromUrl('https://www.geeksforgeeks.org/problems/subarray-with-given-sum/1')).toBe(
      'subarray-with-given-sum',
    );
  });
  it('handles the legacy practice. host', () => {
    expect(slugFromUrl('https://practice.geeksforgeeks.org/problems/reverse-a-string/1')).toBe(
      'reverse-a-string',
    );
  });
});

describe('canonicalUrl', () => {
  it('drops query and hash', () => {
    expect(canonicalUrl('https://www.geeksforgeeks.org/problems/two-sum/1?a=1#x')).toBe(
      'https://www.geeksforgeeks.org/problems/two-sum/1',
    );
  });
});

describe('extractMeta', () => {
  const url = 'https://www.geeksforgeeks.org/problems/two-sum-1587115621/1';

  it('pulls title, difficulty and topic tags (not company tags)', () => {
    const meta = extractMeta(root(FIXTURE), url);
    expect(meta.title).toBe('Two Sum');
    expect(meta.difficulty).toBe('Medium');
    expect(meta.topics).toEqual(['Arrays', 'Hashing']);
    expect(meta.slug).toBe('two-sum');
  });

  it('falls back to the slug when the title is missing, and still works with no tags', () => {
    const meta = extractMeta(root('<div></div>'), url);
    expect(meta.title).toBe('two-sum');
    expect(meta.difficulty).toBeUndefined();
    expect(meta.topics).toEqual([]);
  });
});

describe('extractTopics', () => {
  it('returns [] when there is no Topic Tags block', () => {
    expect(extractTopics(root('<div class="problems_tag_container__z">Company Tags</div>'))).toEqual([]);
  });
});

// A minimal __NEXT_DATA__ script, as GFG's Next.js runtime embeds it. Built with
// the same root() helper the fixture tests use — a <script> set via innerHTML
// keeps its text content in jsdom without executing.
function nextData(obj: unknown): string {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(obj)}</script>`;
}

describe('metaFromNextData', () => {
  const url = 'https://www.geeksforgeeks.org/problems/two-sum-1587115621/1';

  it('returns undefined when there is no __NEXT_DATA__ script', () => {
    expect(metaFromNextData(root(FIXTURE), url)).toBeUndefined();
  });

  it('returns undefined when the JSON is unparseable', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{ not json </script>';
    expect(metaFromNextData(root(html), url)).toBeUndefined();
  });

  it('recovers title/difficulty/topics from a deeply nested shape', () => {
    const data = {
      props: {
        pageProps: {
          problemInfo: {
            problemName: 'Nested Two Sum',
            difficulty: 'Hard',
            topicTags: ['Arrays', 'Dynamic Programming'],
          },
        },
      },
    };
    const meta = metaFromNextData(root(nextData(data)), url);
    expect(meta?.title).toBe('Nested Two Sum');
    expect(meta?.difficulty).toBe('Hard');
    expect(meta?.topics).toEqual(['Arrays', 'Dynamic Programming']);
    expect(meta?.slug).toBe('two-sum');
    expect(meta?.url).toBe('https://www.geeksforgeeks.org/problems/two-sum-1587115621/1');
  });

  it('maps tags-as-objects via name/title/topic', () => {
    const data = {
      a: {
        b: {
          title: 'Object Tags Problem',
          difficulty: 'Easy',
          tags: [{ name: 'Greedy' }, { title: 'Sorting' }, { topic: 'Math' }],
        },
      },
    };
    const meta = metaFromNextData(root(nextData(data)), url);
    expect(meta?.title).toBe('Object Tags Problem');
    expect(meta?.difficulty).toBe('Easy');
    expect(meta?.topics).toEqual(['Greedy', 'Sorting', 'Math']);
  });

  it('reads topic tags from GFG\'s nested tags.topic_tags (ignoring company_tags)', () => {
    // The real GFG __NEXT_DATA__ shape: a `tags` OBJECT, not a flat array.
    const data = {
      props: {
        pageProps: {
          problemInfo: {
            problemName: 'Subarray with Given Sum',
            difficulty: 'Medium',
            tags: {
              company_tags: ['Amazon', 'Google', 'Visa'],
              topic_tags: ['Arrays', 'Prefix Sum', 'Searching', 'sliding-window'],
            },
          },
        },
      },
    };
    const meta = metaFromNextData(root(nextData(data)), url);
    expect(meta?.topics).toEqual(['Arrays', 'Prefix Sum', 'Searching', 'sliding-window']);
  });

  it('prefers problem_name over a generic title/name from unrelated nodes', () => {
    // A nav/header node carries title:"Courses" and sits BEFORE the problem in
    // depth-first order — the collision that titled every real solve "Courses".
    const data = {
      props: {
        pageProps: {
          header: { title: 'Courses', name: 'GeeksforGeeks' },
          problemInfo: { problem_name: 'Indexes of Subarray Sum', difficulty: 'Medium' },
        },
      },
    };
    const meta = metaFromNextData(root(nextData(data)), url);
    expect(meta?.title).toBe('Indexes of Subarray Sum');
  });

  it('returns undefined when no title key is present', () => {
    const meta = metaFromNextData(root(nextData({ props: { difficulty: 'Medium' } })), url);
    expect(meta).toBeUndefined();
  });
});

describe('extractMeta with __NEXT_DATA__', () => {
  const url = 'https://www.geeksforgeeks.org/problems/two-sum-1587115621/1';

  it('uses DOM-scraped values when there is no __NEXT_DATA__', () => {
    const meta = extractMeta(root(FIXTURE), url);
    expect(meta.title).toBe('Two Sum');
    expect(meta.difficulty).toBe('Medium');
    expect(meta.topics).toEqual(['Arrays', 'Hashing']);
  });

  it('prefers the __NEXT_DATA__ title but fills difficulty from the DOM', () => {
    const data = { props: { pageProps: { problemName: 'JSON Title', topicTags: ['Trees'] } } };
    const html = `
      ${nextData(data)}
      <div class="problems_header_content__title__ABC"><h3>DOM Title</h3></div>
      <div class="problems_header_description__XYZ">Difficulty: Medium</div>
    `;
    const meta = extractMeta(root(html), url);
    expect(meta.title).toBe('JSON Title');
    expect(meta.difficulty).toBe('Medium');
    expect(meta.topics).toEqual(['Trees']);
  });
});

describe('checkSelectorHealth', () => {
  it('reports ok with no missing fields for a complete fixture', () => {
    expect(checkSelectorHealth(root(FIXTURE))).toEqual({ ok: true, missing: [] });
  });

  it('flags topics when the Topic Tags container is absent', () => {
    const html = `
      <div class="problems_header_content__title__ABC"><h3>Two Sum</h3></div>
      <div class="problems_header_description__XYZ">Difficulty: Medium</div>
    `;
    const health = checkSelectorHealth(root(html));
    expect(health.ok).toBe(false);
    expect(health.missing).toContain('topics');
    expect(health.missing).not.toContain('title');
    expect(health.missing).not.toContain('difficulty');
  });
});
