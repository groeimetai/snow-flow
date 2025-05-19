import fs from "node:fs";
import path from "node:path";
import { AppPath } from "../app/path";
export namespace Log {
  const write = {
    out: (msg: string) => {
      process.stdout.write(msg);
    },
    err: (msg: string) => {
      process.stderr.write(msg);
    },
  };

  export function file(directory: string) {
    const out = Bun.file(
      path.join(AppPath.data(directory), "opencode.out.log"),
    );
    const err = Bun.file(
      path.join(AppPath.data(directory), "opencode.err.log"),
    );
    write["out"] = (msg) => out.write(msg);
    write["err"] = (msg) => err.write(msg);
  }

  export function create(tags?: Record<string, any>) {
    tags = tags || {};

    function build(message: any, extra?: Record<string, any>) {
      const prefix = Object.entries({
        ...tags,
        ...extra,
      })
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      return [prefix, message].join(" ") + "\n";
    }
    const result = {
      info(message?: any, extra?: Record<string, any>) {
        write.out(build(message, extra));
      },
      error(message?: any, extra?: Record<string, any>) {
        write.err(build(message, extra));
      },
      tag(key: string, value: string) {
        if (tags) tags[key] = value;
        return result;
      },
      clone() {
        return Log.create({ ...tags });
      },
    };

    return result;
  }
}
