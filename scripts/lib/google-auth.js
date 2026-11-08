// Shared Google credential handling for the data-pull scripts.
//
// A service-account key is the only supported credential. User ADC is deliberately not
// supported: the OAuth client behind `gcloud auth application-default login` sits in Testing
// mode, so its refresh token expires roughly every 7 days, and Google refuses the sensitive
// analytics.readonly scope on it outright ("This app is blocked"). A service account has
// neither problem and is granted per-API — Search Console users list, GA4 property access.
//
// Keys are never stored in the repo. Default locations are under %APPDATA%\gcloud on
// Windows and ~/.config/gcloud elsewhere. Nothing here logs key material.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function credentialCandidates() {
  const gcloud = process.env.APPDATA ? path.join(process.env.APPDATA, 'gcloud') : null;
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return [
    gcloud ? path.join(gcloud, 'service-account.json') : null,
    home ? path.join(home, '.config', 'gcloud', 'service-account.json') : null,
  ].filter(Boolean);
}

function resolveCredentialPath(explicit) {
  if (explicit) return explicit;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidates = credentialCandidates();
  return candidates.find(function (p) { return fs.existsSync(p); }) || candidates[0];
}

function loadCredential(filePath) {
  if (!filePath) {
    throw new Error('No credential path resolved. Set GOOGLE_APPLICATION_CREDENTIALS or place a key at ' +
      credentialCandidates()[0] + '.');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Service-account key not found: ' + filePath + ' (create one with ' +
      '`gcloud iam service-accounts keys create`).');
  }
  const cred = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (cred.type !== 'service_account') {
    throw new Error('Credential ' + path.basename(filePath) + ' has type "' + (cred.type || 'unknown') +
      '"; these scripts use service-account keys only.');
  }
  if (!cred.private_key || !cred.client_email) {
    throw new Error('Service-account key is missing private_key or client_email');
  }
  return cred;
}

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(sa, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }));
  const signingInput = header + '.' + claim;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const assertion = signingInput + '.' + base64url(signer.sign(sa.private_key));

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Service account token exchange failed: HTTP ' + res.status + ' ' + text.slice(0, 200));
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error('Service account token exchange returned no access_token');
  return json.access_token;
}

module.exports = {
  TOKEN_URL,
  credentialCandidates,
  resolveCredentialPath,
  loadCredential,
  getAccessToken,
};
