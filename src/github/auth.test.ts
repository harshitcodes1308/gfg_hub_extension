import { describe, it, expect } from 'vitest';
import { classifyTokenResponse } from './auth';

// The device-flow poll's decision table. GitHub answers a still-pending poll
// with HTTP 200 + an `error` field (not an HTTP error), so "not a token yet"
// must read as pending/slow_down — never as failure — or the popup gives up
// mid-login. Only access_denied / expired_token / the unexpected are terminal.
describe('classifyTokenResponse', () => {
  it('treats an access_token as authorized', () => {
    expect(classifyTokenResponse({ access_token: 'gho_abc' })).toEqual({
      status: 'authorized',
      token: 'gho_abc',
    });
  });

  it('treats authorization_pending as pending (keep polling)', () => {
    expect(classifyTokenResponse({ error: 'authorization_pending' })).toEqual({ status: 'pending' });
  });

  it('treats slow_down as slow_down, carrying the new interval', () => {
    expect(classifyTokenResponse({ error: 'slow_down', interval: '10' })).toEqual({
      status: 'slow_down',
      interval: 10,
    });
  });

  it('treats access_denied as a terminal error', () => {
    const r = classifyTokenResponse({ error: 'access_denied', error_description: 'user denied' });
    expect(r.status).toBe('error');
  });

  it('treats expired_token as a terminal error', () => {
    expect(classifyTokenResponse({ error: 'expired_token' }).status).toBe('error');
  });

  it('treats an unrecognized response as a terminal error', () => {
    expect(classifyTokenResponse({}).status).toBe('error');
  });
});
