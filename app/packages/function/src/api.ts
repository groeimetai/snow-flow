import { DurableObject } from "cloudflare:workers"
import { randomUUID } from "node:crypto"
import { Resource } from "sst"

type Bindings = {
  SYNC_SERVER: DurableObjectNamespace
}

export class SyncServer extends DurableObject {
  private files: Map<string, string> = new Map()
  private shareID?: string

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env)
    this.ctx.blockConcurrencyWhile(async () => {
      this.files = await this.ctx.storage.list()
    })
  }

  async fetch(req: Request) {
    console.log("SyncServer subscribe")

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

  async webSocketMessage(ws, message) {}

  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, "Durable Object is closing WebSocket")
  }

  async publish(key: string, content: string) {
    this.files.set(key, content)
    await this.ctx.storage.put(key, content)

    const clients = this.ctx.getWebSockets()
    console.log("SyncServer publish", key, "to", clients.length, "subscribers")
    clients.forEach((client) => client.send(JSON.stringify({ key, content })))
  }

  async setShareID(shareID: string) {
    this.shareID = shareID
  }

  async getShareID() {
    return this.shareID
  }

  async clear() {
    await this.ctx.storage.deleteAll()
    this.files.clear()
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

      // Get existing shareID
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      let shareID = await stub.getShareID()
      if (!shareID) {
        shareID = randomUUID()
        await stub.setShareID(shareID)
      }

      // Store session ID
      await Resource.Bucket.put(`${shareID}/session/id`, sessionID)

      return new Response(JSON.stringify({ shareID }), {
        headers: { "Content-Type": "application/json" },
      })
    }
    if (request.method === "POST" && url.pathname.endsWith("/share_delete")) {
      const body = await request.json()
      const sessionID = body.sessionID
      const shareID = body.shareID

      // Delete from bucket
      await Resource.Bucket.delete(`${shareID}/session/id`)

      // Delete from durable object
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      await stub.clear()

      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })
    }
    if (request.method === "POST" && url.pathname.endsWith("/share_sync")) {
      const body = await request.json()
      const sessionID = body.sessionID
      const shareID = body.shareID
      const key = body.key
      const content = body.content

      // validate key
      if (
        !key.startsWith(`session/info/${sessionID}`) &&
        !key.startsWith(`session/message/${sessionID}/`)
      )
        return new Response("Error: Invalid key", { status: 400 })

      const ret = await Resource.Bucket.get(`${shareID}/session/id`)
      if (!ret)
        return new Response("Error: Session not shared", { status: 400 })

      // send message to server
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      await stub.publish(key, content)

      // store message
      await Resource.Bucket.put(`${shareID}/${key}.json`, content)

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
      const sessionID = await Resource.Bucket.get(`${shareID}/session/id`).then(
        (res) => res?.text(),
      )
      console.log("sessionID", sessionID)
      if (!sessionID)
        return new Response("Error: Session not shared", { status: 400 })

      // subscribe to server
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      return stub.fetch(request)
    }
  },
}
