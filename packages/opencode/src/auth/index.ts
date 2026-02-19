import path from "path"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod"

export const OAUTH_DUMMY_KEY = "snow-code-oauth-dummy-key"

export namespace Auth {
  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(),
      access: z.string(),
      expires: z.number(),
      accountId: z.string().optional(),
      enterpriseUrl: z.string().optional(),
    })
    .meta({ ref: "OAuth" })

  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(),
    })
    .meta({ ref: "ApiAuth" })

  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(),
      token: z.string(),
    })
    .meta({ ref: "WellKnownAuth" })

  // ServiceNow OAuth2 + PKCE authentication
  export const ServiceNowOAuth = z
    .object({
      type: z.literal("servicenow-oauth"),
      instance: z.string(),
      clientId: z.string(),
      clientSecret: z.string(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresAt: z.number().optional(),
    })
    .meta({ ref: "ServiceNowOAuth" })

  // ServiceNow Basic authentication
  export const ServiceNowBasic = z
    .object({
      type: z.literal("servicenow-basic"),
      instance: z.string(),
      username: z.string(),
      password: z.string(),
    })
    .meta({ ref: "ServiceNowBasic" })

  /**
   * Enterprise authentication.
   * SECURITY: Only JWT token is stored. All credentials (Jira, Azure DevOps, Confluence)
   * are fetched server-side by the enterprise MCP server.
   */
  export const Enterprise = z
    .object({
      type: z.literal("enterprise"),
      // NOTE: licenseKey is now optional - we use JWT token for authentication
      licenseKey: z.string().optional(),
      enterpriseUrl: z.string().optional(),
      // JWT token from device authorization flow
      token: z.string().optional(),
      sessionToken: z.string().optional(),
      username: z.string().optional(),
      email: z.string().optional(),
      role: z.string().optional(),
      machineId: z.string().optional(),
      // DEPRECATED: These credential fields are no longer used
      // Credentials are fetched server-side by the enterprise MCP server
      jiraBaseUrl: z.string().optional(),
      confluenceUrl: z.string().optional(),
      atlassianEmail: z.string().optional(),
      atlassianApiToken: z.string().optional(),
      azureOrg: z.string().optional(),
      azureProject: z.string().optional(),
      azurePat: z.string().optional(),
      // Subscription & feature gating (set after device/verify)
      features: z.array(z.string()).optional(),
      subscriptionStatus: z.string().optional(),
      trialEndsAt: z.number().optional(),
    })
    .meta({ ref: "Enterprise" })

  // Portal auth for Individual/Teams users (email-based authentication)
  export const Portal = z
    .object({
      type: z.literal("portal"),
      token: z.string(),
      refreshToken: z.string().optional(),
      expiresAt: z.number().optional(),
      userId: z.number(),
      email: z.string(),
      name: z.string().optional(),
      plan: z.enum(["individual", "teams"]),
      organizationId: z.number().optional(),
      organizationName: z.string().optional(),
      role: z.enum(["owner", "admin", "developer", "stakeholder"]).optional(),
      machineId: z.string().optional(),
    })
    .meta({ ref: "Portal" })

  /**
   * MID Server authentication for routing LLM/API requests through ServiceNow MID Server.
   * Used for on-premise instances or when requests need to traverse internal networks.
   */
  export const MidServer = z
    .object({
      type: z.literal("mid-server"),
      // ServiceNow instance URL
      instance: z.string(),
      // MID Server identification
      midServerName: z.string(),
      midServerSysId: z.string().optional(),
      // Authentication for MID Server
      authType: z.enum(["basic", "oauth", "mutual-tls"]).default("basic"),
      // Basic auth credentials
      username: z.string().optional(),
      password: z.string().optional(),
      // OAuth credentials (if using oauth auth type)
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresAt: z.number().optional(),
      // Mutual TLS (if using mutual-tls auth type)
      certPath: z.string().optional(),
      keyPath: z.string().optional(),
      caPath: z.string().optional(),
      // MID Server endpoint configuration
      midServerUrl: z.string().optional(), // Direct URL to MID Server if not using instance routing
      proxyEnabled: z.boolean().default(true),
      // LLM routing configuration
      routeLlmRequests: z.boolean().default(true),
      routeApiRequests: z.boolean().default(true),
      // Timeout and retry settings
      timeout: z.number().default(30000),
      retries: z.number().default(3),
    })
    .meta({ ref: "MidServer" })

  export const Info = z
    .discriminatedUnion("type", [Oauth, Api, WellKnown, ServiceNowOAuth, ServiceNowBasic, Enterprise, Portal, MidServer])
    .meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  const filepath = path.join(Global.Path.data, "auth.json")

  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  export async function all(): Promise<Record<string, Info>> {
    const file = Bun.file(filepath)
    const data = await file.json().catch(() => ({}) as Record<string, unknown>)
    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        const parsed = Info.safeParse(value)
        if (!parsed.success) return acc
        acc[key] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
    )
  }

  export async function set(key: string, info: Info) {
    const file = Bun.file(filepath)
    const data = await all()
    await Bun.write(file, JSON.stringify({ ...data, [key]: info }, null, 2))
    await fs.chmod(file.name!, 0o600)
  }

  export async function remove(key: string) {
    const file = Bun.file(filepath)
    const data = await all()
    delete data[key]
    await Bun.write(file, JSON.stringify(data, null, 2))
    await fs.chmod(file.name!, 0o600)
  }
}
