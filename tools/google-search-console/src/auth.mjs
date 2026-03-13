import http from 'node:http';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { spawn } from 'node:child_process';
import { google } from 'googleapis';
import { getOAuthConfig } from './config.mjs';
import { readToken, saveToken } from './token-store.mjs';

function openBrowser(url) {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
      return true;
    }

    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
      return true;
    }

    spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
    return true;
  } catch {
    return false;
  }
}

function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.on('request', (req, res) => {
      if (!req.url) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('Invalid callback request.');
        return;
      }

      const callbackUrl = new URL(req.url, 'http://127.0.0.1');
      if (callbackUrl.pathname !== '/oauth2callback') {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found.');
        return;
      }

      const code = callbackUrl.searchParams.get('code');
      const error = callbackUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('Google returned an error. You can close this tab and retry in terminal.');
        server.emit('oauth-error', new Error(`Google OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('No authorization code found. You can close this tab and retry in terminal.');
        server.emit('oauth-error', new Error('Missing authorization code in callback URL.'));
        return;
      }

      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('Authentication complete. You can return to your terminal.');
      server.emit('oauth-code', code);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind local OAuth callback server.'));
        return;
      }

      resolve({
        server,
        port: address.port,
      });
    });

    server.on('error', reject);
  });
}

async function waitForCode(server, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Google OAuth callback.'));
    }, timeoutMs);

    function onCode(code) {
      cleanup();
      resolve(code);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function cleanup() {
      clearTimeout(timer);
      server.off('oauth-code', onCode);
      server.off('oauth-error', onError);
    }

    server.on('oauth-code', onCode);
    server.on('oauth-error', onError);
  });
}

async function promptForAuthCode() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const raw = await rl.question('Paste the Google authorization code here: ');
    return raw.trim();
  } finally {
    rl.close();
  }
}

export async function getAuthedOAuthClient({ interactive = false } = {}) {
  const { clientId, clientSecret, scope } = getOAuthConfig();

  const token = await readToken();
  if (token) {
    const oauthClient = new google.auth.OAuth2({
      clientId,
      clientSecret,
    });
    oauthClient.setCredentials(token);
    oauthClient.on('tokens', async (newTokens) => {
      await saveToken({ ...oauthClient.credentials, ...newTokens });
    });
    return oauthClient;
  }

  if (!interactive) {
    throw new Error('No local token found. Run `authenticate` first.');
  }

  return authenticate();
}

export async function authenticate() {
  const { clientId, clientSecret, scope } = getOAuthConfig();

  const { server, port } = await startCallbackServer();
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const oauthClient = new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri,
  });

  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [scope],
  });

  const opened = openBrowser(authUrl);
  console.log('');
  console.log('Google Search Console authentication');
  console.log('1) Sign in and grant access in your browser.');
  console.log('2) If the browser does not open, paste this URL into your browser:');
  console.log(authUrl);
  if (opened) {
    console.log('3) After consent, wait for redirect confirmation and return here.');
  }

  let code;

  try {
    code = await waitForCode(server, 3 * 60 * 1000);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('access_denied')) {
      throw new Error(
        'Google denied access (access_denied). In Google Cloud Console, add your Google account as an OAuth test user (OAuth consent screen -> Audience/Test users), then retry `authenticate`.'
      );
    }

    console.log('');
    console.log('Automatic callback did not complete.');
    console.log('Copy the `code` query parameter from the redirected URL and paste it below.');
    code = await promptForAuthCode();
    if (!code) {
      throw new Error('Authorization code was empty. Authentication aborted.');
    }
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }

  const { tokens } = await oauthClient.getToken(code);
  if (!tokens || !tokens.access_token) {
    throw new Error('Google did not return an access token.');
  }

  oauthClient.setCredentials(tokens);
  await saveToken(tokens);

  oauthClient.on('tokens', async (newTokens) => {
    await saveToken({ ...oauthClient.credentials, ...newTokens });
  });

  return oauthClient;
}
