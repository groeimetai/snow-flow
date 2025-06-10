import z from "zod"
import { App } from "../app/app"
import { Config } from "../config/config"
import { mapValues, sortBy } from "remeda"
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
import { WriteTool } from "../tool/write"
import { TodoReadTool, TodoWriteTool } from "../tool/todo"
import { AuthAnthropic } from "../auth/anthropic"
import { ModelsDev } from "./models"
import { NamedError } from "../util/error"
import { AuthKeys } from "../auth/keys"

export namespace Provider {
  const log = Log.create({ service: "provider" })

  export const Model = z
    .object({
      id: z.string(),
      name: z.string().optional(),
      attachment: z.boolean(),
      reasoning: z.boolean().optional(),
      cost: z.object({
        input: z.number(),
        inputCached: z.number(),
        output: z.number(),
        outputCached: z.number(),
      }),
      limit: z.object({
        context: z.number(),
        output: z.number(),
      }),
    })
    .openapi({
      ref: "Provider.Model",
    })
  export type Model = z.output<typeof Model>

  export const Info = z
    .object({
      id: z.string(),
      name: z.string(),
      models: z.record(z.string(), Model),
    })
    .openapi({
      ref: "Provider.Info",
    })
  export type Info = z.output<typeof Info>

  type Autodetector = (provider: Info) => Promise<
    | {
        source: Source
        options: Record<string, any>
      }
    | false
  >

  function env(...keys: string[]) {
    const result: Autodetector = async () => {
      for (const key of keys) {
        if (process.env[key])
          return {
            source: "env",
            options: {},
          }
      }
      return false
    }

    return result
  }

  type Source = "oauth" | "env" | "config" | "global"

  const AUTODETECT: Record<string, Autodetector> = {
    async anthropic(provider) {
      const access = await AuthAnthropic.access()
      if (access) {
        // claude sub doesn't have usage cost
        for (const model of Object.values(provider.models)) {
          model.cost = {
            input: 0,
            inputCached: 0,
            output: 0,
            outputCached: 0,
          }
        }
        return {
          source: "oauth",
          options: {
            apiKey: "",
            headers: {
              authorization: `Bearer ${access}`,
              "anthropic-beta": "oauth-2025-04-20",
            },
          },
        }
      }
      return env("ANTHROPIC_API_KEY")(provider)
    },
    google: env("GOOGLE_GENERATIVE_AI_API_KEY"),
    openai: env("OPENAI_API_KEY"),
  }

  const state = App.state("provider", async () => {
    const config = await Config.get()
    const database: Record<string, Provider.Info> = await ModelsDev.get()

    const providers: {
      [providerID: string]: {
        source: Source
        info: Provider.Info
        options: Record<string, any>
      }
    } = {}
    const models = new Map<string, { info: Model; language: LanguageModel }>()
    const sdk = new Map<string, SDK>()

    log.info("loading")

    function mergeProvider(
      id: string,
      options: Record<string, any>,
      source: Source,
    ) {
      const provider = providers[id]
      if (!provider) {
        providers[id] = {
          source,
          info: database[id] ?? {
            id,
            name: id,
            models: [],
          },
          options,
        }
        return
      }
      provider.options = {
        ...provider.options,
        ...options,
      }
      provider.source = source
    }

    for (const [providerID, fn] of Object.entries(AUTODETECT)) {
      const provider = database[providerID]
      if (!provider) continue
      const result = await fn(provider)
      if (!result) continue
      mergeProvider(providerID, result.options, result.source)
    }

    const keys = await AuthKeys.get()
    for (const [providerID, key] of Object.entries(keys)) {
      mergeProvider(
        providerID,
        {
          apiKey: key,
        },
        "global",
      )
    }

    for (const [providerID, options] of Object.entries(config.provider ?? {})) {
      mergeProvider(providerID, options, "config")
    }

    for (const providerID of Object.keys(providers)) {
      log.info("loaded", { providerID })
    }

    return {
      models,
      providers,
      sdk,
    }
  })

  export async function list() {
    return state().then((state) => state.providers)
  }

  async function getSDK(providerID: string) {
    return (async () => {
      const s = await state()
      const existing = s.sdk.get(providerID)
      if (existing) return existing
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
        await BunProc.run(["add", `@ai-sdk/${providerID}@alpha`], {
          cwd: Global.Path.cache,
        })
      }
      const mod = await import(path.join(dir))
      const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
      const loaded = fn(s.providers[providerID]?.options)
      s.sdk.set(providerID, loaded)
      return loaded as SDK
    })().catch((e) => {
      throw new InitError({ providerID: providerID }, { cause: e })
    })
  }

  export async function getModel(providerID: string, modelID: string) {
    const key = `${providerID}/${modelID}`
    const s = await state()
    if (s.models.has(key)) return s.models.get(key)!

    log.info("loading", {
      providerID,
      modelID,
    })

    const provider = s.providers[providerID]
    if (!provider) throw new ModelNotFoundError({ providerID, modelID })
    const info = provider.info.models[modelID]
    if (!info) throw new ModelNotFoundError({ providerID, modelID })

    const sdk = await getSDK(providerID)

    try {
      const language =
        // @ts-expect-error
        "responses" in sdk ? sdk.responses(modelID) : sdk.languageModel(modelID)
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
      if (e instanceof NoSuchModelError)
        throw new ModelNotFoundError(
          {
            modelID: modelID,
            providerID,
          },
          { cause: e },
        )
      throw e
    }
  }

  const priority = ["claude-sonnet-4", "gemini-2.5-pro-preview", "codex-mini"]
  export function sort(models: Model[]) {
    return sortBy(
      models,
      [(model) => priority.indexOf(model.id), "desc"],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  export async function defaultModel() {
    const [provider] = await list().then((val) => Object.values(val))
    if (!provider) throw new Error("no providers found")
    const [model] = sort(Object.values(provider.info.models))
    if (!model) throw new Error("no models found")
    return {
      providerID: provider.info.id,
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

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: z.string(),
      modelID: z.string(),
    }),
  )

  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: z.string(),
    }),
  )

  export const AuthError = NamedError.create(
    "ProviderAuthError",
    z.object({
      providerID: z.string(),
      message: z.string(),
    }),
  )
}
