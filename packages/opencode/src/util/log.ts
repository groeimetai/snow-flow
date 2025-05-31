import path from "path"
import { AppPath } from "../app/path"
import fs from "fs/promises"
export namespace Log {
  const write = {
    out: (msg: string) => {
      process.stdout.write(msg)
    },
    err: (msg: string) => {
      process.stderr.write(msg)
    },
  }

  export async function file(directory: string) {
    const outPath = path.join(AppPath.data(directory), "opencode.out.log")
    const errPath = path.join(AppPath.data(directory), "opencode.err.log")
    await fs.truncate(outPath).catch(() => {})
    await fs.truncate(errPath).catch(() => {})
    const out = Bun.file(outPath)
    const err = Bun.file(errPath)
    const outWriter = out.writer()
    const errWriter = err.writer()
    write["out"] = (msg) => {
      outWriter.write(msg)
      outWriter.flush()
    }
    write["err"] = (msg) => {
      errWriter.write(msg)
      errWriter.flush()
    }
  }

  export function create(tags?: Record<string, any>) {
    tags = tags || {}

    function build(message: any, extra?: Record<string, any>) {
      const prefix = Object.entries({
        ...tags,
        ...extra,
      })
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ")
      return (
        [new Date().toISOString(), prefix, message].filter(Boolean).join(" ") +
        "\n"
      )
    }
    const result = {
      info(message?: any, extra?: Record<string, any>) {
        write.out(build(message, extra))
      },
      error(message?: any, extra?: Record<string, any>) {
        write.err(build(message, extra))
      },
      warn(message?: any, extra?: Record<string, any>) {
        write.err(build(message, extra))
      },
      tag(key: string, value: string) {
        if (tags) tags[key] = value
        return result
      },
      clone() {
        return Log.create({ ...tags })
      },
    }

    return result
  }
}
