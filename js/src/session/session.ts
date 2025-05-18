import path from "path";
import { z } from "zod";
import { App } from "../app/";
import { Identifier } from "../id/id";
import { LLM } from "../llm/llm";
import { Storage } from "../storage/storage";
import { Log } from "../util/log";
import {
  convertToModelMessages,
  streamText,
  tool,
  type TextUIPart,
  type ToolInvocationUIPart,
  type UIMessage,
} from "ai";

export namespace Session {
  const log = Log.create({ service: "session" });

  export interface Info {
    id: string;
    title: string;
  }

  const state = App.state("session", () => {
    const sessions = new Map<string, Info>();
    const messages = new Map<string, UIMessage[]>();

    return {
      sessions,
      messages,
    };
  });

  export async function create() {
    const result: Info = {
      id: Identifier.descending("session"),
      title: "New Session - " + new Date().toISOString(),
    };
    log.info("created", result);
    await Storage.write(
      "session/info/" + result.id + ".json",
      JSON.stringify(result),
    );
    state().sessions.set(result.id, result);
    return result;
  }

  export async function get(id: string) {
    const result = state().sessions.get(id);
    if (result) {
      return result;
    }
    const read = JSON.parse(await Storage.readToString("session/info/" + id));
    state().sessions.set(id, read);
    return read;
  }

  export async function messages(sessionID: string) {
    const result = state().messages.get(sessionID);
    if (result) {
      return result;
    }
    const read = JSON.parse(
      await Storage.readToString(
        "session/message/" + sessionID + ".json",
      ).catch(() => "[]"),
    );
    state().messages.set(sessionID, read);
    return read;
  }

  export async function* list() {
    try {
      const result = await Storage.list("session/info");
      for await (const item of result) {
        yield path.basename(item.path, ".json");
      }
    } catch {
      return;
    }
  }

  export async function chat(sessionID: string, msg: UIMessage) {
    const l = log.clone().tag("session", sessionID);
    l.info("chatting");
    const msgs = (await messages(sessionID)) ?? [
      {
        id: Identifier.ascending("message"),
        role: "system",
        parts: [
          {
            type: "text",
            text: "You are a helpful assistant called opencode",
          },
        ],
      } as UIMessage,
    ];
    msgs.push(msg);
    state().messages.set(sessionID, msgs);
    async function write() {
      return Storage.write(
        "session/message/" + sessionID + ".json",
        JSON.stringify(msgs),
      );
    }
    await write();

    const model = await LLM.findModel("claude-3-7-sonnet-20250219");
    const result = streamText({
      messages: convertToModelMessages(msgs),
      temperature: 0,
      tools: {
        test: tool({
          id: "opencode.test" as const,
          parameters: z.object({
            feeling: z.string(),
          }),
          execute: async () => {
            return `Hello`;
          },
          description: "call this tool to get a greeting",
        }),
      },
      model,
    });
    const next: UIMessage = {
      id: Identifier.ascending("message"),
      role: "assistant",
      parts: [],
    };
    msgs.push(next);
    let text: TextUIPart | undefined;
    const reader = result.toUIMessageStream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      l.info("part", value);
      switch (value.type) {
        case "start":
          break;
        case "start-step":
          next.parts.push({
            type: "step-start",
          });
          break;
        case "text":
          if (!text) {
            text = value;
            next.parts.push(value);
            break;
          }
          text.text += value.text;
          break;

        case "tool-call":
          next.parts.push({
            type: "tool-invocation",
            toolInvocation: {
              state: "call",
              ...value,
            },
          });
          break;

        case "tool-result":
          const match = next.parts.find(
            (p) =>
              p.type === "tool-invocation" &&
              p.toolInvocation.toolCallId === value.toolCallId,
          ) as ToolInvocationUIPart | undefined;
          if (match) {
            match.toolInvocation = {
              ...match.toolInvocation,
              state: "result",
              result: value.result,
            };
            await write();
          }
          break;

        case "finish":
          await write();
          break;
        case "finish-step":
          await write();
          break;

        default:
          l.info("unhandled", {
            type: value.type,
          });
      }
    }
  }
}
