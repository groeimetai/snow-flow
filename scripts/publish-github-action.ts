#!/usr/bin/env bun

import { $ } from "bun"

try {
  await $`git tag -d github-v1`
  await $`git push origin :refs/tags/github-v1`
} catch (e) {
  if (e instanceof Error && e.message.includes("not found")) {
    console.log("tag not found, continuing...")
  } else {
    throw e
  }
}
await $`git tag -a github-v1 -m "Update github-v1 to latest"`
await $`git push origin github-v1`
