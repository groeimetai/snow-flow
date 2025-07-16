#!/usr/bin/env bun

import { $ } from "bun"

await $`git tag -d v1`
await $`git push origin :refs/tags/v1`
await $`git tag -a v1 -m "Update v1 to latest"`
await $`git push origin v1`
