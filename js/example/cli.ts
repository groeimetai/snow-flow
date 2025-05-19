import { hc } from "hono/client";
import type { Server } from "../src/server/server";

const message = process.argv.slice(2).join(" ");
console.log(message);

const client = hc<Server.App>(`http://localhost:16713`);
const session = await client.session_create.$post().then((res) => res.json());
const result = await client.session_chat
  .$post({
    json: {
      sessionID: session.id,
      parts: [
        {
          type: "text",
          text: message,
        },
      ],
    },
  })
  .then((res) => res.json());

for (const part of result.parts) {
  if (part.type === "text") {
    console.log(part.text);
  }
}
