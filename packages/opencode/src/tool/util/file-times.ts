import { App } from "../../app/app"

export namespace FileTimes {
  export const state = App.state("tool.filetimes", () => {
    const read: {
      [sessionID: string]: {
        [path: string]: Date | undefined
      }
    } = {}
    return {
      read,
    }
  })

  export function read(sessionID: string, file: string) {
    const { read } = state()
    read[sessionID] = read[sessionID] || {}
    read[sessionID][file] = new Date()
  }

  export function get(sessionID: string, file: string) {
    return state().read[sessionID]?.[file]
  }
}
