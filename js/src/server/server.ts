import { Log } from "../util/log";

export namespace RPC {
  const log = Log.create({ service: "rpc" });
  const PORT = 16713;
  export function listen(input?: { port?: number }) {
    const port = input?.port ?? PORT;
    log.info("trying", { port });
    try {
      const server = Bun.serve({
        port,
        websocket: {
          open() {},
          message() {},
        },
        routes: {
          "/ws": (req, server) => {
            if (server.upgrade(req)) return;
            return new Response("Not a websocket request", { status: 400 });
          },
        },
      });
      log.info("listening", { port });
      return {
        server,
      };
    } catch (e: any) {
      if (e?.code === "EADDRINUSE") {
        return listen({ port: port + 1 });
      }
      throw e;
    }
  }
}
