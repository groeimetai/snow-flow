import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig } from "xdg-basedir"
import path from "path"

const app = "opencode"

const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)

export namespace Global {
  export const Path = {
    data,
    bin: path.join(data, "bin"),
    providers: path.join(config, "providers"),
    cache,
    config,
  } as const
}

await Promise.all([
  fs.mkdir(data, { recursive: true }),
  fs.mkdir(config, { recursive: true }),
  fs.mkdir(cache, { recursive: true }),
  fs.mkdir(Global.Path.providers, { recursive: true }),
])
