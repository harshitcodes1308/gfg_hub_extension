import { describe, it, expect } from 'vitest';
import { classifyVerdict, waitForVerdict } from './detect';

describe('classifyVerdict', () => {
  it('detects acceptance', () => {
    expect(classifyVerdict('… Problem Solved Successfully …')).toBe('accepted');
    expect(classifyVerdict('Correct Answer')).toBe('accepted');
  });
  it('detects failure', () => {
    expect(classifyVerdict('Compilation Error')).toBe('failed');
    expect(classifyVerdict('Wrong Answer on test 3')).toBe('failed');
  });
  it('returns null before a verdict appears', () => {
    expect(classifyVerdict('Running your code…')).toBeNull();
    expect(classifyVerdict('')).toBeNull();
  });
});

describe('waitForVerdict', () => {
  it('resolves immediately when a verdict is already on screen', async () => {
    document.body.innerHTML = `<div class="problems_content__x">Correct Answer</div>`;
    await expect(waitForVerdict({ timeoutMs: 1000 })).resolves.toBe('accepted');
  });

  it('resolves when the verdict text appears later', async () => {
    document.body.innerHTML = `<div class="problems_content__x"></div>`;
    const p = waitForVerdict({ timeoutMs: 2000 });
    document.querySelector('.problems_content__x')!.textContent = 'Problem Solved Successfully';
    await expect(p).resolves.toBe('accepted');
  });

  it('rejects with a timeout when no verdict arrives', async () => {
    document.body.innerHTML = `<div class="problems_content__x">Running…</div>`;
    await expect(waitForVerdict({ timeoutMs: 20 })).rejects.toThrow('verdict-timeout');
  });
});
