#!/usr/bin/env bun

import { $, ShellError } from "bun"

try {
  await $`git tag -d github-v1`
  await $`git push origin :refs/tags/github-v1`
} catch (e) {
  if (e instanceof ShellError && e.stderr.toString().match(/tag \S+ not found/)) {
    console.log("tag not found, continuing...")
  } else {
    throw e
  }
}
await $`git tag -a github-v1 -m "Update github-v1 to latest"`
await $`git push origin github-v1`
