import { Global } from "../global"
import { lazy } from "../util/lazy"
import { Log } from "../util/log"
import path from "path"
import { z } from "zod"

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const filepath = path.join(Global.Path.cache, "models.json")

  export const Model = z
    .object({
      name: z.string(),
      attachment: z.boolean(),
      reasoning: z.boolean(),
      temperature: z.boolean(),
      cost: z.object({
        input: z.number(),
        output: z.number(),
        inputCached: z.number(),
        outputCached: z.number(),
      }),
      limit: z.object({
        context: z.number(),
        output: z.number(),
      }),
      id: z.string(),
    })
    .openapi({
      ref: "Model.Info",
    })
  export type Model = z.infer<typeof Model>

  export const Provider = z
    .object({
      name: z.string(),
      env: z.array(z.string()),
      id: z.string(),
      npm: z.string().optional(),
      models: z.record(Model),
    })
    .openapi({
      ref: "Provider.Info",
    })

  export type Provider = z.infer<typeof Provider>

  export async function get() {
    const file = Bun.file(filepath)
    const result = await file.json().catch(() => {})
    if (result) {
      refresh()
      return result as Record<string, Provider>
    }
    await refresh()
    return get()
  }

  async function refresh() {
    const file = Bun.file(filepath)
    log.info("refreshing")
    const result = await fetch("https://models.dev/api.json")
    if (!result.ok)
      throw new Error(`Failed to fetch models.dev: ${result.statusText}`)
    await Bun.write(file, result)
  }

  const aisdk = lazy(async () => {
    log.info("fetching ai-sdk")
    const response = await fetch(
      "https://registry.npmjs.org/-/v1/search?text=scope:@ai-sdk",
    )
    if (!response.ok)
      throw new Error(
        `Failed to fetch ai-sdk information: ${response.statusText}`,
      )
    const result = await response.json()
    log.info("found ai-sdk", result.objects.length)
    return result.objects
      .filter((obj: any) => obj.package.name.startsWith("@ai-sdk/"))
      .reduce((acc: any, obj: any) => {
        acc[obj.package.name] = obj
        return acc
      }, {})
  })

  export async function pkg(providerID: string): Promise<[string, string]> {
    const packages = await aisdk()
    const match = packages[`@ai-sdk/${providerID}`]
    if (match) return [match.package.name, "latest"]
    return [providerID, "latest"]
  }
}
