import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const configDir = path.join(os.homedir(), '.config', 'compendium-search-console');
const tokenPath = path.join(configDir, 'gsc-token.json');

export function getTokenPath() {
  return tokenPath;
}

export async function readToken() {
  try {
    const raw = await fs.readFile(tokenPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to read token file at ${tokenPath}: ${error.message}`);
  }
}

export async function saveToken(token) {
  await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
  await fs.chmod(configDir, 0o700).catch(() => {});
  await fs.writeFile(tokenPath, JSON.stringify(token, null, 2), { mode: 0o600 });
  await fs.chmod(tokenPath, 0o600).catch(() => {});
}
