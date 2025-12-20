#!/usr/bin/env bun

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

import { $ } from "bun"

// Format existing generated code
await $`bun prettier --write src/gen || true`

// Clean and build
await $`rm -rf dist`
await $`bun tsc`
