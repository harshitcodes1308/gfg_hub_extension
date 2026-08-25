// The ONLY reliable way to read the full submitted source: run in the page's
// MAIN world and ask the Ace editor directly. Content scripts live in an
// isolated world and can't see `window.ace`; scraping `.ace_line` /
// `textarea.ace_text-input` returns truncated code because Ace virtualizes
// rendering.
//
// This function is injected via chrome.scripting.executeScript({world:'MAIN'}),
// so it must be SELF-CONTAINED: no imports, no closure over module scope. The
// editor id is passed in as an argument.

interface AceEditor {
  getValue(): string;
  session?: { getMode?(): { $id?: string } };
}

/** Runs in the page (MAIN world). Returns the full code + Ace mode id, or null
 *  if the editor isn't present. */
export function readAceCode(editorId: string): { code: string; aceModeId?: string } | null {
  const ace = (window as unknown as { ace?: { edit(id: string): AceEditor } }).ace;
  if (!ace) return null;
  try {
    const editor = ace.edit(editorId);
    return { code: editor.getValue(), aceModeId: editor.session?.getMode?.()?.$id };
  } catch {
    return null;
  }
}
