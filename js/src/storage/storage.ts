import { FileStorage } from "@flystorage/file-storage";
import { LocalStorageAdapter } from "@flystorage/local-fs";
import fs from "fs/promises";
import { Log } from "../util/log";
import { App } from "../app";
import { AppPath } from "../app/path";
import { Bus } from "../bus";
import z from "zod/v4";

export namespace Storage {
  const log = Log.create({ service: "storage" });

  export const Event = {
    Write: Bus.event(
      "storage.write",
      z.object({ key: z.string(), body: z.any() }),
    ),
  };

  const state = App.state("storage", async () => {
    const app = await App.use();
    const storageDir = AppPath.storage(app.root);
    await fs.mkdir(storageDir, { recursive: true });
    const storage = new FileStorage(new LocalStorageAdapter(storageDir));
    await storage.write("test", "test");
    log.info("created", { path: storageDir });
    return {
      storage,
    };
  });

  function expose<T extends keyof FileStorage>(key: T) {
    const fn = FileStorage.prototype[key];
    return async (
      ...args: Parameters<typeof fn>
    ): Promise<ReturnType<typeof fn>> => {
      const { storage } = await state();
      const match = storage[key];
      // @ts-ignore
      return match.call(storage, ...args);
    };
  }

  export const write = expose("write");
  export const read = expose("read");
  export const list = expose("list");
  export const readToString = expose("readToString");

  export async function readJSON<T>(key: string) {
    const data = await readToString(key + ".json");
    return JSON.parse(data) as T;
  }

  export async function writeJSON<T>(key: string, data: T) {
    Bus.publish(Event.Write, { key, body: data });
    const json = JSON.stringify(data);
    await write(key + ".json", json);
  }
}
