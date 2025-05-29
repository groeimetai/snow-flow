import path from "path";
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
} from "ai";
import { z } from "zod";
import * as tools from "../tool";
import { Decimal } from "decimal.js";

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt";
import PROMPT_TITLE from "./prompt/title.txt";

import { Share } from "../share/share";
import { Message } from "./message";
import { Bus } from "../bus";

export namespace Session {
  const log = Log.create({ service: "session" });

  export const Info = z
    .object({
      id: Identifier.schema("session"),
      shareID: z.string().optional(),
      title: z.string(),
    })
    .openapi({
      ref: "session.info",
    });
  export type Info = z.output<typeof Info>;

  export const Event = {
    Updated: Bus.event(
      "session.updated",
      z.object({
        info: Info,
      }),
    ),
  };

  const state = App.state("session", () => {
    const sessions = new Map<string, Info>();
    const messages = new Map<string, Message.Info[]>();

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
    state().sessions.set(result.id, result);
    await Storage.writeJSON("session/info/" + result.id, result);
    await share(result.id);
    Bus.publish(Event.Updated, {
      info: result,
    });
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
    Bus.publish(Event.Updated, {
      info: session,
    });
    return session;
  }

  export async function messages(sessionID: string) {
    const match = state().messages.get(sessionID);
    if (match) {
      return match;
    }
    const result = [] as Message.Info[];
    const list = Storage.list("session/message/" + sessionID);
    for await (const p of list) {
      const read = await Storage.readJSON<Message.Info>(p);
      result.push(read);
    }
    state().messages.set(sessionID, result);
    return result;
  }

  export async function* list() {
    for await (const item of Storage.list("session/info")) {
      const sessionID = path.basename(item, ".json");
      yield get(sessionID);
    }
  }

  const pending = new Map<string, AbortController>();

  export function abort(sessionID: string) {
    const controller = pending.get(sessionID);
    if (!controller) return false;
    controller.abort();
    pending.delete(sessionID);
    return true;
  }

  export async function chat(input: {
    sessionID: string;
    providerID: string;
    modelID: string;
    parts: Message.Part[];
  }) {
    const l = log.clone().tag("session", input.sessionID);
    l.info("chatting");
    const model = await LLM.findModel(input.providerID, input.modelID);
    const msgs = await messages(input.sessionID);
    async function write(msg: Message.Info) {
      await Storage.writeJSON(
        "session/message/" + input.sessionID + "/" + msg.id,
        msg,
      );
      Bus.publish(Message.Event.Updated, {
        info: msg,
      });
    }
    const app = await App.use();
    if (msgs.length === 0) {
      const system: Message.Info = {
        id: Identifier.ascending("message"),
        role: "system",
        parts: [
          {
            type: "text",
            text: PROMPT_ANTHROPIC,
          },
        ],
        metadata: {
          sessionID: input.sessionID,
          time: {
            created: Date.now(),
          },
          tool: {},
        },
      };
      const contextFile = Bun.file(path.join(app.root, "CONTEXT.md"));
      if (await contextFile.exists()) {
        const context = await contextFile.text();
        system.parts.push({
          type: "text",
          text: context,
        });
      }
      msgs.push(system);
      state().messages.set(input.sessionID, msgs);
      generateText({
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
            parts: input.parts,
          },
        ]),
        model: model.instance,
      }).then((result) => {
        return Session.update(input.sessionID, (draft) => {
          draft.title = result.text;
        });
      });
      await write(system);
    }
    const msg: Message.Info = {
      role: "user",
      id: Identifier.ascending("message"),
      parts: input.parts,
      metadata: {
        time: {
          created: Date.now(),
        },
        sessionID: input.sessionID,
        tool: {},
      },
    };
    msgs.push(msg);
    await write(msg);

    const next: Message.Info = {
      id: Identifier.ascending("message"),
      role: "assistant",
      parts: [],
      metadata: {
        assistant: {
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
          },
          modelID: input.modelID,
          providerID: input.providerID,
        },
        time: {
          created: Date.now(),
        },
        sessionID: input.sessionID,
        tool: {},
      },
    };
    const controller = new AbortController();
    pending.set(input.sessionID, controller);
    const result = streamText({
      onStepFinish: async (step) => {
        const assistant = next.metadata!.assistant!;
        assistant.tokens.input = step.usage.inputTokens ?? 0;
        assistant.tokens.output = step.usage.outputTokens ?? 0;
        assistant.tokens.reasoning = step.usage.reasoningTokens ?? 0;
        assistant.cost = new Decimal(0)
          .add(new Decimal(assistant.tokens.input).mul(model.info.cost.input))
          .add(new Decimal(assistant.tokens.output).mul(model.info.cost.output))
          .toNumber();
        await write(next);
      },
      abortSignal: controller.signal,
      maxRetries: 6,
      stopWhen: stepCountIs(1000),
      messages: convertToModelMessages(msgs),
      temperature: 0,
      tools,
      model: model.instance,
    });

    msgs.push(next);
    let text: Message.TextPart | undefined;
    const reader = result.toUIMessageStream().getReader();
    while (true) {
      const result = await reader.read().catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        throw e;
      });
      if (!result) break;
      const { done, value } = result;
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
              // hack until zod v4
              args: value.args as any,
            },
          });
          break;

        case "tool-result":
          const match = next.parts.find(
            (p) =>
              p.type === "tool-invocation" &&
              p.toolInvocation.toolCallId === value.toolCallId,
          );
          if (match && match.type === "tool-invocation") {
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
    pending.delete(input.sessionID);
    next.metadata!.time.completed = Date.now();
    await write(next);
    return next;
  }
}
