// Language → file-extension resolution. One tiny module instead of the PRD's
// per-language files (§13, ponytail: cut).
//
// Two inputs, in priority order (per research):
//   1. Ace editor mode id  — reliable: ace.edit(id).session.getMode().$id
//   2. GFG's display name  — fallback only
// The old DOM-class method broke silently in 2026, so it is not used.

/** Normalized language key → file extension (with dot). */
const EXT: Record<string, string> = {
  cpp: '.cpp',
  c: '.c',
  java: '.java',
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  csharp: '.cs',
};

/** Last segment of an Ace mode id → language key. Note: Ace uses `c_cpp` for
 *  both C and C++, so plain C is stored as `.cpp` (matches reference tools). */
const ACE_MODE: Record<string, string> = {
  c_cpp: 'cpp',
  java: 'java',
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  csharp: 'csharp',
};

/** GFG display name (lowercased) → language key. */
const DISPLAY: Record<string, string> = {
  c: 'c',
  'c++': 'cpp',
  cpp: 'cpp',
  java: 'java',
  python: 'python',
  python3: 'python',
  javascript: 'javascript',
  js: 'javascript',
  'c#': 'csharp',
  csharp: 'csharp',
};

export interface ResolvedLanguage {
  language: string;
  extension: string;
}

const FALLBACK: ResolvedLanguage = { language: 'text', extension: '.txt' };

/** Resolve a language + extension from an Ace mode id and/or display name.
 *  Always returns something (falls back to plain text) so a sync never blocks
 *  on an unknown language. */
export function resolveLanguage(aceModeId?: string, displayName?: string): ResolvedLanguage {
  const mode = aceModeId?.split('/').pop();
  if (mode && ACE_MODE[mode]) {
    const language = ACE_MODE[mode];
    return { language, extension: EXT[language] ?? FALLBACK.extension };
  }
  const key = displayName && DISPLAY[displayName.trim().toLowerCase()];
  if (key) return { language: key, extension: EXT[key] ?? FALLBACK.extension };
  return { ...FALLBACK };
}
