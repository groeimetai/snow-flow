/**
 * Built-in Anthropic OAuth auth provider for snow-code
 * Supports Claude Pro/Max subscription authentication
 */
import { generatePKCE } from "../pkce"
import type { BuiltInAuthProvider } from "./types"

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

async function authorize(mode: "max" | "console") {
  const pkce = await generatePKCE()
  // Generate a separate random state for CSRF protection.
  // The PKCE verifier must NOT be used as the state parameter because:
  // 1. The state is visible in the URL and can leak via Referer headers
  // 2. Exposing the verifier defeats the purpose of PKCE
  const stateBuffer = new Uint8Array(32)
  crypto.getRandomValues(stateBuffer)
  const state = btoa(String.fromCharCode(...stateBuffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  const url = new URL(`https://${mode === "console" ? "console.anthropic.com" : "claude.ai"}/oauth/authorize`)
  url.searchParams.set("code", "true")
  url.searchParams.set("client_id", CLIENT_ID)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", "https://console.anthropic.com/oauth/code/callback")
  url.searchParams.set("scope", "org:create_api_key user:profile user:inference")
  url.searchParams.set("code_challenge", pkce.challenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("state", state)
  return {
    url: url.toString(),
    verifier: pkce.verifier,
  }
}

async function exchange(code: string, verifier: string) {
  const splits = code.split("#")
  const result = await fetch("https://console.anthropic.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: splits[0],
      state: splits[1],
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: "https://console.anthropic.com/oauth/code/callback",
      code_verifier: verifier,
    }),
  })
  if (!result.ok)
    return {
      type: "failed" as const,
    }
  const json = (await result.json()) as { refresh_token: string; access_token: string; expires_in: number }
  return {
    type: "success" as const,
    refresh: json.refresh_token,
    access: json.access_token,
    expires: Date.now() + json.expires_in * 1000,
  }
}

export const AnthropicAuthProvider: BuiltInAuthProvider = {
  provider: "anthropic",

  async loader(getAuth, provider, client) {
    const auth = await getAuth()
    if (auth.type === "oauth") {
      // Zero out cost for max plan
      for (const model of Object.values(provider.models)) {
        model.cost = {
          input: 0,
          output: 0,
        }
      }
      return {
        apiKey: "",
        async fetch(input: RequestInfo | URL, init: RequestInit) {
          const auth = await getAuth()
          if (auth.type !== "oauth") return fetch(input, init)
          if (!auth.access || (auth.expires && auth.expires < Date.now())) {
            const response = await fetch("https://console.anthropic.com/v1/oauth/token", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                grant_type: "refresh_token",
                refresh_token: auth.refresh,
                client_id: CLIENT_ID,
              }),
            })
            if (!response.ok) return undefined
            const json = (await response.json()) as { refresh_token: string; access_token: string; expires_in: number }
            await client.auth.set({
              path: {
                id: "anthropic",
              },
              body: {
                type: "oauth",
                refresh: json.refresh_token,
                access: json.access_token,
                expires: Date.now() + json.expires_in * 1000,
              },
            })
            auth.access = json.access_token
          }
          const headers: Record<string, string> = {
            ...(init.headers as Record<string, string>),
            authorization: `Bearer ${auth.access}`,
            "anthropic-beta":
              "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
          }
          delete headers["x-api-key"]
          return fetch(input, {
            ...init,
            headers,
          })
        },
      }
    }

    return {}
  },

  methods: [
    {
      label: "Claude Pro/Max",
      type: "oauth",
      authorize: async () => {
        const { url, verifier } = await authorize("max")
        return {
          url: url,
          instructions: "Paste the authorization code here: ",
          method: "code",
          callback: async (code: string) => {
            const credentials = await exchange(code, verifier)
            return credentials
          },
        }
      },
    },
    {
      label: "Create an API Key",
      type: "oauth",
      authorize: async () => {
        const { url, verifier } = await authorize("console")
        return {
          url: url,
          instructions: "Paste the authorization code here: ",
          method: "code",
          callback: async (code: string) => {
            const credentials = await exchange(code, verifier)
            if (credentials.type === "failed") return credentials
            const result = await fetch(`https://api.anthropic.com/api/oauth/claude_cli/create_api_key`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                authorization: `Bearer ${credentials.access}`,
              },
            }).then((r) => r.json() as Promise<{ raw_key: string }>)
            return { type: "success" as const, key: result.raw_key }
          },
        }
      },
    },
    {
      provider: "anthropic",
      label: "Manually enter API Key",
      type: "api",
    },
  ],
}
