import path from "node:path";
import { Log } from "../util/log";
import { z } from "zod/v4";

export namespace Config {
  const log = Log.create({ service: "config" });

  export const Info = z
    .object({
      providers: z
        .object({
          anthropic: z
            .object({
              apiKey: z.string().optional(),
              headers: z.record(z.string(), z.string()).optional(),
              baseURL: z.string().optional(),
            })
            .strict()
            .optional(),
        })
        .strict()
        .optional(),
    })
    .strict();

  export type Info = z.output<typeof Info>;

  export async function load(directory: string) {
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
