#!/usr/bin/env bun

// import { Script } from "@opencode-ai/script"
import { $ } from "bun"

// if (!Script.preview) {
// await $`gh release edit v${Script.version} --draft=false`
// }

await $`bun install`

await $`gh release download --pattern "snow-code-linux-*64.tar.gz" --pattern "snow-code-darwin-*64.zip" -D dist`

await import(`../packages/opencode/script/publish-registries.ts`)
