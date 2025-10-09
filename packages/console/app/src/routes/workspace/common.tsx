import { Resource } from "@opencode-ai/console-resource"
import { Actor } from "@opencode-ai/console-core/actor.js"
import { query } from "@solidjs/router"
import { withActor } from "~/context/auth.withActor"

export const querySessionInfo = query(async (workspaceID: string) => {
  "use server"
  return withActor(() => {
    return {
      isAdmin: Actor.userRole() === "admin",
      isBeta: Resource.App.stage === "production" ? workspaceID === "wrk_01K46JDFR0E75SG2Q8K172KF3Y" : true,
    }
  }, workspaceID)
}, "session.get")
