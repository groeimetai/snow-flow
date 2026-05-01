Triage pending upstream commits from serac-labs/serac and open a PR with the cherry-picked changes.

## Context

This repo is a fork of `serac-labs/serac`. The state file `.github/upstream-sync-state.json` tracks
which upstream commits have been decided (picked/skipped/deferred). The triage CLI is at
`script/upstream-triage.ts`.

## Steps

1. **Ensure the upstream remote is configured:**
   ```
   git remote add upstream https://github.com/serac-labs/serac.git 2>/dev/null || true
   git fetch upstream main --no-tags --quiet
   ```

2. **List unresolved commits:**
   ```
   bun run script/upstream-triage.ts list
   ```
   If there are zero unresolved commits, print "Nothing to sync." and stop.

3. **Create a sync branch:**
   ```
   git checkout -b chore/upstream-sync-$(date +%Y-%m-%d)
   ```
   If a branch with that name already exists, append `-2`, `-3`, etc.

4. **Triage each unresolved commit** using `bun run script/upstream-triage.ts show <sha>` to inspect
   the diff, then apply one of the following rules:

   **Auto-skip (record with skip, no cherry-pick):**
   - Version bump commits: subject matches `chore: bump version` or `chore: bump source`
   - Regenerated files only: subject matches `chore: regenerate` or `[skip ci]`
   - Publish/release commits: subject starts with `release:` or `chore(publish)`
   - Rebrand/rename commits: subject contains `rebrand` or `rename`
   - Docs-only changes that don't affect this repo's README

   **Pick (cherry-pick onto the branch):**
   - `fix:` commits touching `packages/opencode/mcp/` (ServiceNow tool bug fixes)
   - `feat:` commits touching `packages/opencode/mcp/` (new ServiceNow tools)
   - `fix:` or `feat:` commits touching `packages/opencode/src/` core agent logic
   - Mixed commits where the core changes are substantive bug fixes or features

   **Defer (record as deferred, no cherry-pick):**
   - Anything that touches both ServiceNow tools AND UTA-specific customizations in a way that
     might conflict (inspect the diff for `snow-flow`, `uta`, `enterprise` references)
   - Large refactors touching many files where conflict risk is high
   - Anything where the intent is unclear

5. **Handle cherry-pick conflicts:**
   If `bun run script/upstream-triage.ts pick <sha>` exits non-zero, abort that cherry-pick
   (`git cherry-pick --abort`), then defer the commit instead with reason "conflict".

6. **After triaging all commits, advance the cursor:**
   ```
   bun run script/upstream-triage.ts advance
   ```

7. **Commit the state file:**
   ```
   git add .github/upstream-sync-state.json
   git commit -m "chore: upstream sync decisions $(date +%Y-%m-%d) [skip ci]"
   ```
   If there are no cherry-picks and no state changes (nothing was decided), stop and print
   "No actionable commits — all deferred or already empty."

8. **Push and open a PR:**
   ```
   git push -u origin HEAD
   ```
   Then create a PR targeting `main` with:
   - Title: `chore: upstream sync from serac-labs/serac (YYYY-MM-DD)`
   - Body: a short bullet list of what was picked and what was skipped/deferred and why.
     Keep it under 10 lines. No AI-generated walls of text.
   - Label: `upstream-sync` (create it if missing)

9. **Print a summary** of picks, skips, and defers to stdout so the Actions log is readable.
