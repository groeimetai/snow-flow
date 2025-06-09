import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
export namespace Log {
  const Default = create()

  export interface Options {
    print: boolean
  }

  let logpath = ""

  export function file() {
    return logpath
  }

  export async function init(options: Options) {
    const dir = path.join(Global.Path.data, "log")
    await fs.mkdir(dir, { recursive: true })
    cleanup(dir)
    if (options.print) return
    logpath = path.join(dir, new Date().toISOString().split(".")[0] + ".log")
    const logfile = Bun.file(logpath)
    await fs.truncate(logpath).catch(() => {})
    const writer = logfile.writer()
    process.stderr.write = (msg) => {
      writer.write(msg)
      writer.flush()
      return true
    }
    Default.info("initialized", { file: logpath })
  }

  async function cleanup(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map((entry) => path.join(dir, entry.name))

    if (files.length <= 10) return

    const filesToDelete = files.slice(0, -10)

    await Promise.all(
      filesToDelete.map((file) => fs.unlink(file).catch(() => {})),
    )
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
        process.stderr.write(build(message, extra))
      },
      error(message?: any, extra?: Record<string, any>) {
        process.stderr.write(build(message, extra))
      },
      warn(message?: any, extra?: Record<string, any>) {
        process.stderr.write(build(message, extra))
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
