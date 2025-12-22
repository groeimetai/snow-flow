# Skills Implementatieplan voor Snow-Flow

> **Status**: Gepland (na migratie) - **OPTIONELE ENTERPRISE ENHANCEMENT**
> **Datum**: 2024-12-22
> **Prioriteit**: Low (huidige aanpak werkt goed)
> **Geschatte effort**: 2-3 dagen development
> **Bron**: [Agent Skills Open Standard](https://agentskills.io)

---

## Executive Summary

Dit plan beschrijft hoe we het **Agent Skills open standaard** kunnen implementeren in snow-flow als **optionele enterprise enhancement**. Skills zijn **geen fine-tuning** maar portable, version-controlled packages die agent capabilities uitbreiden.

**Validatie**: Dit plan is gevalideerd tegen de officiële specificatie op agentskills.io (december 2024).

---

## ⚠️ Belangrijke Nuance: Skills vs. Huidige Aanpak

### Huidige Situatie (werkt goed!)

| Component | Hoe het werkt | Token Impact |
|-----------|---------------|--------------|
| **CLAUDE.md** | Altijd geladen in system prompt | ~15-20K tokens |
| **MCP Tool Discovery** | 410+ tools automatisch beschikbaar | ~5K tokens |
| **Totaal** | Alles altijd beschikbaar | ~20-25K tokens |

### Waarom Skills NIET noodzakelijk zijn voor snow-flow

1. **ServiceNow context is ALTIJD relevant** - ES5 rules, Update Sets, Widget coherence moeten altijd actief zijn
2. **MCP tools zijn de echte waarde** - 410+ tools, niet de prompt instructies
3. **CLAUDE.md werkt** - Bewezen effectief in productie
4. **Geen matching risico** - Geen kans dat kritieke instructies niet laden

### Wanneer Skills WEL waardevol worden

| Scenario | Waarom Skills Beter |
|----------|---------------------|
| **Enterprise klanten** | Custom skills per klant/team |
| **Multi-platform** | ServiceNow + Jira + Azure DevOps skills |
| **Zeer grote knowledge base** | >50K tokens aan instructies |
| **Team-specifieke workflows** | HR team vs IT team vs Security team |
| **Skill marketplace** | Verkopen/delen van expertise packages |

### Aanbevolen Hybrid Approach

```
CLAUDE.md              → Core rules (ALTIJD geladen)
                         - ES5 compliance
                         - Update Set workflow
                         - Application scope management
                         - Widget coherence basics

.snowcode/skill/       → Geavanceerde patterns (ON-DEMAND)
                         - cmdb-complex-queries/
                         - transform-map-patterns/
                         - rest-oauth-flows/
                         - enterprise-customer-x/
```

---

## Wat zijn Skills? (Officiële Definitie)

> "Skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently."
> — agentskills.io

### Core Benefits (volgens spec)
1. **Procedural knowledge** - Domein-specifieke expertise
2. **Context** - Company-, team-, en user-specifieke kennis
3. **Reusability** - Werkt across meerdere agent products
4. **Auditability** - Consistente, controleerbare workflows

### Verschil met bestaande concepten

| Concept | Invocatie | Gebruik |
|---------|-----------|---------|
| **Commands** | User (`/release`) | Taken uitvoeren |
| **Agents** | Model/User | Gedrag aanpassen |
| **Skills** (nieuw) | Model (automatisch) | Domeinkennis injecteren |


---

## Waarom Skills voor Snow-Fode?

### Toegevoegde Waarde

1. **410+ MCP Tools** - Skills helpen het model de juiste tool te kiezen
2. **ServiceNow Complexiteit** - Applicaties, Update Sets, Widget coherence, Domein specifiek
3. **Enterprise Schaalbaarheid** - Teams kunnen skills delen
4. **Consistente Kwaliteit** - Best practices altijd beschikbaar

### Concrete Use Cases

| Skill | Wanneer Actief | Wat het Doet |
|-------|----------------|--------------|
| `widget-coherence` | Widget creation | Client/Server/HTML contract |
| `update-set-workflow` | Any development | Verplichte Update Set flow |
| `application-set-workflow` | Any development | Verplichte Application creation flow |
| `cmdb-best-practices` | CMDB queries | Relationship navigation, CI classes |
| `business-rule-patterns` | BR creation | Before/after, async, best practices |
| `rest-integration` | External APIs | REST Message setup, auth patterns |
| `scheduled-jobs` | Automation | Scheduled Script Execution patterns |
| `transform-maps` | Data import | Import Set + Transform Map workflow |
| `acl-security` | Access control | ACL creation, role-based patterns |
| `gliderecord-mastery` | Any queries | Efficient queries, encoding, joins |

---

## Technische Implementatie

### Officiële SKILL.md Specificatie

Volgens agentskills.io moet een SKILL.md bestand het volgende formaat hebben:

```yaml
---
name: "skill-name"           # REQUIRED: 1-64 chars, lowercase alphanumeric + hyphens
description: "..."           # REQUIRED: 1-1024 chars, when to use this skill
license: "MIT"               # OPTIONAL: license name or file reference
compatibility: "..."         # OPTIONAL: up to 500 chars for environment requirements
metadata:                    # OPTIONAL: key-value pairs
  author: "team"
  version: "1.0.0"
allowed-tools: "tool1 tool2" # OPTIONAL: space-delimited pre-approved tools (experimental)
---

# Skill Instructions (Markdown body)

Step-by-step guidance, examples, edge cases...
```

### Progressive Disclosure (3-Tier) - Officiële Spec

| Tier | Wat | Wanneer | Token Budget |
|------|-----|---------|--------------|
| **1. Metadata** | name + description | Startup | ~50-100 tokens |
| **2. Instructions** | Volledige SKILL.md | Bij activatie | <5000 tokens |
| **3. Resources** | scripts/, references/, assets/ | On-demand | Variabel |

**Belangrijk**: Houd SKILL.md onder 500 regels, verplaats details naar aparte bestanden.

### Fase 1: Skill Loading (config.ts)

```typescript
// Toevoegen aan config.ts

// Zoek naar SKILL.md bestanden (officieel format)
const SKILL_GLOB = new Bun.Glob("**/SKILL.md")

async function loadSkill(dir: string) {
  const result: Record<string, Skill> = {}

  for await (const item of SKILL_GLOB.scan({
    absolute: true,
    followSymlinks: true,
    dot: true,
    cwd: path.join(dir, "skill"),
  })) {
    const md = await ConfigMarkdown.parse(item)
    if (!md.data) continue

    // Skill folder name = skill identifier
    const skillDir = path.dirname(item)
    const skillName = path.basename(skillDir)

    const config = {
      name: md.data.name || skillName,
      description: md.data.description,
      license: md.data.license,
      compatibility: md.data.compatibility,
      metadata: md.data.metadata,
      allowedTools: md.data['allowed-tools'],
      content: md.content.trim(),
      path: skillDir, // Store path for resource loading
    }

    const parsed = Skill.safeParse(config)
    if (parsed.success) {
      result[config.name] = parsed.data
      continue
    }
    throw new InvalidError({ path: item }, { cause: parsed.error })
  }
  return result
}

// Skill schema (conform officiële spec)
export const Skill = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),  // REQUIRED
  description: z.string().min(1).max(1024),               // REQUIRED
  license: z.string().optional(),
  compatibility: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  allowedTools: z.string().optional(),  // space-delimited
  content: z.string(),
  path: z.string(),  // For loading resources
})
export type Skill = z.infer<typeof Skill>
```

### Fase 2: Skill Discovery in System Prompt (system.ts)

```typescript
// Toevoegen aan system.ts

export async function skills() {
  const config = await Config.get()
  const skills = config.skill ?? {}

  if (Object.keys(skills).length === 0) return []

  // Alleen metadata in system prompt (progressive disclosure)
  const skillDescriptions = Object.entries(skills)
    .map(([name, skill]) => `- **${name}**: ${skill.description}`)
    .join('\n')

  return [
    `<available-skills>`,
    `The following skills are available. When a task matches a skill's description, `,
    `the full skill content will be loaded automatically.`,
    ``,
    skillDescriptions,
    `</available-skills>`,
  ].join('\n')
}
```

### Fase 3: Skill Activation Logic

```typescript
// Nieuw bestand: src/skill/index.ts

