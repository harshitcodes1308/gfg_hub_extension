// The ONE file expected to change when GFG ships a UI update (PRD §46).
// Every GFG DOM selector and verdict-text constant lives here — nowhere else.
//
// GFG is a Next.js app using CSS-module class names like
// `problems_header_content__title__<hash>`. The hash churns on every build, so
// we match with the `[class^="problems_..."]` PREFIX, which survives a hash
// change (though not a component rename). Grounded in three open-source
// GFG→GitHub extensions; see the implementation plan's research notes.

export const GFG_SELECTORS = {
  /** Container whose subtree text mutates when a verdict appears. */
  resultContainer: '[class^="problems_content"]',
  /** Problem title. */
  title: '[class^="problems_header_content__title"] > h3',
  /** Difficulty label (School/Basic/Easy/Medium/Hard). */
  difficulty: '[class^="problems_header_description"]',
  /** Topic-tag chips container(s). Gated at read time on the nearby heading. */
  tagContainer: '[class^="problems_tag_container"]',
  /** The Ace editor element id — read in the MAIN world via ace.edit(id). */
  aceEditorId: 'ace-editor',
} as const;

/** Text that means the submission passed. Matched case-insensitively as a
 *  substring of the result container's text. */
export const VERDICT_ACCEPTED = [
  'Problem Solved Successfully',
  'Correct Answer',
] as const;

/** Text that means the submission failed — stop, push nothing (PRD Test 2). */
export const VERDICT_FAILED = [
  'Compilation Error',
  'Wrong Answer',
  'Time Limit Exceeded',
  'Runtime Error',
] as const;

/** Heading text that precedes the topic-tag chips. */
export const TOPIC_TAGS_HEADING = 'Topic Tags';
