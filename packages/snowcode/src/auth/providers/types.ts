/**
 * Types for built-in auth providers
 */
import type { createOpencodeClient } from "@groeimetai/snow-flow-sdk"

export type AuthClient = ReturnType<typeof createOpencodeClient>

export type AuthInfo = {
  type: string
  access?: string
  refresh?: string
  expires?: number
}

export type ProviderInfo = {
  id: string
  models: Record<string, { cost?: { input: number; output: number } }>
}

export type AuthResult =
  | { type: "success"; refresh: string; access: string; expires: number }
  | { type: "success"; key: string }
  | { type: "failed" }

export type AuthMethod =
  | {
      type: "oauth"
      label: string
      authorize(): Promise<
        { url: string; instructions: string } & (
          | {
              method: "auto"
              callback(): Promise<AuthResult>
            }
          | {
              method: "code"
              callback(code: string): Promise<AuthResult>
            }
        )
      >
    }
  | { type: "api"; label: string; provider?: string }

export interface BuiltInAuthProvider {
  provider: string
  loader?: (
    getAuth: () => Promise<AuthInfo>,
    provider: ProviderInfo,
    client: AuthClient,
  ) => Promise<Record<string, any>>
  methods: AuthMethod[]
}
