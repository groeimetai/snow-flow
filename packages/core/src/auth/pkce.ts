/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Inlined to avoid subpath import issues with Bun compiled binaries
 */

// Base64url encoding (no external deps)
function base64urlEncode(buffer: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// Generate cryptographically secure random verifier
function generateVerifier(length: number): string {
  const buffer = new Uint8Array(length)
  crypto.getRandomValues(buffer)
  return base64urlEncode(buffer)
}

// Generate SHA-256 challenge from verifier
async function generateChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return base64urlEncode(new Uint8Array(hash))
}

/**
 * Generate PKCE verifier and challenge pair
 * @param length - Length of the verifier (default: 64)
 * @returns Object with verifier and challenge
 */
export async function generatePKCE(length = 64): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateVerifier(length)
  const challenge = await generateChallenge(verifier)
  return { verifier, challenge }
}
