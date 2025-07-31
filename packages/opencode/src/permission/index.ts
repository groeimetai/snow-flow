import { App } from "../app/app"
import { z } from "zod"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { Installation } from "../installation"

export namespace Permission {
  const log = Log.create({ service: "permission" })

  export const Info = z
    .object({
      id: z.string(),
      sessionID: z.string(),
      messageID: z.string(),
      toolCallID: z.string().optional(),
      title: z.string(),
      metadata: z.record(z.any()),
      time: z.object({
        created: z.number(),
      }),
    })
    .openapi({
      ref: "Permission",
    })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: Bus.event("permission.updated", Info),
  }

  const state = App.state(
    "permission",
    () => {
      const pending: {
        [sessionID: string]: {
          [permissionID: string]: {
            info: Info
            resolve: () => void
            reject: (e: any) => void
          }
        }
      } = {}

      const approved: {
        [sessionID: string]: {
          [permissionID: string]: Info
        }
      } = {}

      return {
        pending,
        approved,
      }
    },
    async (state) => {
      for (const pending of Object.values(state.pending)) {
        for (const item of Object.values(pending)) {
          item.reject(new RejectedError(item.info.sessionID, item.info.id, item.info.toolCallID))
        }
      }
    },
  )

  export function ask(input: {
    id: Info["id"]
    sessionID: Info["sessionID"]
    messageID: Info["messageID"]
    toolCallID?: Info["toolCallID"]
    title: Info["title"]
    metadata: Info["metadata"]
  }) {
    // TODO: dax, remove this when you're happy with permissions
    if (!Installation.isDev()) return

    const { pending, approved } = state()
    log.info("asking", {
      sessionID: input.sessionID,
      permissionID: input.id,
      messageID: input.messageID,
      toolCallID: input.toolCallID,
    })
    if (approved[input.sessionID]?.[input.id]) {
      log.info("previously approved", {
        sessionID: input.sessionID,
        permissionID: input.id,
        messageID: input.messageID,
        toolCallID: input.toolCallID,
      })
      return
    }
    const info: Info = {
      id: input.id,
      sessionID: input.sessionID,
      messageID: input.messageID,
      toolCallID: input.toolCallID,
      title: input.title,
      metadata: input.metadata,
      time: {
        created: Date.now(),
      },
    }
    pending[input.sessionID] = pending[input.sessionID] || {}
    return new Promise<void>((resolve, reject) => {
      pending[input.sessionID][input.id] = {
        info,
        resolve,
        reject,
      }
      // setTimeout(() => {
      //   respond({
      //     sessionID: input.sessionID,
      //     permissionID: input.id,
      //     response: "always",
      //   })
      // }, 1000)
      Bus.publish(Event.Updated, info)
    })
  }

  export const Response = z.enum(["once", "always", "reject"])
  export type Response = z.infer<typeof Response>

  export function respond(input: { sessionID: Info["sessionID"]; permissionID: Info["id"]; response: Response }) {
    log.info("response", input)
    const { pending, approved } = state()
    const match = pending[input.sessionID]?.[input.permissionID]
    if (!match) return
    delete pending[input.sessionID][input.permissionID]
    if (input.response === "reject") {
      match.reject(new RejectedError(input.sessionID, input.permissionID, match.info.toolCallID))
      return
    }
    match.resolve()
    if (input.response === "always") {
      approved[input.sessionID] = approved[input.sessionID] || {}
      approved[input.sessionID][input.permissionID] = match.info
    }
  }

  export class RejectedError extends Error {
    constructor(
      public readonly sessionID: string,
      public readonly permissionID: string,
      public readonly toolCallID?: string,
    ) {
      super(`The user rejected permission to use this functionality`)
    }
  }
}
