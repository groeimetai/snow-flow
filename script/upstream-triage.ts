#!/usr/bin/env bun
//
// Local triage for upstream opencode commits.
//
//   list                         show unresolved commits grouped by scope
//   show <sha>                   git show --stat <sha>
//   pick <sha>                   cherry-pick + record decision
//   mark-picked <sha> [our-sha]  record a pick you did manually
//   skip <sha> <reason...>       record skipped with reason
//   defer <sha> <reason...>      record deferred with reason
//   advance                      move cursor forward over contiguous decided range
//
// State lives in .github/upstream-sync-state.json (see workflow for schema).

import fs from "fs"
import path from "path"
import { $ } from "bun"

const STATE_PATH = path.resolve(".github/upstream-sync-state.json")

type Status = "picked" | "skipped" | "deferred"
type Decision = { status: Status; reason?: string; our_commit?: string; date: string }
type State = {
  cursor: string
  last_synced_upstream: string | null
  last_synced_at: string
  decisions: Record<string, Decision>
}

const readState = (): State => JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
const writeState = (s: State) => fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + "\n")
const today = () => new Date().toISOString().split("T")[0]
const short = (sha: string) => sha.slice(0, 9)

// CORE = packages we actually build against. Strict allowlist.
// Anything else (root config, other packages, .github, nix, infra, docs) is skip.
const CORE = /^packages\/(opencode|plugin|sdk|ui|util)\//

type Scope = "core" | "mixed" | "skip-candidate"

async function classify(sha: string): Promise<Scope> {
  const out = await $`git show --name-only --pretty=format: ${sha}`.text()
  const files = out.split("\n").filter(Boolean)
  const hasCore = files.some((f) => CORE.test(f))
  const hasSkip = files.some((f) => !CORE.test(f))
  return hasCore && hasSkip ? "mixed" : hasCore ? "core" : "skip-candidate"
}

function conventionalType(subject: string) {
  const m = subject.match(/^(feat|fix|docs|chore|refactor|test|perf|ci|build|style)(\(.+?\))?!?:/)
  return m ? m[1] : "other"
}

async function fetchUpstream() {
  await $`git fetch upstream main --no-tags --quiet`.quiet().nothrow()
}

async function unresolved(state: State) {
  const log = await $`git log --no-merges --format=%H%x1f%s ${state.cursor}..upstream/main`.text()
  return log
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, subject] = line.split("\x1f")
      return { sha, subject }
    })
    .filter((c) => !state.decisions[c.sha])
}

async function list() {
  const state = readState()
  const pending = await unresolved(state)
  if (pending.length === 0) {
    console.log("Nothing to triage.")
    return
  }
  const enriched = await Promise.all(
    pending.map(async (c) => ({ ...c, scope: await classify(c.sha), type: conventionalType(c.subject) })),
  )
  const core = enriched.filter((c) => c.scope === "core")
  const mixed = enriched.filter((c) => c.scope === "mixed")
  const skip = enriched.filter((c) => c.scope === "skip-candidate")

  console.log(`${pending.length} unresolved (cursor ${short(state.cursor)})`)
  console.log(`  core:           ${core.length}`)
  console.log(`  mixed:          ${mixed.length}`)
  console.log(`  skip-candidate: ${skip.length}\n`)

  for (const [label, commits] of [
    ["CORE", core],
    ["MIXED", mixed],
  ] as const) {
    if (commits.length === 0) continue
    console.log(`── ${label} ──`)
    for (const c of commits) console.log(`  ${short(c.sha)} [${c.type.padEnd(8)}] ${c.subject}`)
    console.log()
  }
  if (skip.length > 0) {
    console.log(`── SKIP-CANDIDATE (${skip.length}, first 20) ──`)
    for (const c of skip.slice(0, 20)) console.log(`  ${short(c.sha)} [${c.type.padEnd(8)}] ${c.subject}`)
  }
}

async function show(sha: string) {
  await $`git show --stat ${sha}`
}

async function pick(sha: string) {
  const state = readState()
  const existing = state.decisions[sha]
  if (existing) {
    console.error(`already ${existing.status}: ${short(sha)}`)
    process.exit(1)
  }
  const result = await $`git cherry-pick ${sha}`.nothrow()
  if (result.exitCode !== 0) {
    console.error("cherry-pick failed. Resolve conflicts, finish the pick, then:")
    console.error(`  bun run script/upstream-triage.ts mark-picked ${sha}`)
    process.exit(result.exitCode)
  }
  const ourSha = (await $`git rev-parse HEAD`.text()).trim()
  state.decisions[sha] = { status: "picked", our_commit: ourSha, date: today() }
  writeState(state)
  console.log(`picked ${short(sha)} → ${short(ourSha)}`)
}

async function markPicked(sha: string, ourArg?: string) {
  const state = readState()
  const ourSha = ourArg ?? (await $`git rev-parse HEAD`.text()).trim()
  state.decisions[sha] = { status: "picked", our_commit: ourSha, date: today() }
  writeState(state)
  console.log(`marked picked: ${short(sha)} → ${short(ourSha)}`)
}

function skipCmd(sha: string, reason: string) {
  const state = readState()
  state.decisions[sha] = { status: "skipped", reason, date: today() }
  writeState(state)
  console.log(`skipped ${short(sha)}: ${reason}`)
}

function defer(sha: string, reason: string) {
  const state = readState()
  state.decisions[sha] = { status: "deferred", reason, date: today() }
  writeState(state)
  console.log(`deferred ${short(sha)}: ${reason}`)
}

async function advance() {
  const state = readState()
  const log = (await $`git log --format=%H --reverse ${state.cursor}..upstream/main`.text())
    .trim()
    .split("\n")
    .filter(Boolean)
  let next = state.cursor
  for (const sha of log) {
    if (!state.decisions[sha]) break
    next = sha
  }
  if (next === state.cursor) {
    console.log("cursor unchanged")
    return
  }
  state.cursor = next
  writeState(state)
  console.log(`cursor → ${short(next)}`)
}

const usage = `commands:
  list
  show <sha>
  pick <sha>
  mark-picked <sha> [our-sha]
  skip <sha> <reason...>
  defer <sha> <reason...>
  advance`

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  await fetchUpstream()
  if (!cmd || cmd === "list") return list()
  if (cmd === "show") return show(args[0])
  if (cmd === "pick") return pick(args[0])
  if (cmd === "mark-picked") return markPicked(args[0], args[1])
  if (cmd === "skip") return skipCmd(args[0], args.slice(1).join(" "))
  if (cmd === "defer") return defer(args[0], args.slice(1).join(" "))
  if (cmd === "advance") return advance()
  console.error(`unknown command: ${cmd}\n${usage}`)
  process.exit(1)
}

main()
