import type { ExtendedAxiosInstance } from "./auth.js"

const BASE = "/api/sn_uibtk_api/buildertoolkit"

let cached: string | undefined

export function btk(path: string): string {
  return `${BASE}${path}`
}

export async function getAppShellUI(client: ExtendedAxiosInstance): Promise<string> {
  if (cached) return cached

  const response = await client.get("/api/now/table/sys_ux_macroponent", {
    params: {
      sysparm_query: "name=uib_app_shell^category=app_shell",
      sysparm_fields: "sys_id",
      sysparm_limit: 1,
    },
  })

  const id = response.data.result?.[0]?.sys_id
  if (!id) {
    const fallback = await client.get("/api/now/table/sys_ux_macroponent", {
      params: {
        sysparm_query: "name=x_snc_app_shell_uib_app_shell^category=app_shell",
        sysparm_fields: "sys_id",
        sysparm_limit: 1,
      },
    })
    const fallbackId = fallback.data.result?.[0]?.sys_id
    if (!fallbackId) throw new Error("Could not find appShellUI macroponent (uib_app_shell) on this instance")
    cached = fallbackId
    return fallbackId
  }

  cached = id
  return id
}
