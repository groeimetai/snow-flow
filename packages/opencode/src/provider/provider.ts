import z from "zod"
import { App } from "../app/app"
import { Config } from "../config/config"
import { PROVIDER_DATABASE } from "./database"
import { NoSuchModelError, type LanguageModel, type Provider as SDK } from "ai"
import { Log } from "../util/log"
import path from "path"
import { Global } from "../global"
import { BunProc } from "../bun"
import { BashTool } from "../tool/bash"
import { EditTool } from "../tool/edit"
import { WebFetchTool } from "../tool/webfetch"
import { GlobTool } from "../tool/glob"
import { GrepTool } from "../tool/grep"
import { ListTool } from "../tool/ls"
import { LspDiagnosticTool } from "../tool/lsp-diagnostics"
import { LspHoverTool } from "../tool/lsp-hover"
import { PatchTool } from "../tool/patch"
import { ReadTool } from "../tool/read"
import type { Tool } from "../tool/tool"
import { MultiEditTool } from "../tool/multiedit"
import { WriteTool } from "../tool/write"
import { TodoReadTool, TodoWriteTool } from "../tool/todo"
import { AuthAnthropic } from "../auth/anthropic"

export namespace Provider {
  const log = Log.create({ service: "provider" })

  export const Model = z
    .object({
      id: z.string(),
      name: z.string().optional(),
      cost: z.object({
        input: z.number(),
        inputCached: z.number(),
        output: z.number(),
        outputCached: z.number(),
      }),
      contextWindow: z.number(),
      maxOutputTokens: z.number().optional(),
      attachment: z.boolean(),
      reasoning: z.boolean().optional(),
    })
    .openapi({
      ref: "Provider.Model",
    })
  export type Model = z.output<typeof Model>

  export const Info = z
    .object({
      id: z.string(),
      name: z.string(),
      options: z.record(z.string(), z.any()).optional(),
      models: Model.array(),
    })
    .openapi({
      ref: "Provider.Info",
    })
  export type Info = z.output<typeof Info>

  const AUTODETECT: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    google: ["GOOGLE_GENERATIVE_AI_API_KEY"], // TODO: support GEMINI_API_KEY?
  }

  const AUTODETECT2: Record<
    string,
    () => Promise<Record<string, any> | false>
  > = {
    anthropic: async () => {
      const result = await AuthAnthropic.load()
      if (result)
        return {
          apiKey: "",
          headers: {
            authorization: `Bearer ${result.accessToken}`,
            "anthropic-beta": "oauth-2025-04-20",
          },
        }
      if (process.env["ANTHROPIC_API_KEY"]) return {}
      return false
    },
  }

  const state = App.state("provider", async () => {
    log.info("loading config")
    const config = await Config.get()
    log.info("loading providers")
    const providers = new Map<string, Info>()
    const models = new Map<string, { info: Model; language: LanguageModel }>()
    const sdk = new Map<string, SDK>()

    log.info("loading")

    for (const [providerID, fn] of Object.entries(AUTODETECT2)) {
      const provider = PROVIDER_DATABASE.find((x) => x.id === providerID)
      if (!provider) continue
      const result = await fn()
      if (!result) continue
      providers.set(providerID, {
        ...provider,
        options: {
          ...provider.options,
          ...result,
        },
      })
    }

    for (const item of PROVIDER_DATABASE) {
      if (!AUTODETECT[item.id].some((env) => process.env[env])) continue
      log.info("found", { providerID: item.id })
      providers.set(item.id, item)
    }

    for (const item of config.provider ?? []) {
      log.info("found", { providerID: item.id })
      providers.set(item.id, item)
    }

    return {
      models,
      providers,
      sdk,
    }
  })

  export async function active() {
    return state().then((state) => state.providers)
  }

  async function getSDK(providerID: string) {
    const s = await state()
    if (s.sdk.has(providerID)) return s.sdk.get(providerID)!

    const dir = path.join(
      Global.Path.cache,
      `node_modules`,
      `@ai-sdk`,
      providerID,
    )
    if (!(await Bun.file(path.join(dir, "package.json")).exists())) {
      log.info("installing", {
        providerID,
      })
      BunProc.run(["add", `@ai-sdk/${providerID}@alpha`], {
        cwd: Global.Path.cache,
      })
    }
    const mod = await import(path.join(dir))
    const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
    const loaded = fn(s.providers.get(providerID)?.options)
    s.sdk.set(providerID, loaded)
    return loaded as SDK
  }

  export async function getModel(providerID: string, modelID: string) {
    const key = `${providerID}/${modelID}`
    const s = await state()
    if (s.models.has(key)) return s.models.get(key)!

    log.info("loading", {
      providerID,
      modelID,
    })

    const provider = s.providers.get(providerID)
    if (!provider) throw new ModelNotFoundError(modelID)
    const info = provider.models.find((m) => m.id === modelID)
    if (!info) throw new ModelNotFoundError(modelID)

    const sdk = await getSDK(providerID)
    if (!sdk) throw new ModelNotFoundError(modelID)

    try {
      const language = sdk.languageModel(modelID)
      log.info("found", { providerID, modelID })
      s.models.set(key, {
        info,
        language,
      })
      return {
        info,
        language,
      }
    } catch (e) {
      if (e instanceof NoSuchModelError) throw new ModelNotFoundError(modelID)
      throw e
    }
  }

  export async function defaultModel() {
    const [provider] = await active().then((val) => val.values().toArray())
    if (!provider) throw new Error("no providers found")
    const model = provider.models[0]
    if (!model) throw new Error("no models found")
    return {
      providerID: provider.id,
      modelID: model.id,
    }
  }

  const TOOLS = [
    BashTool,
    EditTool,
    WebFetchTool,
    GlobTool,
    GrepTool,
    ListTool,
    LspDiagnosticTool,
    LspHoverTool,
    PatchTool,
    ReadTool,
    EditTool,
    // MultiEditTool,
    WriteTool,
    TodoWriteTool,
    TodoReadTool,
  ]
  const TOOL_MAPPING: Record<string, Tool.Info[]> = {
    anthropic: TOOLS.filter((t) => t.id !== "opencode.patch"),
    openai: TOOLS,
    google: TOOLS,
  }
  export async function tools(providerID: string) {
    const cfg = await Config.get()
    if (cfg.tool?.provider?.[providerID])
      return cfg.tool.provider[providerID].map(
        (id) => TOOLS.find((t) => t.id === id)!,
      )
    return TOOL_MAPPING[providerID] ?? TOOLS
  }

  class ModelNotFoundError extends Error {
    constructor(public readonly model: string) {
      super()
    }
  }
}