export namespace Skill {
  export async function match(userMessage: string): Promise<Config.Skill | null> {
    const config = await Config.get()
    const skills = config.skill ?? {}

    for (const [name, skill] of Object.entries(skills)) {
      // Check triggers
      if (skill.triggers?.some(t =>
        userMessage.toLowerCase().includes(t.toLowerCase())
      )) {
        return skill
      }

      // Check description keywords
      const descWords = skill.description.toLowerCase().split(/\s+/)
      const msgWords = userMessage.toLowerCase().split(/\s+/)
      const overlap = descWords.filter(w => msgWords.includes(w))

      if (overlap.length >= 2) {
        return skill
      }
    }

    return null
  }

  export async function inject(skill: Config.Skill): Promise<string> {
    return [
      `<skill name="${skill.name}">`,
      skill.content,
      `</skill>`,
    ].join('\n')
  }
}
```

### Fase 4: Integration in Session

```typescript
// Aanpassen in session/index.ts of message handling

// Bij elke user message:
const matchedSkill = await Skill.match(userMessage)
if (matchedSkill) {
  // Inject skill content in context
  const skillPrompt = await Skill.inject(matchedSkill)
  // Voeg toe aan system prompt of als hidden message
}
```

---

## Directory Structuur (Conform Officiële Spec)

```
.snowcode/
├── command/              # Bestaand: user-invoked
│   └── release.md
├── agent/                # Bestaand: model modes
│   ├── build.md
│   └── plan.md
├── skill/                # NIEUW: model-invoked knowledge (officieel format)
│   ├── es5-compliance/
│   │   ├── SKILL.md      # Required: main skill file
│   │   └── references/   # Optional: extra docs
│   │       └── conversion-table.md
│   ├── widget-coherence/
│   │   ├── SKILL.md
│   │   └── assets/
│   │       └── widget-template.html
│   ├── update-sets/
│   │   └── SKILL.md
│   ├── gliderecord/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── encoded-queries.md
│   ├── business-rules/
│   │   └── SKILL.md
│   ├── rest-integration/
│   │   ├── SKILL.md
│   │   └── scripts/      # Optional: executable scripts
│   │       └── test-connection.js
│   ├── scheduled-jobs/
│   │   └── SKILL.md
│   ├── transform-maps/
│   │   └── SKILL.md
│   └── acl-security/
│       └── SKILL.md
└── plugin/               # Bestaand: custom tools
```

**Officiële structuur per skill:**
```
skill-name/
├── SKILL.md          # REQUIRED: instructions + metadata
├── scripts/          # OPTIONAL: executable code
├── references/       # OPTIONAL: extra documentation
└── assets/           # OPTIONAL: templates, resources
```

---

## Voorbeeld Skills

### 1. ES5 Compliance Skill

```markdown
---
name: "ES5 Compliance"
description: "Enforces ES5 JavaScript syntax for ServiceNow server-side scripts. Use when writing business rules, script includes, or background scripts."
triggers:
  - "business rule"
  - "script include"
  - "background script"
  - "server script"
