import { App } from "../app/app"
import { Log } from "../util/log"
import { concat } from "remeda"
import path from "path"
import { Provider } from "../provider/provider"

import type { LanguageModel, Provider as ProviderInstance } from "ai"
import { NoSuchModelError } from "ai"
import { Config } from "../config/config"
import { BunProc } from "../bun"
import { Global } from "../global"

export namespace LLM {
  const log = Log.create({ service: "llm" })

  export class ModelNotFoundError extends Error {
    constructor(public readonly model: string) {
      super()
    }
  }

  const NATIVE_PROVIDERS: Provider.Info[] = [
    {
      id: "anthropic",
      name: "Anthropic",
      models: [
        {
          id: "claude-sonnet-4-20250514",
          name: "Claude Sonnet 4",
          cost: {
            input: 3.0 / 1_000_000,
            output: 15.0 / 1_000_000,
            inputCached: 3.75 / 1_000_000,
            outputCached: 0.3 / 1_000_000,
          },
          contextWindow: 200_000,
          maxOutputTokens: 50_000,
          attachment: true,
        },
      ],
    },
    {
      id: "openai",
      name: "OpenAI",
      models: [
        {
          id: "codex-mini-latest",
          name: "Codex Mini",
          cost: {
            input: 1.5 / 1_000_000,
            inputCached: 0.375 / 1_000_000,
            output: 6.0 / 1_000_000,
            outputCached: 0.0 / 1_000_000,
          },
          contextWindow: 200_000,
          maxOutputTokens: 100_000,
          attachment: true,
          reasoning: true,
        },
      ],
    },
    {
      id: "google",
      name: "Google",
      models: [
        {
          id: "gemini-2.5-pro-preview-03-25",
          name: "Gemini 2.5 Pro",
          cost: {
            input: 1.25 / 1_000_000,
            inputCached: 0 / 1_000_000,
            output: 10 / 1_000_000,
            outputCached: 0 / 1_000_000,
          },
          contextWindow: 1_000_000,
          maxOutputTokens: 50_000,
          attachment: true,
        },
      ],
    },
  ]

  const AUTODETECT: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
  }

  const state = App.state("llm", async () => {
    const config = await Config.get()
    const providers: Record<
      string,
      {
        info: Provider.Info
        instance: ProviderInstance
      }
    > = {}
    const models = new Map<
      string,
      { info: Provider.Model; instance: LanguageModel }
    >()

    const list = concat(NATIVE_PROVIDERS, config.providers ?? [])

    for (const provider of list) {
      if (
        !config.providers?.find((p) => p.id === provider.id) &&
        !AUTODETECT[provider.id]?.some((env) => process.env[env])
      )
        continue
      const dir = path.join(
        Global.cache(),
        `node_modules`,
        `@ai-sdk`,
        provider.id,
      )
      if (!(await Bun.file(path.join(dir, "package.json")).exists())) {
        BunProc.run(["add", "--exact", `@ai-sdk/${provider.id}@alpha`], {
          cwd: Global.cache(),
        })
      }
      const mod = await import(
        path.join(Global.cache(), `node_modules`, `@ai-sdk`, provider.id)
      )
      const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
      const loaded = fn(provider.options)
      log.info("loaded", { provider: provider.id })
      providers[provider.id] = {
        info: provider,
        instance: loaded,
      }
    }

    return {
      models,
      providers,
    }
  })

  export async function providers() {
    return state().then((state) => state.providers)
  }

  export async function findModel(providerID: string, modelID: string) {
    const key = `${providerID}/${modelID}`
    const s = await state()
    if (s.models.has(key)) return s.models.get(key)!
    const provider = s.providers[providerID]
    if (!provider) throw new ModelNotFoundError(modelID)
    log.info("loading", {
      providerID,
      modelID,
    })
    const info = provider.info.models.find((m) => m.id === modelID)
    if (!info) throw new ModelNotFoundError(modelID)
    try {
      const match = provider.instance.languageModel(modelID)
      log.info("found", { providerID, modelID })
      s.models.set(key, {
        info,
        instance: match,
      })
      return {
        info,
        instance: match,
      }
    } catch (e) {
      if (e instanceof NoSuchModelError) throw new ModelNotFoundError(modelID)
      throw e
    }
  }
}
