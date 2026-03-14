import { authenticate } from '../auth.mjs';
import { getTokenPath } from '../token-store.mjs';

export async function runAuthenticateCommand() {
  await authenticate();
  console.log('');
  console.log('Authentication successful.');
  console.log(`Token saved to: ${getTokenPath()}`);
}
