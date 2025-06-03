import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig } from "xdg-basedir"
import path from "path"

const app = "opencode"

const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)

await Promise.all([
  fs.mkdir(data, { recursive: true }),
  fs.mkdir(config, { recursive: true }),
  fs.mkdir(cache, { recursive: true }),
])

export namespace Global {
  export const Path = {
    data,
    cache,
    config,
  } as const
}
