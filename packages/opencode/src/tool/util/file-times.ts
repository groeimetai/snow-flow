import { App } from "../../app/app"

export namespace FileTimes {
  export const state = App.state("tool.filetimes", () => ({
    read: new Map<string, Date>(),
    write: new Map<string, Date>(),
  }))

  export function read(filePath: string) {
    state().read.set(filePath, new Date())
  }

  export function write(filePath: string) {
    state().write.set(filePath, new Date())
  }

  export function get(filePath: string): Date | null {
    return state().read.get(filePath) || null
  }
}
