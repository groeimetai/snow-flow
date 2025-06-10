import path from "path"
import { Global } from "../global"
import fs from "fs/promises"

export namespace AuthKeys {
  const filepath = path.join(Global.Path.data, "auth", "keys.json")

  export async function get() {
    const file = Bun.file(filepath)
    return file
      .json()
      .catch(() => ({}))
      .then((x) => x as Record<string, string>)
  }

  export async function set(key: string, value: string) {
    const file = Bun.file(filepath)
    const env = await get()
    await Bun.write(file, JSON.stringify({ ...env, [key]: value }))
    await fs.chmod(file.name!, 0o600)
  }
}
