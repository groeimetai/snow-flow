import z from "zod";

export namespace Provider {
  export const Model = z
    .object({
      name: z.string().optional(),
      cost: z.object({
        input: z.number(),
        inputCached: z.number(),
        output: z.number(),
        outputCached: z.number(),
      }),
      contextWindow: z.number(),
      maxOutputTokens: z.number().optional(),
      attachment: z.boolean(),
      reasoning: z.boolean().optional(),
    })
    .openapi({
      ref: "Provider.Model",
    });
  export type Model = z.output<typeof Model>;

  export const Info = z
    .object({
      options: z.record(z.string(), z.any()).optional(),
      models: z.record(z.string(), Model),
    })
    .openapi({
      ref: "Provider.Info",
    });
  export type Info = z.output<typeof Info>;
}