priority: 100
---

# ES5 Compliance for ServiceNow

## CRITICAL: ServiceNow uses Rhino Engine (ES5 only)

All server-side JavaScript MUST use ES5 syntax. ES6+ will cause SyntaxError.

## Forbidden Syntax (WILL CRASH)

| ES6+ | Use Instead |
|------|-------------|
| `const x = 5` | `var x = 5` |
| `let items = []` | `var items = []` |
| `() => {}` | `function() {}` |
| `` `Hello ${name}` `` | `'Hello ' + name` |
| `for (x of arr)` | `for (var i = 0; i < arr.length; i++)` |
| `{a, b} = obj` | `var a = obj.a; var b = obj.b;` |

## Automatic Conversion

Before deploying any script, validate ES5 compliance:
1. Check for const/let → convert to var
2. Check for arrow functions → convert to function()
3. Check for template literals → convert to concatenation
```

### 2. Widget Coherence Skill

```markdown
---
name: "Widget Coherence"
description: "Ensures Service Portal widgets have proper data flow between Server, Client, and HTML. Use when creating or debugging widgets."
triggers:
  - "widget"
  - "service portal"
  - "sp_widget"
  - "ng-click"
priority: 90
---

# Widget Coherence Contract

## The Three-Way Contract

Every widget MUST have synchronized:

