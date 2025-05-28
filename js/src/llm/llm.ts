import { App } from "../app";
import { Log } from "../util/log";
import { mergeDeep } from "remeda";
import path from "node:path";

import type { LanguageModel, Provider } from "ai";
import { NoSuchModelError } from "ai";
import type { Config } from "../app/config";
import { BunProc } from "../bun";
import { Global } from "../global";

export namespace LLM {
  const log = Log.create({ service: "llm" });

  export class ModelNotFoundError extends Error {
    constructor(public readonly model: string) {
      super();
    }
  }

  const NATIVE_PROVIDERS: Record<string, Config.Provider> = {
    anthropic: {
      models: {
        "claude-sonnet-4-20250514": {
          name: "Claude 4 Sonnet",
          cost: {
            input: 3.0 / 1_000_000,
            inputCached: 3.75 / 1_000_000,
            output: 15.0 / 1_000_000,
            outputCached: 0.3 / 1_000_000,
          },
          contextWindow: 200000,
          maxTokens: 50000,
          attachment: true,
        },
      },
    },
    openai: {
      models: {
        "codex-mini-latest": {
          name: "Codex Mini",
          cost: {
            input: 1.5 / 1_000_000,
            inputCached: 0.375 / 1_000_000,
            output: 6.0 / 1_000_000,
            outputCached: 0.0 / 1_000_000,
          },
          contextWindow: 200000,
          maxTokens: 100000,
          attachment: true,
          reasoning: true,
        },
      },
    },
    google: {
      models: {
        "gemini-2.5-pro-preview-03-25": {
          name: "Gemini 2.5 Pro",
          cost: {
            input: 1.25 / 1_000_000,
            inputCached: 0 / 1_000_000,
            output: 10 / 1_000_000,
            outputCached: 0 / 1_000_000,
          },
          contextWindow: 1000000,
          maxTokens: 50000,
          attachment: true,
        },
      },
    },
  };

  const AUTODETECT: Record<string, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    google: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  };

  const state = App.state("llm", async (app) => {
    const providers: Record<
      string,
      {
        info: Config.Provider;
        instance: Provider;
      }
    > = {};
    const models = new Map<
      string,
      { info: Config.Model; instance: LanguageModel }
    >();

    const list = mergeDeep(NATIVE_PROVIDERS, app.config.providers ?? {});

    for (const [providerID, providerInfo] of Object.entries(list)) {
      if (
        !app.config.providers?.[providerID] &&
        !AUTODETECT[providerID]?.some((env) => process.env[env])
      )
        continue;
      const dir = path.join(
        Global.cache(),
        `node_modules`,
        `@ai-sdk`,
        providerID,
      );
      if (!(await Bun.file(path.join(dir, "package.json")).exists())) {
        BunProc.run(["add", "--exact", `@ai-sdk/${providerID}@alpha`], {
          cwd: Global.cache(),
        });
      }
      const mod = await import(
        path.join(Global.cache(), `node_modules`, `@ai-sdk`, providerID)
      );
      const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!];
      const loaded = fn(providerInfo.options);
      log.info("loaded", { provider: providerID });
      providers[providerID] = {
        info: providerInfo,
        instance: loaded,
      };
    }

    return {
      models,
      providers,
    };
  });

  export async function providers() {
    return state().then((state) => state.providers);
  }

  export async function findModel(providerID: string, modelID: string) {
    const key = `${providerID}/${modelID}`;
    const s = await state();
    if (s.models.has(key)) return s.models.get(key)!;
    const provider = s.providers[providerID];
    if (!provider) throw new ModelNotFoundError(modelID);
    log.info("loading", {
      providerID,
      modelID,
    });
    const info = provider.info.models[modelID];
    if (!info) throw new ModelNotFoundError(modelID);
    try {
      const match = provider.instance.languageModel(modelID);
      log.info("found", { providerID, modelID });
      s.models.set(key, {
        info,
        instance: match,
      });
      return {
        info,
        instance: match,
      };
    } catch (e) {
      if (e instanceof NoSuchModelError) throw new ModelNotFoundError(modelID);
      throw e;
    }
  }
}
