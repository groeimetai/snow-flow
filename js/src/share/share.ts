import { App } from "../app";
import { Bus } from "../bus";
import { Session } from "../session/session";
import { Storage } from "../storage/storage";
import { Log } from "../util/log";

export namespace Share {
  const log = Log.create({ service: "share" });

  let queue: Promise<void> = Promise.resolve();

  const state = App.state("share", async () => {
    Bus.subscribe(Storage.Event.Write, async (payload) => {
      const [root, ...splits] = payload.properties.key.split("/");
      if (root !== "session") return;
      const [, sessionID] = splits;
      const session = await Session.get(sessionID);
      if (!session.shareID) return;

      queue = queue
        .then(() =>
          fetch(`${URL}/share_sync`, {
            method: "POST",
            body: JSON.stringify({
              sessionID: sessionID,
              shareID: session.shareID,
              key: payload.properties.key,
              content: JSON.stringify(payload.properties.content),
            }),
          }),
        )
        .then((x) => {
          log.info("synced", {
            key: payload.properties.key,
            status: x.status,
          });
        });
    });
  });

  export async function init() {
    await state();
  }

  const URL = "https://api.dev.opencode.ai";
  export async function create(sessionID: string) {
    return fetch(`${URL}/share_create`, {
      method: "POST",
      body: JSON.stringify({ sessionID: sessionID }),
    })
      .then((x) => x.json())
      .then((x) => x.shareID);
  }
}
