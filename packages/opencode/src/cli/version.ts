declare global {
  const OPENCODE_VERSION: string
}

export const VERSION =
  typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "dev"
