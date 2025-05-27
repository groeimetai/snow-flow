import { App } from "../app";
import { Bus } from "../bus";
import { Session } from "../session/session";
import { Storage } from "../storage/storage";
import { Log } from "../util/log";

export namespace Share {
  const log = Log.create({ service: "share" });

  let queue: Promise<void> = Promise.resolve();
  const pending = new Map<string, any>();

  const state = App.state("share", async () => {
    Bus.subscribe(Storage.Event.Write, async (payload) => {
      const [root, ...splits] = payload.properties.key.split("/");
      if (root !== "session") return;
      const [, sessionID] = splits;
      const session = await Session.get(sessionID);
      if (!session.shareID) return;

      const key = payload.properties.key;
      pending.set(key, payload.properties.content);

      queue = queue
        .then(async () => {
          const content = pending.get(key);
          if (content === undefined) return;
          pending.delete(key);

          return fetch(`${URL}/share_sync`, {
            method: "POST",
            body: JSON.stringify({
              sessionID: sessionID,
              shareID: session.shareID,
              key: key,
              content: JSON.stringify(content),
            }),
          });
        })
        .then((x) => {
          if (x) {
            log.info("synced", {
              key: key,
              status: x.status,
            });
          }
        });
    });
  });

  export async function init() {
    await state();
  }

  export const URL =
    process.env["OPENCODE_API"] ?? "https://api.dev.opencode.ai";

  export async function create(sessionID: string) {
    return fetch(`${URL}/share_create`, {
      method: "POST",
      body: JSON.stringify({ sessionID: sessionID }),
    })
      .then((x) => x.json())
      .then((x) => x.shareID);
  }
}
