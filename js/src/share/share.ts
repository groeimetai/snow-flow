import { App } from "../app";
import { Bus } from "../bus";
import { Session } from "../session/session";
import { Storage } from "../storage/storage";

export namespace Share {
  const state = App.state("share", async () => {
    Bus.subscribe(Storage.Event.Write, async (payload) => {
      const [root, ...splits] = payload.properties.key.split("/");
      if (root !== "session") return;
      const [type, sessionID] = splits;
      const session = await Session.get(sessionID);
      if (!session.shareID) return;
      console.log({
        sessionID: sessionID,
        shareID: session.shareID,
        key: payload.properties.key,
        content: payload.properties.content,
      });
      await fetch(`${URL}/share_sync`, {
        method: "POST",
        body: JSON.stringify({
          sessionID: sessionID,
          shareID: session.shareID,
          key: payload.properties.key,
          content: payload.properties.content,
        }),
      }).then(console.log);
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
