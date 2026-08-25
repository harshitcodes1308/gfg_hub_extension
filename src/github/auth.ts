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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/**
 * Step 2: poll the token endpoint until the user authorizes. Handles GitHub's
 * pacing signals (`authorization_pending` = keep waiting, `slow_down` = back
 * off). Resolves with the access token, or rejects if the code expires or the
 * user denies (the outer deadline is a backstop against polling forever).
 */
export async function pollForToken(dc: DeviceCode): Promise<string> {
  const deadline = Date.now() + dc.expiresIn * 1000;
  let interval = dc.interval;

  while (Date.now() < deadline) {
    await delay(interval * 1000);
    const data = await form(TOKEN_URL, {
      client_id: GITHUB_CLIENT_ID,
      device_code: dc.deviceCode,
      grant_type: GRANT_TYPE,
    });
    if (data.access_token) return data.access_token;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      interval = Number(data.interval) || interval + 5;
      continue;
    }
    // access_denied, expired_token, or anything unexpected — stop.
    throw new Error(data.error_description || data.error || 'github-device-flow-failed');
  }
  throw new Error('github-device-flow-expired');
}
