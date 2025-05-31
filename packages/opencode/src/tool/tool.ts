import type { StandardSchemaV1 } from "@standard-schema/spec"

export namespace Tool {
  export interface Info<
    Parameters extends StandardSchemaV1 = StandardSchemaV1,
    Metadata extends Record<string, any> = Record<string, any>,
  > {
    id: string
    description: string
    parameters: Parameters
    execute(args: StandardSchemaV1.InferOutput<Parameters>): Promise<{
      metadata: Metadata
      output: string
    }>
  }

  export function define<
    Parameters extends StandardSchemaV1,
    Result extends Record<string, any>,
  >(input: Info<Parameters, Result>): Info<Parameters, Result> {
    return input
  }
}
