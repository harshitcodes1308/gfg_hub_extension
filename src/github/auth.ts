// GitHub OAuth Device Flow — the only secret-less, backend-free path (see plan).
// Two steps the service worker coordinates: request a device code (popup shows
// it + opens the verify page), then poll until GitHub hands back an access
// token. No client_secret, no redirect URL, no server.
import { GITHUB_CLIENT_ID, GITHUB_SCOPE, clientIdConfigured } from '../config';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

export interface DeviceCode {
  /** Short code the user types on GitHub, e.g. "WDJB-MJHT". */
  userCode: string;
  /** Where the user enters it — https://github.com/login/device. */
  verificationUri: string;
  /** Opaque code we poll the token endpoint with. Not shown to the user. */
  deviceCode: string;
  /** Seconds between polls GitHub will tolerate. */
  interval: number;
  /** Seconds until the device code expires. */
  expiresIn: number;
}

async function form(url: string, body: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`github-device-flow-http-${res.status}`);
  return res.json();
}

/** Step 1: ask GitHub for a device + user code. */
export async function requestDeviceCode(): Promise<DeviceCode> {
  if (!clientIdConfigured) {
    throw new Error(
      'GitHub client_id not set — paste your OAuth App Client ID into src/config.ts, then rebuild.',
    );
  }
  const data = await form(DEVICE_CODE_URL, {
    client_id: GITHUB_CLIENT_ID,
    scope: GITHUB_SCOPE,
  });
  if (data.error) throw new Error(data.error_description || data.error);
  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    deviceCode: data.device_code,
    interval: Number(data.interval) || 5,
    expiresIn: Number(data.expires_in) || 900,
  };
}

/** Outcome of a single token-endpoint poll. */
export type PollResult =
  | { status: 'authorized'; token: string }
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'error'; message: string };

/** Classify GitHub's token-endpoint JSON. Pure, so it's unit-tested directly.
 *  GitHub answers a still-pending poll with HTTP 200 + `authorization_pending`
 *  (verified against the live endpoint), so a non-token response is normal, not
 *  a failure — only access_denied / expired_token / the unexpected are fatal. */
export function classifyTokenResponse(data: Record<string, string>): PollResult {
  if (data.access_token) return { status: 'authorized', token: data.access_token };
  if (data.error === 'authorization_pending') return { status: 'pending' };
  if (data.error === 'slow_down') return { status: 'slow_down', interval: Number(data.interval) || 0 };
  return { status: 'error', message: data.error_description || data.error || 'github-device-flow-failed' };
}

/**
 * Step 2: ONE poll of the token endpoint. The caller repeats this on a durable
 * chrome.alarms tick — NOT an in-SW setTimeout loop, which MV3 silently kills
 * when it terminates the idle worker (that left the handshake half-finished and
 * the popup stuck showing the code).
 */
export async function pollOnce(deviceCode: string): Promise<PollResult> {
  const data = await form(TOKEN_URL, {
    client_id: GITHUB_CLIENT_ID,
    device_code: deviceCode,
    grant_type: GRANT_TYPE,
  });
  return classifyTokenResponse(data);
}
