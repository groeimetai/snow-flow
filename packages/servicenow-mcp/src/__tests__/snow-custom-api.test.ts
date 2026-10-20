/**
 * snow_custom_api against two real servers on loopback: the instance, and
 * somewhere else. The tool used to hand its `path` argument straight to the
 * authenticated client, and axios drops baseURL for an absolute URL — so a
 * full URL sent the instance's Authorization header to that other server.
 * Nothing is mocked; the request either arrives somewhere or it does not.
 */

import { describe, test, expect } from "@jest/globals"
import { execute } from "../servicenow-mcp-unified/tools/extensions/snow_custom_api"

const listen = () => {
  const hits: { path: string; authorization: string | null }[] = []
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) => {
      hits.push({ path: new URL(req.url).pathname, authorization: req.headers.get("authorization") })
      return Response.json({ result: [] })
    },
  })
  return { url: `http://127.0.0.1:${server.port}`, host: `127.0.0.1:${server.port}`, hits, stop: () => server.stop(true) }
}

const context = (instanceUrl: string) => ({
  instanceUrl,
  clientId: "",
  clientSecret: "",
  username: "serac.integration",
  password: "not-a-real-password",
})

describe("snow_custom_api", () => {
  test("a full URL in path never reaches another host", async () => {
    const instance = listen()
    const elsewhere = listen()

    const results = await Promise.all(
      [`${elsewhere.url}/collect`, `//${elsewhere.host}/collect`].flatMap((path) =>
        ["GET", "POST"].map((method) => execute({ method, path, body: {} }, context(instance.url))),
      ),
    )

    expect(results.map((r) => r.success)).toEqual([false, false, false, false])
    expect(results[0].error).toContain("not a full URL")
    expect(elsewhere.hits).toEqual([])
    // Refused before any request, not merely redirected to the instance.
    expect(instance.hits).toEqual([])

    instance.stop()
    elsewhere.stop()
  })

  test("an instance path still reaches the instance with its credentials", async () => {
    const instance = listen()

    const result = await execute({ path: "/api/now/table/incident", params: { sysparm_limit: 1 } }, context(instance.url))

    expect(result.success).toBe(true)
    // The other hit is auth.ts checking the basic-auth credential first.
    const call = instance.hits.find((hit) => hit.path === "/api/now/table/incident")
    expect(call?.authorization?.startsWith("Basic ")).toBe(true)

    instance.stop()
  })
})
