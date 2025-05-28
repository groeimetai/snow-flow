import z from "zod";

const ToolCall = z
  .object({
    state: z.literal("call"),
    step: z.number().optional(),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.record(z.string(), z.any()),
  })
  .openapi({
    ref: "Session.Message.ToolInvocation.ToolCall",
  });

const ToolPartialCall = z
  .object({
    state: z.literal("partial-call"),
    step: z.number().optional(),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.record(z.string(), z.any()),
  })
  .openapi({
    ref: "Session.Message.ToolInvocation.ToolPartialCall",
  });

const ToolResult = z
  .object({
    state: z.literal("result"),
    step: z.number().optional(),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.record(z.string(), z.any()),
    result: z.string(),
  })
  .openapi({
    ref: "Session.Message.ToolInvocation.ToolResult",
  });

const ToolInvocation = z
  .discriminatedUnion("state", [ToolCall, ToolPartialCall, ToolResult])
  .openapi({
    ref: "Session.Message.ToolInvocation",
  });
export type ToolInvocation = z.infer<typeof ToolInvocation>;

const TextPart = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .openapi({
    ref: "Session.Message.Part.Text",
  });

const ReasoningPart = z
  .object({
    type: z.literal("reasoning"),
    text: z.string(),
    providerMetadata: z.record(z.any()).optional(),
  })
  .openapi({
    ref: "Session.Message.Part.Reasoning",
  });

const ToolInvocationPart = z
  .object({
    type: z.literal("tool-invocation"),
    toolInvocation: ToolInvocation,
  })
  .openapi({
    ref: "Session.Message.Part.ToolInvocation",
  });

const SourceUrlPart = z
  .object({
    type: z.literal("source-url"),
    sourceId: z.string(),
    url: z.string(),
    title: z.string().optional(),
    providerMetadata: z.record(z.any()).optional(),
  })
  .openapi({
    ref: "Session.Message.Part.SourceUrl",
  });

const FilePart = z
  .object({
    type: z.literal("file"),
    mediaType: z.string(),
    filename: z.string().optional(),
    url: z.string(),
  })
  .openapi({
    ref: "Session.Message.Part.File",
  });

const StepStartPart = z
  .object({
    type: z.literal("step-start"),
  })
  .openapi({
    ref: "Session.Message.Part.StepStart",
  });

const Part = z
  .discriminatedUnion("type", [
    TextPart,
    ReasoningPart,
    ToolInvocationPart,
    SourceUrlPart,
    FilePart,
    StepStartPart,
  ])
  .openapi({
    ref: "Session.Message.Part",
  });

export const SessionMessage = z
  .object({
    id: z.string(),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(Part),
    metadata: z.object({
      time: z.object({
        created: z.number(),
        completed: z.number().optional(),
      }),
      sessionID: z.string(),
      tool: z.record(z.string(), z.any()),
    }),
  })
  .openapi({
    ref: "Session.Message",
  });
