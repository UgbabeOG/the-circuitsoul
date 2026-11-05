import 'server-only';

import { requireActiveSession, type UserSession } from '@circuitsoul/auth';
import { isPlatformAdminEmail } from './platform-admin-policy';

export async function requirePlatformAdmin(
  headers: Record<string, string | undefined>
): Promise<UserSession> {
  const session = await requireActiveSession(headers);
  if (
    !isPlatformAdminEmail(
      session.email,
      process.env.CIRCUITSOUL_PLATFORM_ADMIN_EMAILS
    )
  ) {
    throw new Error('Forbidden: Platform administrator access required');
  }

  return session;
}
