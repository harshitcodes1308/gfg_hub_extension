import { describe, it, expect } from 'vitest';
import { resolveLanguage } from './languages';

describe('resolveLanguage', () => {
  it('prefers the Ace mode id', () => {
    expect(resolveLanguage('ace/mode/c_cpp')).toEqual({ language: 'cpp', extension: '.cpp' });
    expect(resolveLanguage('ace/mode/python')).toEqual({ language: 'python', extension: '.py' });
    expect(resolveLanguage('ace/mode/java')).toEqual({ language: 'java', extension: '.java' });
  });

  it('falls back to the display name when the mode is unknown/missing', () => {
    expect(resolveLanguage(undefined, 'C++')).toEqual({ language: 'cpp', extension: '.cpp' });
    expect(resolveLanguage(undefined, 'Python3')).toEqual({ language: 'python', extension: '.py' });
    expect(resolveLanguage('ace/mode/unknown', 'JavaScript')).toEqual({
      language: 'javascript',
      extension: '.js',
    });
  });

  it('falls back to plain text so a sync is never blocked', () => {
    expect(resolveLanguage()).toEqual({ language: 'text', extension: '.txt' });
    expect(resolveLanguage(undefined, 'Brainfuck')).toEqual({ language: 'text', extension: '.txt' });
  });
});
