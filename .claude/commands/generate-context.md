---
description: "Regenerate project-context.md by scanning codebase for critical rules and patterns"
---

# Generate Project Context

## Context

Scan the codebase and generate (or update) `docs/project/project-context.md` — a concise document of critical implementation rules and patterns that must be followed when writing code. Optimized for LLM context efficiency.

## Process

### Step 1: Scan the codebase

Analyze the project structure, focusing on:
- **Backend**: .NET project structure, namespaces, dependency injection patterns, EF Core configuration, API controller patterns, MediatR command/query patterns, validation patterns
- **Frontend**: Angular module/component structure, state management patterns (@ngrx/signals), service patterns, routing, Material component usage
- **Testing**: test project structure, naming conventions, fixture patterns, E2E helpers
- **Infrastructure**: Docker configuration, CI/CD workflow patterns, database migration approach

### Step 2: Extract critical rules

For each area, identify rules that an AI must follow to produce consistent code:
- File naming conventions (per language)
- Class/method naming patterns
- Architectural layer boundaries and dependency rules
- API response format patterns
- Error handling patterns
- Authentication/authorization patterns
- Database patterns (soft deletes, audit fields, multi-tenancy)
- Import/export conventions

### Step 3: Write project-context.md

Write to `docs/project/project-context.md` with this structure:

```markdown
# Project Context: {project_name}

## Technology Stack
[Versions, frameworks, key libraries]

## Critical Implementation Rules

### Backend Rules
[Numbered rules for .NET/C# patterns]

### Frontend Rules
[Numbered rules for Angular/TypeScript patterns]

### Database Rules
[EF Core patterns, migration rules, naming]

### Testing Rules
[Test framework patterns, naming, structure]

### API Rules
[Endpoint patterns, response formats, validation]
```

Keep it concise — every rule should prevent a specific mistake. No filler.

## Validation Gates

- [ ] Rules are specific enough to prevent ambiguity
- [ ] No contradictions between rules
- [ ] Covers all layers of the architecture
- [ ] Concise — under 200 lines preferred
