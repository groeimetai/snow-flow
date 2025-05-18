import path from "path";
import { z } from "zod/v3";
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
  type UIDataTypes,
  type UIMessage,
  type UIMessagePart,
} from "ai";

export namespace Session {
  const log = Log.create({ service: "session" });

  export interface Info {
    id: string;
    title: string;
    tokens: {
      input: number;
      output: number;
      reasoning: number;
    };
  }

  export type Message = UIMessage<{ sessionID: string }>;

  const state = App.state("session", () => {
    const sessions = new Map<string, Info>();
    const messages = new Map<string, Message[]>();

    return {
      sessions,
      messages,
    };
  });

  export async function create() {
    const result: Info = {
      id: Identifier.descending("session"),
      title: "New Session - " + new Date().toISOString(),
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
      },
    };
    log.info("created", result);
    await Storage.writeJSON("session/info/" + result.id, result);
    state().sessions.set(result.id, result);
    return result;
  }

  export async function get(id: string) {
    const result = state().sessions.get(id);
    if (result) {
      return result;
    }
    const read = await Storage.readJSON<Info>("session/info/" + id);
    state().sessions.set(id, read);
    return read as Info;
  }

  export async function update(session: Info) {
    state().sessions.set(session.id, session);
    await Storage.writeJSON("session/info/" + session.id, session);
  }

  export async function messages(sessionID: string) {
    const match = state().messages.get(sessionID);
    if (match) {
      return match;
    }
    const result = [] as Message[];
    const list = await Storage.list("session/message/" + sessionID)
      .then((x) => x.toArray())
      .catch(() => {});
    if (!list) return result;
    for (const item of list) {
      const messageID = path.basename(item.path, ".json");
      const read = await Storage.readJSON<Message>(
        "session/message/" + sessionID + "/" + messageID,
      );
      result.push(read);
    }
    state().messages.set(sessionID, result);
    return result;
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

  export async function chat(
    sessionID: string,
    ...parts: UIMessagePart<UIDataTypes>[]
  ) {
    const session = await get(sessionID);
    const l = log.clone().tag("session", sessionID);
    l.info("chatting");

    const msgs = await messages(sessionID);
    async function write(msg: Message) {
      return Storage.writeJSON(
        "session/message/" + sessionID + "/" + msg.id,
        msg,
      );
    }
    if (msgs.length === 0) {
      const system: UIMessage<{ sessionID: string }> = {
        id: Identifier.ascending("message"),
        role: "system",
        parts: [
          {
            type: "text",
            text: "You are a helpful assistant called opencode",
          },
        ],
        metadata: {
          sessionID,
        },
      };
      msgs.push(system);
      state().messages.set(sessionID, msgs);
      await write(system);
    }
    const msg: Message = {
      role: "user",
      id: Identifier.ascending("message"),
      parts,
      metadata: {
        sessionID,
      },
    };
    msgs.push(msg);
    await write(msg);

    const model = await LLM.findModel("claude-3-7-sonnet-20250219");
    const result = streamText({
      messages: convertToModelMessages(msgs),
      temperature: 0,
      model,
    });
    const next: Message = {
      id: Identifier.ascending("message"),
      role: "assistant",
      parts: [],
      metadata: {
        sessionID,
      },
    };
    msgs.push(next);
    let text: TextUIPart | undefined;
    const reader = result.toUIMessageStream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      l.info("part", {
        type: value.type,
      });
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
          }
          break;

        case "finish":
          break;
        case "finish-step":
          break;
        case "error":
          log.error("error", value);
          break;

        default:
          l.info("unhandled", {
            type: value.type,
          });
      }
      await write(next);
    }
    const usage = await result.totalUsage;
    session.tokens.input += usage.inputTokens || 0;
    session.tokens.output += usage.outputTokens || 0;
    session.tokens.reasoning += usage.reasoningTokens || 0;
    await update(session);
    return next;
  }
}
