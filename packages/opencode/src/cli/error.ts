import { Config } from "../config/config"

export function FormatError(input: unknown) {
  if (Config.JsonError.isInstance(input))
    return `Config file at ${input.data.path} is not valid JSON`
  if (Config.InvalidError.isInstance(input))
    return [
      `Config file at ${input.data.path} is invalid`,
      ...(input.data.issues?.map(
        (issue) => "↳ " + issue.message + " " + issue.path.join("."),
      ) ?? []),
    ].join("\n")
}
