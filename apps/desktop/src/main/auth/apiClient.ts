export type AuthenticatedFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>

/** Attach a Bearer token to outbound API calls (Milestone 4 HTTP helper). */
export async function fetchWithBearer(
  url: string,
  accessToken: string,
  init: RequestInit = {},
  fetchImpl: AuthenticatedFetch = fetch,
): Promise<Response> {
  if (!accessToken) {
    throw new Error('accessToken is required')
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  return fetchImpl(url, {
    ...init,
    headers,
  })
}

export async function fetchJsonWithBearer<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
  fetchImpl: AuthenticatedFetch = fetch,
): Promise<T> {
  const response = await fetchWithBearer(url, accessToken, init, fetchImpl)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status} for ${url}${body ? `: ${body}` : ''}`)
  }
  return (await response.json()) as T
}
