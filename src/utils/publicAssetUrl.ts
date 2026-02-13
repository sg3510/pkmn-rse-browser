const ABSOLUTE_SCHEME_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function toPublicAssetUrl(path: string): string {
  if (path.length === 0 || ABSOLUTE_SCHEME_RE.test(path)) {
    return path;
  }

  if (!path.startsWith('/')) {
    return path;
  }

  const baseUrl = import.meta.env.BASE_URL ?? '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  if (normalizedBaseUrl === '/' || path.startsWith(normalizedBaseUrl)) {
    return path;
  }

  return `${normalizedBaseUrl}${path.slice(1)}`;
}
