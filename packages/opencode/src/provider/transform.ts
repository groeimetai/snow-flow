import type { CoreMessage } from "ai"

export namespace ProviderTransform {
  export function message(
    msg: CoreMessage,
    index: number,
    providerID: string,
    modelID: string,
  ) {
    if (
      (providerID === "anthropic" || modelID.includes("anthropic")) &&
      index < 4
    ) {
      msg.providerOptions = {
        ...msg.providerOptions,
        anthropic: {
          cacheControl: { type: "ephemeral" },
        },
      }
    }

    return msg
  }
}
