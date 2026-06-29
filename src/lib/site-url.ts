const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function withDefaultProtocol(value: string): string {
  if (PROTOCOL_RE.test(value)) return value;

  const host = value.split(/[/?#]/, 1)[0]?.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  const protocol = host && LOCAL_HOSTNAMES.has(host) ? "http" : "https";
  return `${protocol}://${value}`;
}

export function normalizeOrigin(value?: string | null): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  try {
    const url = new URL(withDefaultProtocol(trimmed));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

// Open-redirect guard for `?next=` params: only internal absolute paths (`/foo`) are
// allowed — never protocol-relative (`//evil.com`) or absolute URLs. Falls back to
// /dashboard. Shared by the login page and the /auth/callback route so the two can't drift.
export function safeNextPath(raw?: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

export function publicSiteOrigin(fallbackOrigin?: string | null): string {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const fallback = normalizeOrigin(fallbackOrigin);

  if (configured && !(isLocalOrigin(configured) && fallback && !isLocalOrigin(fallback))) {
    return configured;
  }

  return fallback || configured || "http://localhost:3000";
}
