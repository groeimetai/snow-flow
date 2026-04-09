Scaffold a new bundled skill as a `SKILL.md` file with the right frontmatter. You're creating the skeleton — the user fills in the teaching content.

## Input

`$ARGUMENTS`: the skill slug, kebab-case (e.g. `flow-designer-patterns`). If missing, ask the user.

## Steps

1. **Read the playbook first.** `.claude/playbook.md` section "Type 2: new bundled skill" covers the format, the existing example to imitate, and the style rules.

2. **Validate the slug.**
   - Must be kebab-case
   - Must not already exist: check `packages/opencode/src/bundled-skills/<slug>/` — if the directory exists, stop and tell the user.

3. **Ask the user for the minimum skill metadata:**
   - One-sentence description: "This skill should be used when the user asks to X, Y, or Z." — include the trigger phrases the user actually expects
   - `category` (default: `servicenow`)
   - `tools` array: which existing MCP tools does this skill lean on? (e.g. `snow_find_artifact`, `snow_execute_script`)
   - GitHub author handle

   Keep the asking tight — don't interrogate. Three to five questions max.

4. **Read the reference skill** `packages/opencode/src/bundled-skills/code-review/SKILL.md` to confirm the exact frontmatter shape and section structure.

5. **Scaffold** `packages/opencode/src/bundled-skills/<slug>/SKILL.md` with:
   - Frontmatter filled in from step 3
   - A title (derived from the slug, user can edit)
   - An intro paragraph with a `<!-- TODO: rewrite this in your own words -->` comment
   - 2–3 empty section headings matching the kind of content the skill will hold (section names should come from the user's description, not generic placeholders)
   - A final "Output format" section if applicable, also marked TODO

6. **Type check** (optional, low value — skills are markdown): `cd packages/opencode && bun typecheck` won't catch markdown errors, but if the skill loader has a validator, run that via `bun run validate:skills` if it exists. If no such script: skip.

7. **Report to user.**
   - The file you created
   - The TODO comments inside it
   - Reminder: trigger phrases in the frontmatter description are scanned verbatim — make them match how users actually phrase requests
   - Next step: fill in the content, then `/verify`, then `/open-pr`

## Safety gates

- **Never invent trigger phrases or descriptions.** Ask the user for exact phrases — the skill loader uses these verbatim, and wrong ones mean the skill never activates.
- **Do not write the teaching content yourself.** You're scaffolding the skeleton. The user has the domain knowledge; your job is the frame.
- **No ES6 syntax in any code examples in SKILL.md.** ServiceNow is Rhino. If the user provides ES6 examples, warn them and suggest ES5 equivalents.

## Cross-references

- `.claude/playbook.md` — Type 2 section
- `packages/opencode/src/bundled-skills/code-review/SKILL.md` — full working example
- The 70+ existing skill directories under `bundled-skills/` — browse for naming/scope inspiration

## Output format

```
Scaffolded bundled skill: <slug>

File:
  + packages/opencode/src/bundled-skills/<slug>/SKILL.md

Frontmatter set:
  name: <slug>
  description: <description-from-user>
  tools: [<tools-from-user>]

TODOs for you to fill in:
  - Intro paragraph (your words, short)
  - Section content (use code-review/SKILL.md as a structure reference)
  - Output format block if applicable

Reminder: trigger phrases in the description are scanned verbatim. Double-check
they match how users actually phrase requests.

Next: fill in the content, then /verify, then /open-pr.
```
