# devplans

Internal planning and reference docs for ExifCleaner development — implementation plans, QA runbooks, and research references that inform the codebase but aren't user-facing documentation. See [CLAUDE.md](../CLAUDE.md) and [.claude/rules/modernization-roadmap.md](../.claude/rules/modernization-roadmap.md) for the project-level roadmap these feed into.

## Index

| Doc | What it covers | Status |
|---|---|---|
| [04-esm-modules.md](04-esm-modules.md) | ESM module hygiene (Chunk 4 of the modernization roadmap) | Done |
| [05-verify-cleanup.md](05-verify-cleanup.md) | Phase 4 QA runbook — verify + cleanup after Chunks 1-4 | Done |
| [12-animation-principles.md](12-animation-principles.md) | UI animation reference (source: Emil Kowalski's articles) | Reference |
| [improvement.md](improvement.md) | Windows "Send To" Clean EXIF integration — design, security review, manual QA | Implemented, pending manual QA |

## Conventions

- **Numbered docs** (`04-`, `05-`, `12-`, ...) track the phased modernization roadmap in `.claude/rules/modernization-roadmap.md` — number matches the phase/chunk it documents.
- **Named docs** (e.g. `improvement.md`) are standalone feature plans outside the numbered sequence.
- Each doc states its own status (plan / implemented / done) at the top — check that before assuming a doc reflects current app behavior.
- These docs are tracked in git (not ignored) — they're meant to persist as institutional memory for why decisions were made, not just scratch notes.
