import { FileStorage } from "@flystorage/file-storage";
import { LocalStorageAdapter } from "@flystorage/local-fs";
import fs from "fs/promises";
import { Log } from "../util/log";
import { App } from "../app";
import { AppPath } from "../app/path";

export namespace Storage {
  const log = Log.create({ service: "storage" });

  function state() {
    return App.service("storage", async () => {
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
  }

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
}
