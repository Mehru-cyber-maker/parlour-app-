type OriginEnvironment = Record<string, string | undefined>;

/** Check browser mutations against this app's host or its exact Codespaces preview. */
export function isAllowedOrigin(request: Pick<Request, 'headers'>, environment: OriginEnvironment = process.env): boolean {
  const origin = request.headers.get('origin');
  // Non-browser API clients do not necessarily send Origin. Browser sessions also
  // use SameSite cookies; browser requests that do send Origin are checked below.
  if (!origin) return true;

  let parsed: URL;
  try { parsed = new URL(origin); } catch { return false; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;

  const host = request.headers.get('host')?.toLowerCase();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim().toLowerCase();
  if (parsed.host === host || parsed.host === forwardedHost) return true;

  // Codespaces can rewrite both Host and X-Forwarded-Host to an internal address.
  // Derive one trusted HTTPS origin from server-provided metadata, never accept
  // arbitrary *.app.github.dev origins or a client-provided configuration value.
  if (environment.CODESPACES !== 'true') return false;
  const name = environment.CODESPACE_NAME || '';
  const domain = environment.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
  const port = environment.PORT || '3000';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(domain)) return false;
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) return false;
  return origin === `https://${name}-${port}.${domain}`;
}
