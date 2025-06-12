import type { StandardSchemaV1 } from "@standard-schema/spec"

export namespace Tool {
  interface Metadata {
    title: string
    [key: string]: any
  }
  export type Context = {
    sessionID: string
    messageID: string
    abort: AbortSignal
  }
  export interface Info<
    Parameters extends StandardSchemaV1 = StandardSchemaV1,
    M extends Metadata = Metadata,
  > {
    id: string
    description: string
    parameters: Parameters
    execute(
      args: StandardSchemaV1.InferOutput<Parameters>,
      ctx: Context,
    ): Promise<{
      metadata: M
      output: string
    }>
  }

  export function define<
    Parameters extends StandardSchemaV1,
    Result extends Metadata,
  >(input: Info<Parameters, Result>): Info<Parameters, Result> {
    return input
  }
}
