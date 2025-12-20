import path from "path"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod/v4"

export namespace Auth {
  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(),
      access: z.string(),
      expires: z.number(),
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

  export const Info = z
    .discriminatedUnion("type", [Oauth, Api, WellKnown, ServiceNowOAuth, ServiceNowBasic, Enterprise, Portal])
    .meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  const filepath = path.join(Global.Path.data, "auth.json")

  export async function get(providerID: string) {
    const file = Bun.file(filepath)
    return file
      .json()
      .catch(() => ({}))
      .then((x) => x[providerID] as Info | undefined)
  }

  export async function all(): Promise<Record<string, Info>> {
    const file = Bun.file(filepath)
    return file.json().catch(() => ({}))
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
