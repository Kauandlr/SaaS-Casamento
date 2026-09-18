export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  // Browser scripts cannot set Sec-Fetch-Site. Reject requests the browser
  // identifies as coming from another origin, even if a proxy rewrites Host.
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    const receivedOrigin = new URL(origin).origin;
    const requestUrl = new URL(request.url);
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const host = request.headers.get('host')?.trim();
    const hostOrigin = host
      ? `${forwardedProto || requestUrl.protocol.replace(':', '')}://${host}`
      : requestUrl.origin;

    // A proxy may expose an internal Host or URL to the server. In that case,
    // the browser's same-origin signal describes the public request accurately.
    return receivedOrigin === requestUrl.origin ||
      receivedOrigin === hostOrigin ||
      fetchSite === 'same-origin';
  } catch {
    return false;
  }
}
