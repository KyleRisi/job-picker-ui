import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const WEBMASTERS_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

const currentFilePath = fileURLToPath(import.meta.url);
const srcDir = path.dirname(currentFilePath);
const toolRoot = path.resolve(srcDir, '..');
const localEnvPath = path.join(toolRoot, '.env.local');

dotenv.config({ path: localEnvPath });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Add it to ${localEnvPath} (copy from .env.example).`
    );
  }
  return value;
}

export function getOAuthConfig() {
  return {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    scope: WEBMASTERS_READONLY_SCOPE,
    localEnvPath,
    toolRoot,
  };
}