### 1. Server Script
- Initializes ALL `data.*` properties
- Handles ALL `input.action` requests from client

### 2. Client Controller
- Implements ALL methods called by `ng-click`
- Uses `c.server.get({action: 'name'})` for server calls

### 3. HTML Template
- Only references `data.*` from server
- Only calls methods defined in client

## Validation Checklist

- [ ] Every `data.property` in server → used in HTML
- [ ] Every `ng-click="method()"` → `c.method` in client
- [ ] Every `c.server.get({action})` → `if(input.action)` in server
- [ ] No orphaned properties or methods
```

### 3. Update Set Workflow Skill

```markdown
---
name: "Update Set Workflow"
description: "Enforces proper Update Set creation before any ServiceNow development. ALWAYS activate before creating artifacts."
triggers:
  - "create"
  - "widget"
  - "business rule"
  - "script include"
  - "ui action"
  - "client script"
priority: 200
---

# Update Set Workflow (MANDATORY)

## Before ANY Development

```javascript
// STEP 1: Create Update Set FIRST
const updateSet = await snow_update_set_manage({
  action: 'create',
  name: "Feature: [Descriptive Name]",
  description: "What and why"
});

// STEP 2: Do development work
// All changes are now tracked!

// STEP 3: Complete when done
await snow_update_set_manage({
  action: 'complete',
  update_set_id: updateSet.sys_id
});
```

## Why This Matters

- Without Update Set = Changes NOT tracked
- Untracked changes = Cannot deploy to other instances
- Work can be LOST without Update Sets
```

### 4. GlideRecord Mastery Skill

```markdown
---
name: "GlideRecord Mastery"
description: "Best practices for GlideRecord queries in ServiceNow. Use for any database operations, queries, or record manipulation."
triggers:
  - "query"
  - "gliderecord"
  - "database"
  - "records"
  - "table"
priority: 80
---

# GlideRecord Best Practices

## Efficient Querying

```javascript
// ✅ GOOD: Use encoded queries for complex conditions
var gr = new GlideRecord('incident');
gr.addEncodedQuery('active=true^priority=1^assigned_toISEMPTY');
gr.query();

// ❌ BAD: Multiple addQuery calls (slower)
gr.addQuery('active', true);
gr.addQuery('priority', 1);
gr.addQuery('assigned_to', '');
```

## Performance Tips

1. **Always use setLimit()** when you only need X records
2. **Use getValue()** instead of direct field access for strings
3. **Avoid queries in loops** - batch your operations
4. **Use GlideAggregate** for counts/sums instead of looping

## Common Patterns

```javascript
// Get single record
var gr = new GlideRecord('sys_user');
if (gr.get('user_name', 'admin')) {
  gs.info('Found: ' + gr.getValue('name'));
}

// Update multiple records
var gr = new GlideRecord('incident');
gr.addQuery('state', 6); // Resolved
gr.query();
while (gr.next()) {
  gr.setValue('state', 7); // Closed
  gr.update();
}
```
```

### 5. Business Rule Patterns Skill

```markdown
---
name: "Business Rule Patterns"
description: "ServiceNow Business Rule best practices. Use when creating before/after/async business rules on tables."
triggers:
  - "business rule"
  - "before insert"
  - "after update"
  - "async"
priority: 85
---

