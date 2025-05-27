import path from "node:path";
import { App } from "../app/";
import { Identifier } from "../id/id";
import { LLM } from "../llm/llm";
import { Storage } from "../storage/storage";
import { Log } from "../util/log";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  type TextUIPart,
  type ToolInvocationUIPart,
  type UIDataTypes,
  type UIMessage,
  type UIMessagePart,
} from "ai";
import { z } from "zod";
import * as tools from "../tool";

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt";
import PROMPT_TITLE from "./prompt/title.txt";

import type { Tool } from "../tool/tool";
import { Share } from "../share/share";

export namespace Session {
  const log = Log.create({ service: "session" });

  export const Info = z.object({
    id: Identifier.schema("session"),
    shareID: z.string().optional(),
    title: z.string(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
    }),
  });
  export type Info = z.output<typeof Info>;

  export type Message = UIMessage<{
    time: {
      created: number;
    };
    sessionID: string;
    tool: Record<string, Tool.Metadata>;
  }>;

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

  export async function share(id: string) {
    const session = await get(id);
    if (session.shareID) return session.shareID;
    const shareID = await Share.create(id);
    if (!shareID) return;
    await update(id, (draft) => {
      draft.shareID = shareID;
    });
    return shareID as string;
  }

  export async function update(id: string, editor: (session: Info) => void) {
    const { sessions } = state();
    const session = await get(id);
    if (!session) return;
    editor(session);
    sessions.set(id, session);
    await Storage.writeJSON("session/info/" + id, session);
    return session;
  }

  export async function messages(sessionID: string) {
    const match = state().messages.get(sessionID);
    if (match) {
      return match;
    }
    const result = [] as Message[];
    const list = Storage.list("session/message/" + sessionID);
    for await (const p of list) {
      const read = await Storage.readJSON<Message>(p);
      result.push(read);
    }
    state().messages.set(sessionID, result);
    return result;
  }

  export async function* list() {
    for await (const item of Storage.list("session/info")) {
      yield path.basename(item, ".json");
    }
  }

  export async function chat(
    sessionID: string,
    ...parts: UIMessagePart<UIDataTypes>[]
  ) {
    const model = await LLM.findModel("claude-sonnet-4-20250514");
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
      const system: Message = {
        id: Identifier.ascending("message"),
        role: "system",
        parts: [
          {
            type: "text",
            text: PROMPT_ANTHROPIC,
          },
        ],
        metadata: {
          sessionID,
          time: {
            created: Date.now(),
          },
          tool: {},
        },
      };
      msgs.push(system);
      state().messages.set(sessionID, msgs);
      generateText({
        onStepFinish: (step) => {
          update(sessionID, (draft) => {
            draft.tokens.input += step.usage.inputTokens || 0;
            draft.tokens.output += step.usage.outputTokens || 0;
            draft.tokens.reasoning += step.usage.reasoningTokens || 0;
          });
        },
        messages: convertToModelMessages([
          {
            role: "system",
            parts: [
              {
                type: "text",
                text: PROMPT_TITLE,
              },
            ],
          },
          {
            role: "user",
            parts,
          },
        ]),
        model,
      }).then((result) => {
        return Session.update(sessionID, (draft) => {
          draft.title = result.text;
        });
      });
      await write(system);
    }
    const msg: Message = {
      role: "user",
      id: Identifier.ascending("message"),
      parts,
      metadata: {
        time: {
          created: Date.now(),
        },
        sessionID,
        tool: {},
      },
    };
    msgs.push(msg);
    await write(msg);

    const result = streamText({
      stopWhen: stepCountIs(1000),
      messages: convertToModelMessages(msgs),
      temperature: 0,
      tools,
      model,
    });
    const next: Message = {
      id: Identifier.ascending("message"),
      role: "assistant",
      parts: [],
      metadata: {
        time: {
          created: Date.now(),
        },
        sessionID,
        tool: {},
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
          text = undefined;
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
            const { output, metadata } = value.result as any;
            next.metadata!.tool[value.toolCallId] = metadata;
            match.toolInvocation = {
              ...match.toolInvocation,
              state: "result",
              result: output,
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
    return next;
  }
}
