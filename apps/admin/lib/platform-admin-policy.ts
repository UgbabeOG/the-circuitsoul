export function isPlatformAdminEmail(
  email: string | undefined,
  configuredAllowlist: string | undefined
): boolean {
  if (!email || !configuredAllowlist) return false;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return configuredAllowlist
    .split(',')
    .some((candidate) => candidate.trim().toLowerCase() === normalizedEmail);
}