# Business Rule Best Practices

## When to Use Each Type

| Type | Use Case | Performance Impact |
|------|----------|-------------------|
| **Before** | Validate, modify current record | Low |
| **After** | Create related records, notifications | Medium |
| **Async** | Heavy processing, integrations | None (background) |
| **Display** | Modify form (client-side prep) | Low |

## Available Objects

```javascript
// In Business Rules, these are available:
current   // The record being operated on
previous  // The record BEFORE changes (update only)
gs        // GlideSystem utilities
```

## Common Patterns

```javascript
// Prevent update if condition not met (Before)
if (current.state == 7 && previous.state != 6) {
  current.setAbortAction(true);
  gs.addErrorMessage('Must resolve before closing');
}

// Create child record (After)
if (current.priority.changesTo(1)) {
  var task = new GlideRecord('task');
  task.initialize();
  task.short_description = 'P1 Follow-up: ' + current.number;
  task.parent = current.sys_id;
  task.insert();
}

// Heavy integration (Async)
var integrator = new MyIntegrationScript();
integrator.syncToExternalSystem(current.sys_id);
```

## Performance Rules

1. **Never query in Display rules** - slows form load
2. **Use Async for external calls** - don't block transactions
3. **Avoid current.update() in Before rules** - causes recursion
```

### 6. REST Integration Skill

```markdown
---
name: "REST Integration"
description: "Creating REST Message integrations in ServiceNow. Use for external API calls, webhooks, and third-party integrations."
triggers:
  - "rest"
  - "api"
  - "integration"
  - "external"
  - "webhook"
priority: 75
---

# REST Integration Patterns

## Creating REST Messages

Use `snow_create_rest_message` for proper REST setup:

```javascript
await snow_create_rest_message({
  name: "External API Integration",
  endpoint: "https://api.example.com",
  authentication: "basic", // or "oauth2", "api_key"
  methods: [
    {
      name: "Get Records",
      http_method: "GET",
      endpoint: "/v1/records"
    },
    {
      name: "Create Record",
      http_method: "POST",
      endpoint: "/v1/records",
      content_type: "application/json"
    }
  ]
});
```

## Calling REST from Scripts

```javascript
// Using RESTMessageV2 (ES5!)
var request = new sn_ws.RESTMessageV2('External API', 'Get Records');
request.setQueryParameter('limit', '100');
request.setRequestHeader('Accept', 'application/json');

var response = request.execute();
var httpStatus = response.getStatusCode();
var body = response.getBody();

if (httpStatus == 200) {
  var data = JSON.parse(body);
  // Process data...
}
```

## Error Handling

```javascript
try {
  var response = request.execute();
  if (response.getStatusCode() != 200) {
    gs.error('API Error: ' + response.getErrorMessage());
  }
} catch (ex) {
  gs.error('REST Exception: ' + ex.message);
}
```
```

### 7. Scheduled Jobs Skill

```markdown
---
name: "Scheduled Jobs"
description: "Creating and managing Scheduled Script Executions in ServiceNow. Use for automated tasks, cleanup jobs, and recurring processes."
triggers:
  - "scheduled"
  - "cron"
  - "recurring"
  - "cleanup"
  - "automation"
priority: 70
---

# Scheduled Script Execution

## Creating via MCP

```javascript
await snow_schedule_job({
  name: "Nightly Incident Cleanup",
  script: `
    var gr = new GlideRecord('incident');
    gr.addQuery('state', 7); // Closed
    gr.addQuery('closed_at', '<', gs.daysAgoStart(90));
    gr.query();

    var count = 0;
    while (gr.next()) {
      gr.deleteRecord();
      count++;
    }
    gs.info('Cleaned up ' + count + ' old incidents');
  `,
  run_type: "daily",
  time: "02:00:00" // 2 AM
});
```

## Run Types

| Type | Description | Example |
|------|-------------|---------|
| `daily` | Every day at time | Cleanup jobs |
| `weekly` | Specific day/time | Weekly reports |
| `monthly` | Day of month | Monthly aggregation |
| `on_demand` | Manual only | One-time tasks |
| `interval` | Every X minutes | Polling jobs |

