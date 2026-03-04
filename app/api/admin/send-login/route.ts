import { badRequest } from '@/lib/server';

export async function POST() {
  return badRequest('Admin magic-link sign-in has been disabled. Use email and password.', 410);
}
