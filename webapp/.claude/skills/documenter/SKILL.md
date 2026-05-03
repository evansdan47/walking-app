---
name: documenter
description: >
  Use this skill when the user asks to document a feature, update project docs,
  record a design decision, or asks "have you documented this?". Also use when
  completing a significant piece of implementation work that has no doc yet.
---

# Documenter Skill

This skill defines how to create and maintain technical documentation for the
webapp under `webapp/docs/`.

---

## When to Apply

- A new module, algorithm, or non-obvious design decision has been implemented
- The user explicitly asks to document something
- The user asks "have you documented this?" or "add this to the docs"
- A doc already exists for the topic but is now out of date

---

## File Conventions

| Path | Purpose |
|------|---------|
| `webapp/docs/index.md` | Master index — one row per doc |
| `webapp/docs/<topic>.md` | One file per distinct topic |

**Naming rules:**
- Use lowercase kebab-case: `activity-pace.md`, `elevation-chart.md`
- One subject per file — do not combine unrelated topics
- File names should match the index row subject closely

---

## Step-by-Step Process

### 1 — Check whether a doc already exists

```
file_search: webapp/docs/<topic>.md
```

If it exists, update it rather than creating a new file.

### 2 — Write (or update) the topic doc

A topic doc should contain, in order:

1. **Title** — `# Topic Name`
2. **Source file(s)** — `**Source file:** src/path/to/file.ts`
3. **Overview** — one paragraph: what is this and why does it exist?
4. **Design rationale** — the key decisions and *why* they were made. Prefer
   equations or tables over prose where the subject is mathematical.
5. **Implementation notes** — how the code actually works; code snippets where
   helpful.
6. **Integration** — where and how this module is consumed by the rest of the
   app.
7. **Future directions** — known gaps, planned extensions, things that were
   deliberately deferred.

Not every section is required for every doc — omit sections that add no value.

### 3 — Update the index

Open `webapp/docs/index.md` and add a row to the index table:

```markdown
| Subject label | [filename.md](filename.md) | One-line summary |
```

- Keep the table sorted alphabetically by subject label
- The summary should be a single clause, not a sentence — e.g.
  *"Tobler hiking function, per-activity profiles, gradient time estimation"*

### 4 — Verify

Run `get_errors` on any TypeScript files referenced in the doc to confirm they
are still valid. Do not document stale or removed code.

---

## Quality Bar

- Docs are for **future maintainers and AI agents**, not end users
- Prefer *why* over *what* — the code itself shows what; the doc must explain
  the reasoning behind non-obvious choices
- Every mathematical formula should have a brief plain-English explanation of
  what each symbol means
- Keep docs current — if an implementation changes, update the doc in the same
  PR/session

---

## Example Index Row

```markdown
| Elevation chart | [elevation-chart.md](elevation-chart.md) | SVG hover, drag-range selection, external hover index |
```

## Example Topic Doc Skeleton

```markdown
# Topic Name

**Source file:** `src/path/to/file.ts`  
**Used in:** `src/path/to/consumer.tsx`

---

## Overview

One paragraph.

---

## Design Rationale

Why this approach was chosen over alternatives.

---

## Implementation Notes

How it works. Code snippet if helpful.

---

## Integration

Where it is consumed and how.

---

## Future Directions

- Known gaps
- Planned extensions
```
