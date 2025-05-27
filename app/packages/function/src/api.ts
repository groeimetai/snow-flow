import { DurableObject } from "cloudflare:workers"
import { randomUUID } from "node:crypto"
import { Resource } from "sst"

type Bindings = {
  SYNC_SERVER: DurableObjectNamespace<SyncServer>
}

export class SyncServer extends DurableObject {
  async fetch(req: Request) {
    console.log("SyncServer subscribe")

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.ctx.acceptWebSocket(server)

    setTimeout(async () => {
      const data = await this.ctx.storage.list()
      data.forEach((content: any, key) => {
        if (key === "shareID") return
        server.send(JSON.stringify({ key, content: content }))
      })
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

  async publish(key: string, content: any) {
    await this.ctx.storage.put(key, content)

    const clients = this.ctx.getWebSockets()
    console.log("SyncServer publish", key, "to", clients.length, "subscribers")
    clients.forEach((client) => client.send(JSON.stringify({ key, content })))
  }

  async setShareID(shareID: string) {
    await this.ctx.storage.put("shareID", shareID)
  }

  async getShareID() {
    return this.ctx.storage.get<string>("shareID")
  }

  async clear() {
    await this.ctx.storage.deleteAll()
  }
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url)
    const splits = url.pathname.split("/")
    const method = splits[1]

    if (request.method === "GET" && method === "") {
      return new Response("Hello, world!", {
        headers: { "Content-Type": "text/plain" },
      })
    }

    if (request.method === "POST" && method === "share_create") {
      const body = await request.json<any>()
      const sessionID = body.sessionID

      // Get existing shareID
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      if (await stub.getShareID())
        return new Response("Error: Session already shared", { status: 400 })

      const shareID = randomUUID()
      await stub.setShareID(shareID)

      return new Response(JSON.stringify({ shareID }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (request.method === "POST" && method === "share_delete") {
      const body = await request.json<any>()
      const sessionID = body.sessionID
      const shareID = body.shareID

      // validate shareID
      if (!shareID)
        return new Response("Error: Share ID is required", { status: 400 })

      // Delete from durable object
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      if ((await stub.getShareID()) !== shareID)
        return new Response("Error: Share ID does not match", { status: 400 })

      await stub.clear()

      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (request.method === "POST" && method === "share_sync") {
      const body = await request.json<any>()
      const sessionID = body.sessionID
      const shareID = body.shareID
      const key = body.key
      const content = body.content

      console.log("share_sync", sessionID, shareID, key, content)

      // validate key
      if (
        !key.startsWith(`session/info/${sessionID}`) &&
        !key.startsWith(`session/message/${sessionID}/`)
      )
        return new Response("Error: Invalid key", { status: 400 })

      // validate shareID
      if (!shareID)
        return new Response("Error: Share ID is required", { status: 400 })

      // send message to server
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      if ((await stub.getShareID()) !== shareID)
        return new Response("Error: Share ID does not match", { status: 400 })

      await stub.publish(key, content)

      // store message
      await Resource.Bucket.put(
        `${shareID}/${key}.json`,
        JSON.stringify(content),
      )

      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (request.method === "GET" && method === "share_poll") {
      // Expect to receive a WebSocket Upgrade request.
      // If there is one, accept the request and return a WebSocket Response.
      const upgradeHeader = request.headers.get("Upgrade")
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Error: Upgrade header is required", {
          status: 426,
        })
      }

      // get query parameters
      const sessionID = url.searchParams.get("id")
      if (!sessionID)
        return new Response("Error: Share ID is required", { status: 400 })

      // subscribe to server
      const id = env.SYNC_SERVER.idFromName(sessionID)
      const stub = env.SYNC_SERVER.get(id)
      if (!(await stub.getShareID()))
        return new Response("Error: Session not shared", { status: 400 })

      return stub.fetch(request)
    }
  },
}
