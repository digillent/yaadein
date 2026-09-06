import { createHash, randomBytes } from 'node:crypto'

/** RFC 7636 code_verifier (43–128 chars from unreserved set). */
export function generateCodeVerifier(byteLength = 32): string {
  if (byteLength < 32 || byteLength > 96) {
    throw new Error('byteLength must be between 32 and 96')
  }
  return base64Url(randomBytes(byteLength))
}

/** S256 code_challenge = BASE64URL(SHA256(verifier)). */
export function generateCodeChallenge(verifier: string): string {
  if (!verifier) {
    throw new Error('verifier is required')
  }
  return base64Url(createHash('sha256').update(verifier, 'ascii').digest())
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
