import fs from "fs/promises";
import { AppPath } from "./path";
import { Log } from "../util/log";
import { Context } from "../util/context";

export namespace App {
  const log = Log.create({ service: "app" });

  export type Info = Awaited<ReturnType<typeof create>>;

  const ctx = Context.create<Info>("app");

  export async function create(input: { directory: string }) {
    log.info("creating");

    const dataDir = AppPath.data(input.directory);
    await fs.mkdir(dataDir, { recursive: true });
    log.info("created", { path: dataDir });

    const services = new Map<any, any>();

    return {
      get root() {
        return input.directory;
      },
      service<T extends () => any>(service: any, init: T) {
        if (!services.has(service)) {
          log.info("registering service", { name: service });
          services.set(service, init());
        }
        return services.get(service) as ReturnType<T>;
      },
    };
  }

  export function service<T extends () => any>(key: any, init: T) {
    const app = ctx.use();
    return app.service(key, init);
  }

  export async function use() {
    return ctx.use();
  }

  export const provide = ctx.provide;
}
