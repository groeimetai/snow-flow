import { DurableObject } from "cloudflare:workers"
import { randomUUID } from "node:crypto"
import { Resource } from "sst"

type Bindings = {
  SYNC_SERVER: DurableObjectNamespace<SyncServer>
}

export class SyncServer extends DurableObject {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env)
  }
  async fetch() {
    console.log("SyncServer subscribe")

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.ctx.acceptWebSocket(server)

    setTimeout(async () => {
      const data = await this.ctx.storage.list({
        prefix: "data/",
      })
      for (const [key, content] of Object.entries(data)) {
        server.send(JSON.stringify({ key, content }))
      }
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

  async publish(secret: string, key: string, content: any) {
    if (secret !== (await this.getSecret())) throw new Error("Invalid secret")
    const sessionID = await this.getSessionID()
    if (
      !key.startsWith(`session/info/${sessionID}`) &&
      !key.startsWith(`session/message/${sessionID}/`)
    )
      return new Response("Error: Invalid key", { status: 400 })

    // store message
    await Resource.Bucket.put(`${key}.json`, JSON.stringify(content))
    await this.ctx.storage.put("data/" + key, content)
    const clients = this.ctx.getWebSockets()
    console.log("SyncServer publish", key, "to", clients.length, "subscribers")
    clients.forEach((client) => client.send(JSON.stringify({ key, content })))
  }

  public async share(sessionID: string) {
    let secret = await this.getSecret()
    if (secret) return secret
    secret = randomUUID()

    await this.ctx.storage.put("secret", secret)
    await this.ctx.storage.put("sessionID", sessionID)

    return secret
  }

  private async getSecret() {
    return this.ctx.storage.get<string>("secret")
  }

  private async getSessionID() {
    return this.ctx.storage.get<string>("sessionID")
  }

  async clear(secret: string) {
    await this.assertSecret(secret)
    await this.ctx.storage.deleteAll()
  }

  private async assertSecret(secret: string) {
    if (secret !== (await this.getSecret())) throw new Error("Invalid secret")
  }

  static shortName(id: string) {
    return id.substring(id.length - 8)
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
      const short = SyncServer.shortName(sessionID)
      const id = env.SYNC_SERVER.idFromName(short)
      const stub = env.SYNC_SERVER.get(id)
      const secret = await stub.share(sessionID)
      return new Response(
        JSON.stringify({
          secret,
          url: "https://dev.opencode.ai/s?id=" + short,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (request.method === "POST" && method === "share_delete") {
      const body = await request.json<any>()
      const sessionID = body.sessionID
      const secret = body.secret
      const id = env.SYNC_SERVER.idFromName(SyncServer.shortName(sessionID))
      const stub = env.SYNC_SERVER.get(id)
      await stub.clear(secret)
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (request.method === "POST" && method === "share_sync") {
      const body = await request.json<{
        sessionID: string
        secret: string
        key: string
        content: any
      }>()
      const name = SyncServer.shortName(body.sessionID)
      const id = env.SYNC_SERVER.idFromName(name)
      const stub = env.SYNC_SERVER.get(id)
      await stub.publish(body.secret, body.key, body.content)
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (request.method === "GET" && method === "share_poll") {
      const upgradeHeader = request.headers.get("Upgrade")
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Error: Upgrade header is required", {
          status: 426,
        })
      }
      const id = url.searchParams.get("id")
      if (!id)
        return new Response("Error: Share ID is required", { status: 400 })
      const stub = env.SYNC_SERVER.get(env.SYNC_SERVER.idFromName(id))
      return stub.fetch(request)
    }
  },
}
