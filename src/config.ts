// GitHub OAuth App identity. The client_id is PUBLIC and safe to embed in the
// extension — device flow needs no client secret (that's why we use it; see the
// implementation plan). Refresh tokens are not used: OAuth App device-flow
// tokens don't expire by default.
//
// SETUP (one-time, by the developer publishing the extension):
//   1. https://github.com/settings/applications/new  → create an OAuth App
//   2. In the app settings, tick "Enable Device Flow"
//   3. Paste its Client ID below.
export const GITHUB_CLIENT_ID = 'Ov23liFR5yn2VKYuvJal';

// Smallest scope that can write files to private repos (PRD §27 default-Private).
// Narrow to 'public_repo' if you only ever target public repositories.
export const GITHUB_SCOPE = 'repo';

// True once the developer has pasted a real Client ID above. The popup uses this
// to show a "configure me" hint instead of failing when you click Authorize.
export const clientIdConfigured =
  (GITHUB_CLIENT_ID as string) !== 'YOUR_GITHUB_OAUTH_APP_CLIENT_ID';
