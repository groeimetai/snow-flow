import path from "path";
import { Log } from "../util/log";
import { z } from "zod";
import { App } from ".";

export namespace Config {
  const log = Log.create({ service: "config" });

  export const state = App.state("config", async (app) => {
    const result = await load(app.root);
    return result;
  });

  export const Model = z
    .object({
      name: z.string().optional(),
      cost: z.object({
        input: z.number(),
        inputCached: z.number(),
        output: z.number(),
        outputCached: z.number(),
      }),
      contextWindow: z.number(),
      maxTokens: z.number().optional(),
      attachment: z.boolean(),
      reasoning: z.boolean().optional(),
    })
    .openapi({
      ref: "model",
    });
  export type Model = z.output<typeof Model>;

  export const Provider = z
    .object({
      options: z.record(z.string(), z.any()).optional(),
      models: z.record(z.string(), Model),
    })
    .openapi({
      ref: "provider",
    });
  export type Provider = z.output<typeof Provider>;

  export const Info = z
    .object({
      providers: z.record(z.string(), Provider).optional(),
    })
    .strict();

  export type Info = z.output<typeof Info>;

  export function get() {
    return state();
  }

  async function load(directory: string) {
    let result: Info = {};
    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const resolved = path.join(directory, file);
      log.info("searching", { path: resolved });
      try {
        result = await import(path.join(directory, file)).then((mod) =>
          Info.parse(mod.default),
        );
        log.info("found", { path: resolved });
        break;
      } catch (e) {
        if (e instanceof z.ZodError) {
          for (const issue of e.issues) {
            log.info(issue.message);
          }
          throw e;
        }
        continue;
      }
    }
    log.info("loaded", result);
    return result;
  }
}
