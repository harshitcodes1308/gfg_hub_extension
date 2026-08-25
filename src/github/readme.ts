// Pure markdown builders for the two READMEs GFGHub maintains: a tiny
// per-problem README.md (written next to each synced solution) and the
// auto-generated index in the repo's main README, kept inside an HTML-comment
// "managed section" so a user's own prose around it is never clobbered.
//
// Deterministic and side-effect free by design (PRD Test 9): no chrome, no
// network, no DOM — just strings in, strings out. That keeps them trivially
// testable and safe to call from the service worker. Ponytail: no markdown
// library, no template engine, no builder class — the strings are inlined.
import type { ProblemMeta } from '../gfg/types';
import type { SyncRecord } from '../storage';

/** Sentinel that opens GFGHub's managed block in the main README. */
export const GFGHUB_START = '<!-- GFGHUB:START -->';
/** Sentinel that closes GFGHub's managed block in the main README. */
export const GFGHUB_END = '<!-- GFGHUB:END -->';

/** Build the per-problem README.md.
 *
 *  Only fields we actually scrape from the page (PRD §14) — the title/URL, and
 *  the optional difficulty + topic tags. No invented data (company tags,
 *  acceptance rate, "related problems"): we don't have it. Optional lines are
 *  omitted entirely when their source is missing, so the output stays clean. */
export function problemReadme(meta: ProblemMeta): string {
  const lines: string[] = [`# [${meta.title}](${meta.url})`];
  if (meta.difficulty !== undefined) {
    lines.push(`**Difficulty:** ${meta.difficulty}`);
  }
  if (meta.topics.length > 0) {
    lines.push(`**Topics:** ${meta.topics.join(', ')}`);
  }
  lines.push('_Synced from GeeksforGeeks by GFGHub._');
  // Blank line between blocks so each renders as its own paragraph.
  return lines.join('\n\n') + '\n';
}

/** Render the INNER body of the managed section (markers NOT included).
 *
 *  A count line plus a table of every synced problem, most-recent first. Link
 *  destinations for solutions use angle brackets because category folders often
 *  contain spaces (e.g. "Dynamic Programming/…"), which would otherwise break
 *  the markdown link. Missing display fields fall back to an em dash. */
export function renderIndex(records: SyncRecord[]): string {
  if (records.length === 0) return '_No solutions synced yet._';
  // Copy before sorting: this function must not mutate its input.
  const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
  const count = `**${records.length} solutions synced.**`;
  const header = '| Problem | Difficulty | Category | Solution |';
  const divider = '| --- | --- | --- | --- |';
  const rows = sorted.map(
    (r) =>
      `| [${r.title ?? r.slug}](${r.url}) | ${r.difficulty ?? '—'} | ${r.category ?? '—'} | [Solution](<${r.githubPath}>) |`,
  );
  return [count, '', header, divider, ...rows].join('\n');
}

/** Return the full new main-README content with the managed section upserted.
 *
 *  - No existing content → a fresh README with an H1 and the section.
 *  - Both markers present → replace everything between them (inclusive) with the
 *    freshly rendered section, preserving all prose before START / after END.
 *  - Non-empty but no markers → append the section, keeping existing content.
 *
 *  Idempotent: feeding the output back in with the same records is a no-op, so
 *  the sync can rewrite the README on every commit without churn. */
export function upsertManagedSection(existing: string | undefined, records: SyncRecord[]): string {
  const section = `${GFGHUB_START}\n${renderIndex(records)}\n${GFGHUB_END}`;
  if (!existing) {
    return `# GeeksforGeeks Solutions\n\n${section}\n`;
  }
  const start = existing.indexOf(GFGHUB_START);
  const end = existing.indexOf(GFGHUB_END);
  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + GFGHUB_END.length);
    return `${before}${section}${after}`;
  }
  // Non-empty with no (usable) markers: append, keeping the user's content.
  return `${existing}\n\n${section}\n`;
}
