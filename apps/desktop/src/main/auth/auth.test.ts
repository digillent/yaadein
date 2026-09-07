import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { generateCodeChallenge, generateCodeVerifier } from './pkce'
import { fetchWithBearer } from './apiClient'
import { assertAuthConfig, getAuthPublicConfig } from './authConfig'

describe('pkce', () => {
  it('generates a verifier in the RFC length range', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('produces the S256 challenge for a known verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = generateCodeChallenge(verifier)
    const expected = createHash('sha256')
      .update(verifier, 'ascii')
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    expect(challenge).toBe(expected)
  })
})

describe('fetchWithBearer', () => {
  it('attaches the Authorization bearer header', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('{}', { status: 200 })
    })

    await fetchWithBearer('https://example.test/me', 'token-123', {}, fetchImpl)

    expect(fetchImpl).toHaveBeenCalledOnce()
    const init = fetchImpl.mock.calls[0]?.[1]
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer token-123')
  })

  it('rejects an empty access token', async () => {
    await expect(fetchWithBearer('https://example.test/me', '')).rejects.toThrow(
      /accessToken is required/,
    )
  })
})

describe('authConfig', () => {
  it('builds authority from tenant id when env is set', () => {
    const previousClient = process.env.YAADEIN_ENTRA_CLIENT_ID
    const previousTenant = process.env.YAADEIN_ENTRA_TENANT_ID
    process.env.YAADEIN_ENTRA_CLIENT_ID = '11111111-1111-1111-1111-111111111111'
    process.env.YAADEIN_ENTRA_TENANT_ID = '22222222-2222-2222-2222-222222222222'
    try {
      const config = getAuthPublicConfig()
      expect(config.clientId).toBe('11111111-1111-1111-1111-111111111111')
      expect(config.tenantId).toBe('22222222-2222-2222-2222-222222222222')
      expect(config.authority).toBe(
        'https://login.microsoftonline.com/22222222-2222-2222-2222-222222222222',
      )
      expect(config.scopes).toContain('https://cosmos.azure.com/user_impersonation')
      expect(config.graphScopes).toContain('User.Read')
    } finally {
      process.env.YAADEIN_ENTRA_CLIENT_ID = previousClient
      process.env.YAADEIN_ENTRA_TENANT_ID = previousTenant
    }
  })

  it('assertAuthConfig rejects blank ids', () => {
    expect(() =>
      assertAuthConfig({
        clientId: '',
        tenantId: 't',
        authority: 'https://login.microsoftonline.com/t',
        scopes: ['https://cosmos.azure.com/user_impersonation'],
        graphScopes: ['User.Read'],
        cosmosScope: 'https://cosmos.azure.com/user_impersonation',
        storageScope: 'https://storage.azure.com/user_impersonation',
        redirectUri: 'http://localhost',
      }),
    ).toThrow(/required/)
  })
})
