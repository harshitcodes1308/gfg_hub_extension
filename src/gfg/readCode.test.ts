import { describe, it, expect, beforeEach } from 'vitest';
import { readAceCode } from './readCode';

// Simulate the page's MAIN world by planting a fake `window.ace`, proving
// readAceCode returns the FULL buffer (not just visible lines) and the mode id.
describe('readAceCode', () => {
  beforeEach(() => {
    delete (window as unknown as { ace?: unknown }).ace;
  });

  it('returns the full code and Ace mode id', () => {
    const full = 'line1\nline2\n… 500 more lines …\nlineN';
    (window as unknown as { ace: unknown }).ace = {
      edit: (id: string) => {
        expect(id).toBe('ace-editor');
        return { getValue: () => full, session: { getMode: () => ({ $id: 'ace/mode/c_cpp' }) } };
      },
    };
    expect(readAceCode('ace-editor')).toEqual({ code: full, aceModeId: 'ace/mode/c_cpp' });
  });

  it('returns null when Ace is absent (isolated world / not an editor page)', () => {
    expect(readAceCode('ace-editor')).toBeNull();
  });

  it('returns null instead of throwing when ace.edit blows up', () => {
    (window as unknown as { ace: unknown }).ace = {
      edit: () => {
        throw new Error('no such editor');
      },
    };
    expect(readAceCode('ace-editor')).toBeNull();
  });
});
