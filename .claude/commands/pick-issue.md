Fetch a specific GitHub issue, read the relevant code, and propose an approach — without changing anything until the user confirms.

## Input

`$ARGUMENTS`: the issue number (e.g. `1234`). If missing, list 5 open `help wanted` or `good first issue` labelled issues via `gh issue list` and ask the user to pick one.

## Steps

1. **Fetch the issue** via `gh issue view $ARGUMENTS --json number,title,state,labels,body,comments`. If the issue is closed: tell the user and stop unless they explicitly want to continue.

2. **Summarize the issue in one short paragraph.** In your own words. Do not paste the issue body verbatim, and do not expand it into a wall of text. If the issue is vague or under-specified, say so — don't pretend you understand.

3. **Identify the contribution type** by reading `.claude/playbook.md`:
   - Is this a new ServiceNow tool? → Type 1 playbook
   - A new bundled skill? → Type 2
   - Provider / UI / core feature? → Type 3 (needs design review before coding!)
   - Bug fix? → Type 4
   - Perf? → Type 5
   - Docs? → Type 6

   If the issue doesn't fit any type clearly, flag it and ask the user for direction.

4. **Read the relevant code.** Based on the type and the issue body, identify the 2–4 files that would need to change. Read them. Don't skim — understand why the existing code is written the way it is.

5. **Propose an approach.** Present to the user:
   - One-paragraph summary of the issue (your words)
   - Contribution type and the matching playbook section
   - Files you expect to touch, with line numbers where relevant
   - Concrete plan: 3–6 bullets of what you'd do
   - Risks: what could break, what assumptions you're making
   - Verification plan: how you'd test it (which tests, which manual steps)
   - Any open questions you can't answer from reading the code alone

6. **Wait for user confirmation.** Do not start editing files until the user says go. If they say "go", proceed to implement — but **do not** run `/open-pr` automatically. That's a separate explicit step.

## Safety gates

- If the issue type is "Type 3" (provider / UI / core feature), warn the user that per CONTRIBUTING.md this requires design review **before** writing a PR. Ask them whether a maintainer has already approved the approach. If not, the correct action is to comment on the issue and wait, not to code.
- Do not edit files in step 4. Read only.
- Do not assume context from the issue title alone. Read the body and recent comments too.
- If the issue has been assigned to someone else (check `assignees` in the gh output), tell the user and suggest they comment on the issue to coordinate before duplicating work.

## Cross-references

- `.claude/playbook.md` — per contribution type: where files live, examples, tests, PR conventions
- `CONTRIBUTING.md` — the Issue-First Policy, PR expectations, style guide
- `AGENTS.md` — code style guide

## Output format

Short. Use the structure in step 5. No decorative headers, no preamble. If the plan is one line, write one line.
