import { App } from "../app";
import { Log } from "../util/log";

import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel, Provider } from "ai";
import { generateText, NoSuchModelError } from "ai";

export namespace LLM {
  const log = Log.create({ service: "llm" });

  export class ModelNotFoundError extends Error {
    constructor(public readonly model: string) {
      super();
    }
  }

  const state = App.state("llm", async (app) => {
    const providers: Provider[] = [];

    if (process.env["ANTHROPIC_API_KEY"] || app.config.providers?.anthropic) {
      log.info("loaded anthropic");
      const provider = createAnthropic({
        apiKey: app.config.providers?.anthropic?.apiKey,
        baseURL: app.config.providers?.anthropic?.baseURL,
        headers: app.config.providers?.anthropic?.headers,
      });
      providers.push(provider);
    }

    return {
      models: new Map<string, LanguageModel>(),
      providers,
    };
  });

  export async function providers() {
    return state().then((state) => state.providers);
  }

  export async function findModel(model: string) {
    const s = await state();
    if (s.models.has(model)) {
      return s.models.get(model)!;
    }
    log.info("loading", { model });
    for (const provider of s.providers) {
      try {
        const match = provider.languageModel(model);
        log.info("found", { model });
        s.models.set(model, match);
        return match;
      } catch (e) {
        if (e instanceof NoSuchModelError) continue;
        throw e;
      }
    }
    throw new ModelNotFoundError(model);
  }
}
