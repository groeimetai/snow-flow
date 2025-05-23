import { DurableObject } from "cloudflare:workers"
import {
  DurableObjectNamespace,
  ExecutionContext,
} from "@cloudflare/workers-types"
import { createHash } from "node:crypto"
import path from "node:path"
import { Resource } from "sst"

type Bindings = {
  SYNC_SERVER: DurableObjectNamespace<WebSocketHibernationServer>
}

export class SyncServer extends DurableObject {
  private files: Map<string, string> = new Map()

  constructor(ctx, env) {
    super(ctx, env)
    this.ctx.blockConcurrencyWhile(async () => {
      this.files = await this.ctx.storage.list()
    })
  }

  async publish(key: string, content: string) {
    console.log(
      "SyncServer publish",
      key,
      content,
      "to",
      this.ctx.getWebSockets().length,
      "subscribers",
    )
    this.files.set(key, content)
    await this.ctx.storage.put(key, content)

    this.ctx.getWebSockets().forEach((client) => {
      client.send(JSON.stringify({ key, content }))
    })
  }

  async webSocketMessage(ws, message) {
    if (message === "load_history") {
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, "Durable Object is closing WebSocket")
  }

  async fetch(req: Request) {
    console.log("SyncServer subscribe")

    // Creates two ends of a WebSocket connection.
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.ctx.acceptWebSocket(server)

    setTimeout(() => {
      this.files.forEach((content, key) =>
        server.send(JSON.stringify({ key, content })),
      )
    }, 0)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url)

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Hello, world!", {
        headers: { "Content-Type": "text/plain" },
      })
    }
    if (request.method === "POST" && url.pathname.endsWith("/share_create")) {
      const body = await request.json()
      const sessionID = body.sessionID
      const shareID = createHash("sha256").update(sessionID).digest("hex")
      const infoFile = `${shareID}/session/info/${sessionID}.json`
      const ret = await Resource.Bucket.get(infoFile)
      if (ret)
        return new Response("Error: Session already sharing", { status: 400 })

      await Resource.Bucket.put(infoFile, "")

      return new Response(JSON.stringify({ shareID }), {
        headers: { "Content-Type": "application/json" },
      })
    }
    if (request.method === "POST" && url.pathname.endsWith("/share_delete")) {
      const body = await request.json()
      const sessionID = body.sessionID
      const shareID = body.shareID
      const infoFile = `${shareID}/session/info/${sessionID}.json`
      await Resource.Bucket.delete(infoFile)
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })
    }
    if (request.method === "POST" && url.pathname.endsWith("/share_sync")) {
      const body = await request.json()
      const sessionID = body.sessionID
      const shareID = body.shareID
      const key = `${body.key}.json`
      const content = body.content

      // validate key
      if (
        !key.startsWith(`session/info/${sessionID}`) &&
        !key.startsWith(`session/message/${sessionID}/`)
      )
        return new Response("Error: Invalid key", { status: 400 })

      const infoFile = `${shareID}/session/info/${sessionID}.json`
      const ret = await Resource.Bucket.get(infoFile)
      if (!ret)
        return new Response("Error: Session not shared", { status: 400 })

      // send message to server
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      await stub.publish(key, content)

      // store message
      await Resource.Bucket.put(`${shareID}/${key}`, content)

      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })
    }
    if (request.method === "GET" && url.pathname.endsWith("/share_poll")) {
      // Expect to receive a WebSocket Upgrade request.
      // If there is one, accept the request and return a WebSocket Response.
      const upgradeHeader = request.headers.get("Upgrade")
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Error: Upgrade header is required", {
          status: 426,
        })
      }

      // get query parameters
      const shareID = url.searchParams.get("shareID")
      if (!shareID)
        return new Response("Error: Share ID is required", { status: 400 })

      // Get session ID
      const listRet = await Resource.Bucket.list({
        prefix: `${shareID}/session/info/`,
        delimiter: "/",
      })

      if (listRet.objects.length === 0)
        return new Response("Error: Session not shared", { status: 400 })
      if (listRet.objects.length > 1)
        return new Response("Error: Multiple sessions found", { status: 400 })
      const sessionID = path.parse(listRet.objects[0].key).name

      // subscribe to server
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      return stub.fetch(request)
    }
  },
}
