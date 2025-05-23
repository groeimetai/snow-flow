import fs from "fs/promises";
import { AppPath } from "./path";
import { Log } from "../util/log";
import { Context } from "../util/context";
import { Config } from "./config";
import { Share } from "../share/share";

export namespace App {
  const log = Log.create({ service: "app" });

  export type Info = Awaited<ReturnType<typeof create>>;

  const ctx = Context.create<Info>("app");

  async function create(input: { directory: string }) {
    const dataDir = AppPath.data(input.directory);
    await fs.mkdir(dataDir, { recursive: true });
    await Log.file(input.directory);

    log.info("creating");

    const config = await Config.load(input.directory);

    log.info("created", { path: dataDir });

    const services = new Map<any, any>();

    const result = {
      get services() {
        return services;
      },
      get config() {
        return config;
      },
      get root() {
        return input.directory;
      },
      service<T extends (app: any) => any>(service: any, init: T) {},
    };

    return result;
  }

  export function state<T extends (app: Info) => any>(key: any, init: T) {
    return () => {
      const app = ctx.use();
      const services = app.services;
      if (!services.has(key)) {
        log.info("registering service", { name: key });
        services.set(key, init(app));
      }
      return services.get(key) as ReturnType<T>;
    };
  }

  export async function use() {
    return ctx.use();
  }

  export async function provide<T extends (app: Info) => any>(
    input: { directory: string },
    cb: T,
  ) {
    const app = await create(input);

    return ctx.provide(app, async () => {
      return cb(app);
    });
  }
}
