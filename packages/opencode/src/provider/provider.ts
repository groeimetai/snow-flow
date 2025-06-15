import z from "zod"
import { App } from "../app/app"
import { Config } from "../config/config"
import { mergeDeep, sortBy } from "remeda"
import { NoSuchModelError, type LanguageModel, type Provider as SDK } from "ai"
import { Log } from "../util/log"
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
import { Auth } from "../auth"
import { TaskTool } from "../tool/task"

export namespace Provider {
  const log = Log.create({ service: "provider" })

  type CustomLoader = (
    provider: ModelsDev.Provider,
  ) => Promise<Record<string, any> | false>

  type Source = "env" | "config" | "custom" | "api"

  const CUSTOM_LOADERS: Record<string, CustomLoader> = {
    async anthropic(provider) {
      const access = await AuthAnthropic.access()
      if (!access) return false
      for (const model of Object.values(provider.models)) {
        model.cost = {
          input: 0,
          inputCached: 0,
          output: 0,
          outputCached: 0,
        }
      }
      return {
        apiKey: "",
        headers: {
          authorization: `Bearer ${access}`,
          "anthropic-beta": "oauth-2025-04-20",
        },
      }
    },
    "amazon-bedrock": async () => {
      if (!process.env["AWS_PROFILE"]) return false
      const { fromNodeProviderChain } = await import(
        await BunProc.install("@aws-sdk/credential-providers")
      )
      return {
        region: process.env["AWS_REGION"] ?? "us-east-1",
        credentialProvider: fromNodeProviderChain(),
      }
    },
  }

  const state = App.state("provider", async () => {
    const config = await Config.get()
    const database = await ModelsDev.get()

    const providers: {
      [providerID: string]: {
        source: Source
        info: ModelsDev.Provider
        options: Record<string, any>
      }
    } = {}
    const models = new Map<
      string,
      { info: ModelsDev.Model; language: LanguageModel }
    >()
    const sdk = new Map<string, SDK>()

    log.info("init")

    function mergeProvider(
      id: string,
      options: Record<string, any>,
      source: Source,
    ) {
      const provider = providers[id]
      if (!provider) {
        providers[id] = {
          source,
          info: database[id],
          options,
        }
        return
      }
      provider.options = mergeDeep(provider.options, options)
      provider.source = source
    }

    for (const [providerID, provider] of Object.entries(
      config.provider ?? {},
    )) {
      const existing = database[providerID]
      const parsed: ModelsDev.Provider = {
        id: providerID,
        name: provider.name ?? existing?.name ?? providerID,
        env: provider.env ?? existing?.env ?? [],
        models: existing?.models ?? {},
      }

      for (const [modelID, model] of Object.entries(provider.models ?? {})) {
        const existing = parsed.models[modelID]
        const parsedModel: ModelsDev.Model = {
          id: modelID,
          name: model.name ?? existing?.name ?? modelID,
          attachment: model.attachment ?? existing?.attachment ?? false,
          reasoning: model.reasoning ?? existing?.reasoning ?? false,
          temperature: model.temperature ?? existing?.temperature ?? false,
          cost: model.cost ??
            existing?.cost ?? {
              input: 0,
              output: 0,
              inputCached: 0,
              outputCached: 0,
            },
          limit: model.limit ??
            existing?.limit ?? {
              context: 0,
              output: 0,
            },
        }
        parsed.models[modelID] = parsedModel
      }
      database[providerID] = parsed
    }

    // load env
    for (const [providerID, provider] of Object.entries(database)) {
      if (provider.env.some((item) => process.env[item])) {
        mergeProvider(providerID, {}, "env")
      }
    }

    // load apikeys
    for (const [providerID, provider] of Object.entries(await Auth.all())) {
      if (provider.type === "api") {
        mergeProvider(providerID, { apiKey: provider.key }, "api")
      }
    }

    // load custom
    for (const [providerID, fn] of Object.entries(CUSTOM_LOADERS)) {
      const result = await fn(database[providerID])
      if (result) mergeProvider(providerID, result, "custom")
    }

    // load config
    for (const [providerID, provider] of Object.entries(
      config.provider ?? {},
    )) {
      mergeProvider(providerID, provider.options ?? {}, "config")
    }

    for (const providerID of Object.keys(providers)) {
      log.info("found", { providerID })
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
      using _ = log.time("getSDK", {
        providerID,
      })
      const s = await state()
      const existing = s.sdk.get(providerID)
      if (existing) return existing
      const [pkg, version] = await ModelsDev.pkg(providerID)
      const mod = await import(await BunProc.install(pkg, version))
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

    log.info("getModel", {
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

  const priority = ["gemini-2.5-pro-preview", "codex-mini", "claude-sonnet-4"]
  export function sort(models: ModelsDev.Model[]) {
    return sortBy(
      models,
      [
        (model) => priority.findIndex((filter) => model.id.includes(filter)),
        "desc",
      ],
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
    TaskTool,
    TodoReadTool,
  ]
  const TOOL_MAPPING: Record<string, Tool.Info[]> = {
    anthropic: TOOLS.filter((t) => t.id !== "opencode.patch"),
    openai: TOOLS,
    google: TOOLS,
  }
  export async function tools(providerID: string) {
    /*
    const cfg = await Config.get()
    if (cfg.tool?.provider?.[providerID])
      return cfg.tool.provider[providerID].map(
        (id) => TOOLS.find((t) => t.id === id)!,
      )
        */
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