## Best Practices

1. **Run during off-hours** - minimize impact on users
2. **Add logging** - track what was processed
3. **Use setLimit()** - prevent runaway jobs
4. **Handle errors gracefully** - don't crash on single record failure
```

---

## Configuratie Opties

### In opencode.jsonc

```jsonc
{
  "skill": {
    "servicenow-es5": {
      "enabled": true,
      "priority": 100
    },
    "widget-coherence": {
      "enabled": true
    }
  }
}
```

### Environment-Specifieke Skills

```jsonc
{
  "skill": {
    // Alleen in development
    "debug-helpers": {
      "enabled": "{env:NODE_ENV}" === "development"
    }
  }
}
```

---

## Rollout Plan

### Week 1: Foundation
- [ ] Skill schema toevoegen aan config.ts
- [ ] loadSkill() functie implementeren
- [ ] Unit tests voor skill loading

### Week 2: Integration
- [ ] Skill discovery in system.ts
- [ ] Skill matching logic
- [ ] Integration in session handling

### Week 3: Content
- [ ] Core ServiceNow skills schrijven
- [ ] Testing met real-world scenarios
- [ ] Documentation

### Week 4: Polish
- [ ] Performance optimalisatie
- [ ] Enterprise skill sharing via snow-flow-enterprise
- [ ] User documentation

---

## Toekomstige Uitbreidingen

### 1. Skill Analytics
Track welke skills het meest worden geactiveerd.

### 2. Custom Skill Marketplace
Enterprise users kunnen skills delen via portal.

### 3. AI-Generated Skills
Skills automatisch genereren uit succesvolle sessies.

### 4. Skill Versioning
Skills met semantic versioning voor backwards compatibility.

---

## Referenties

- **Agent Skills Open Standard**: https://agentskills.io
- **Officiële Specificatie**: https://agentskills.io/specification
- Claude Code Skills Documentation: https://code.claude.com/docs/en/skills.md
- Snow-Code Agent System: `packages/snowcode/src/config/config.ts`
- System Prompt: `packages/snowcode/src/session/system.ts`

---

## Validatie tegen Officiële Specificatie

### Conformiteit Check (december 2024)

| Spec Requirement | Ons Plan | Status |
|------------------|----------|--------|
| SKILL.md in folder | ✅ `skill/name/SKILL.md` | Conform |
| `name` field (1-64 chars, lowercase) | ✅ Zod validation | Conform |
| `description` field (1-1024 chars) | ✅ Required in schema | Conform |
| Optional: `license`, `compatibility`, `metadata` | ✅ In schema | Conform |
| Optional: `allowed-tools` | ✅ In schema | Conform |
| Progressive disclosure (3-tier) | ✅ Metadata → Content → Resources | Conform |
| Folder structure (scripts/, references/, assets/) | ✅ Documented | Conform |
| <500 lines recommendation | ✅ In best practices | Conform |

### Afwijkingen van Spec

| Afwijking | Reden | Impact |
|-----------|-------|--------|
| `triggers` field toegevoegd | ServiceNow-specifieke keyword matching | Uitbreiding, geen conflict |
| `priority` field toegevoegd | Ordening bij multiple matches | Uitbreiding, geen conflict |

### Conclusie

**Ons implementatieplan is volledig conform de Agent Skills open standaard.** De toegevoegde `triggers` en `priority` velden zijn uitbreidingen die niet conflicteren met de spec.

---

## Appendix: Volledige Diff Preview

De belangrijkste wijzigingen zullen zijn in:

1. `packages/snowcode/src/config/config.ts` - Skill schema en loading
2. `packages/snowcode/src/session/system.ts` - Skill discovery
3. `packages/snowcode/src/skill/index.ts` - Nieuw: Skill matching
4. `.snowcode/skill/**/SKILL.md` - Skill content files (officieel format)

Totale geschatte LOC: ~200-300 nieuwe regels code.
