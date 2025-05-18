import path from "node:path";
import { Log } from "../util/log";
import { App } from "../app";

export namespace Config {
  const log = Log.create({ service: "config" });

  // TODO: this should be zod
  export interface Info {
    mcp: any; // TODO
    lsp: any; // TODO
  }

  function state() {
    return App.service("config", async () => {
      const app = await App.use();
      let result: Info = {
        mcp: {},
        lsp: {},
      };
      for (const file of ["opencode.jsonc", "opencode.json"]) {
        const resolved = path.join(app.root, file);
        log.info("searching", { path: resolved });
        try {
          result = await import(path.join(app.root, file)).then(
            (mod) => mod.default,
          );
          log.info("found", { path: resolved });
          break;
        } catch (e) {
          continue;
        }
      }
      log.info("loaded", result);
      return result;
    });
  }

  function get() {
    return state();
  }
}
