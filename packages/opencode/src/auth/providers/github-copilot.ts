/**
 * Built-in GitHub Copilot auth provider for snow-code
 * Allows using GitHub Copilot subscription for AI models
 */
import type { BuiltInAuthProvider } from "./types"

const CLIENT_ID = "Iv1.b507a08c87ecfe98"
const DEVICE_CODE_URL = "https://github.com/login/device/code"
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
const COPILOT_API_KEY_URL = "https://api.github.com/copilot_internal/v2/token"

const HEADERS = {
  "User-Agent": "GitHubCopilotChat/0.31.2",
  "Editor-Version": "vscode/1.104.1",
  "Editor-Plugin-Version": "copilot-chat/0.31.2",
  "Copilot-Integration-Id": "vscode-chat",
}

export const GitHubCopilotAuthProvider: BuiltInAuthProvider = {
  provider: "github-copilot",

  async loader(getAuth, provider, client) {
    const info = await getAuth()
    if (!info || info.type !== "oauth") return {}

    // Zero out cost for Copilot plan
    if (provider && provider.models) {
      for (const model of Object.values(provider.models)) {
        model.cost = {
          input: 0,
          output: 0,
        }
      }
    }

    return {
      apiKey: "",
      async fetch(input: RequestInfo | URL, init: RequestInit) {
        const info = await getAuth()
        if (info.type !== "oauth") return undefined
        if (!info.access || (info.expires && info.expires < Date.now())) {
          const response = await fetch(COPILOT_API_KEY_URL, {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${info.refresh}`,
              ...HEADERS,
            },
          })

          if (!response.ok) return undefined

          const tokenData = (await response.json()) as { token: string; expires_at: number }

          await client.auth.set({
            path: {
              id: provider.id,
            },
            body: {
              type: "oauth",
              refresh: info.refresh!,
              access: tokenData.token,
              expires: tokenData.expires_at * 1000,
            },
          })
          info.access = tokenData.token
        }

        let isAgentCall = false
        let isVisionRequest = false
        try {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body
          if (body?.messages) {
            isAgentCall = body.messages.some(
              (msg: { role?: string }) => msg.role && ["tool", "assistant"].includes(msg.role),
            )
            isVisionRequest = body.messages.some(
              (msg: { content?: Array<{ type?: string }> }) =>
                Array.isArray(msg.content) && msg.content.some((part) => part.type === "image_url"),
            )
          }
        } catch {}

        const headers: Record<string, string> = {
          ...(init.headers as Record<string, string>),
          ...HEADERS,
          Authorization: `Bearer ${info.access}`,
          "Openai-Intent": "conversation-edits",
          "X-Initiator": isAgentCall ? "agent" : "user",
        }
        if (isVisionRequest) {
          headers["Copilot-Vision-Request"] = "true"
        }
        delete headers["x-api-key"]
        return fetch(input, {
          ...init,
          headers,
        })
      },
    }
  },

  methods: [
    {
      label: "Login with GitHub",
      type: "oauth",
      authorize: async () => {
        const deviceResponse = await fetch(DEVICE_CODE_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "GitHubCopilotChat/0.31.2",
          },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            scope: "read:user",
          }),
        })
        const deviceData = (await deviceResponse.json()) as {
          verification_uri: string
          user_code: string
          device_code: string
          interval: number
        }
        return {
          url: deviceData.verification_uri,
          instructions: `Enter code: ${deviceData.user_code}`,
          method: "auto",
          callback: async () => {
            // SECURITY: Enforce a 10-minute timeout on device code polling
            // to prevent indefinite loops if the user never completes authorization
            const deadline = Date.now() + 10 * 60 * 1000
            while (Date.now() < deadline) {
              const response = await fetch(ACCESS_TOKEN_URL, {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  "User-Agent": "GitHubCopilotChat/0.31.2",
                },
                body: JSON.stringify({
                  client_id: CLIENT_ID,
                  device_code: deviceData.device_code,
                  grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                }),
              })

              if (!response.ok) return { type: "failed" as const }

              const data = (await response.json()) as {
                access_token?: string
                error?: string
              }

              if (data.access_token) {
                return {
                  type: "success" as const,
                  refresh: data.access_token,
                  access: "",
                  expires: 0,
                }
              }

              if (data.error === "authorization_pending") {
                await new Promise((resolve) => setTimeout(resolve, deviceData.interval * 1000))
                continue
              }

              if (data.error) return { type: "failed" as const }

              await new Promise((resolve) => setTimeout(resolve, deviceData.interval * 1000))
              continue
            }
            return { type: "failed" as const }
          },
        }
      },
    },
  ],
}
