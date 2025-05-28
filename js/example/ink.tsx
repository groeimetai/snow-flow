import React, { useEffect, useState } from "react";
import type { Server } from "../src/server/server";
import type { Session } from "../src/session/session";
import { hc } from "hono/client";
import { createInterface, Interface } from "readline";

const client = hc<Server.App>(`http://localhost:16713`);


const session = await client.session_create.$post().then((res) => res.json());

const initial: {
  session: {
    info: {
      [sessionID: string]: Session.Info;
    };
    message: {
      [sessionID: string]: {
        [messageID: string]: Session.Message;
      };
    };
  };
} = {
  session: {
    info: {
      [session.id]: session
    },
    message: {
      [session.id]: {}
    },
  },
};

import { render, Text, Newline, useStdout, Box } from "ink";
import TextInput from "ink-text-input"

function App() {
  const [state, setState] = useState(initial)
  const [input, setInput] = useState("")

  useEffect(() => {
    fetch("http://localhost:16713/event")
      .then(stream => {
        const decoder = new TextDecoder();
        stream.body!.pipeTo(
          new WritableStream({
            write(chunk) {
              const data = decoder.decode(chunk);
              if (data.startsWith("data: ")) {
                try {
                  const event = JSON.parse(data.substring(6));
                  switch (event.type) {
                    case "storage.write":
                      const splits: string[] = event.properties.key.split("/");
                      let item = state as any;
                      for (let i = 0; i < splits.length; i++) {
                        const part = splits[i];
                        if (i === splits.length - 1) {
                          item[part] = event.properties.body;
                          continue;
                        }
                        if (!item[part]) item[part] = {};
                        item = item[part];
                      }
                  }
                  setState({ ...state })
                } catch {
                }
              }
            },
          }),
        )
      });
  }, [])


  return (
    <>
      <Text>{session.title}</Text>
      {
        Object.values(state.session.message[session.id])
          .filter(message => message.role !== "system")
          .map(message => {
            return Object.values(message.parts)
              .map((part, index) => {
                if (part.type === "text") {
                  return <Text key={`${message.id}-${index}`}>{message.role}: {part.text}</Text>
                }
                if (part.type === "tool-invocation") {
                  return <Text key={`${message.id}-${index}`}>{message.role}: {part.toolInvocation.toolName} {JSON.stringify(part.toolInvocation.args)}</Text>
                }
              })
          })
      }
      <Box gap={1} >
        <Text>Input:</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={() => {
            setInput("")
            client.session_chat.$post({
              json: {
                sessionID: session.id,
                parts: [
                  {
                    type: "text",
                    text: input,
                  },
                ],
              }
            })
          }}
        />
      </Box>
    </>
  );
};

console.clear();
render(<App />);

