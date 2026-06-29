export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return data as T;
}

// Pull the API's { error: { message } } off a non-ok Response for the manual fetch callers
// (streaming / multipart bodies that can't go through apiFetch), falling back to a status code.
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message || `${fallback} (${res.status})`;
}
