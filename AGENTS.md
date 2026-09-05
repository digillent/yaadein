# AGENTS.md

Instructions for Cursor agents (and humans) working on Yaadein.

## Before any implementation task

1. Read this file.
2. Read [PRODUCT.md](PRODUCT.md) and [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries.
3. Read the **current** milestone in [ROADMAP.md](ROADMAP.md)—implement only that milestone’s in-scope items.
4. Inspect existing code and tests before changing anything.
5. State which files need modification and why (briefly).
6. Make the **smallest** change that completes the request.
7. Do **not** refactor unrelated code.
8. Do **not** implement future roadmap milestones “while you’re here.”
9. Add or update tests for the change.
10. Run the **relevant** tests.
11. Summarize what changed.
12. Mention any architectural concern discovered.

Do not optimize prematurely. Do not create abstractions merely because they might be useful someday.

## Architecture boundaries

| Do | Do not |
|----|--------|
| Keep filesystem, hashing, and moves in main/domain/infrastructure | Import `fs` / Node crypto hashing from React components |
| Keep React + Redux for UI and presentation state | Put authoritative media catalogs only in Redux |
| Keep Azure/Cosmos/Blob SDK usage behind adapters (`CloudApiClient`, `ObjectStorageProvider`, etc.) | Call Azure SDKs from domain classification logic or renderer |
| Keep metadata APIs separate from byte transfer | Proxy large photos/videos through Azure Functions |
| Treat cloud metadata as authoritative for **accepted** and **rejected** when cloud is enabled | Treat SQLite as permanent truth for those decisions; write **duplicate** docs to Cosmos |
| Move files into `preserve` / `rejected` / `duplicate` on classify | Permanently delete media automatically |
| Prefer batch hash lookups and batch decision upserts | One network request per scanned file by default |
| Keep decision, `cloudStatus`, and local availability separate | Encode sync success into the decision enum |

## Product rules agents must not violate

- **Media review workflow:** known rejected → `rejected/`; known accepted → `duplicate/`; unknown → manual review → accept (`preserve/`) or reject (`rejected/`). See diagram in [PRODUCT.md](PRODUCT.md) / [README.md](README.md).
- **Move-on-classify:** `ACCEPTED` → `preserve/`; `REJECTED` → `rejected/`; `DUPLICATE` → `duplicate/`; paths use `YYYY/MM`.
- **Unknown:** skip on automatic scan; only move after explicit review (or known prior decision).
- **Hash:** SHA-256 content hash for identity and verification in MVP.
- **Capture date:** EXIF/media metadata → `mtime` → `ctime`.
- **Tags (MVP):** extract `tags.people` / `tags.places` / `tags.events` during local media processing; persist locally; sync rich tags to Cosmos **for ACCEPTED**. Rejected Cosmos docs are lean. Do not build ML face-clustering unless the current milestone explicitly requires it.
- **Cosmos shape:** partition `/userId`; document `id` = SHA-256 (the id **is** the content hash—no separate `contentHash` field); keep `decision` and `cloudStatus` separate.
- **Cloud write policy:** `ACCEPTED` → Cosmos (full) + Blob; `REJECTED` → Cosmos (lean hash + decision, no Blob); `DUPLICATE` → local only (accepted hash already in Cosmos).
- **Secrets:** never embed Cosmos keys, storage account keys, database passwords, client secrets, or privileged function keys in the Electron app.
- **Desktop-first:** do not pull forward Azure work before the roadmap says so, unless the user explicitly changes scope.

## Preferred coding practices

- Prefer simple, readable TypeScript over cleverness.
- Small modules with focused responsibility.
- Explicit types at API and domain boundaries; avoid `any` unless justified and temporary.
- Match existing naming, file layout, and patterns once code exists.
- Comments only for non-obvious intent or constraints—not narration.
- No drive-by refactors, no unrelated file cleanup, no new docs unless asked.

## TypeScript conventions

- Strict TypeScript when the project enables it—do not weaken strictness casually.
- Prefer `PascalCase` for types/classes, `camelCase` for values/functions, `UPPER_SNAKE` for true constants/enums of status strings if that pattern is established.
- Shared decision/cloud status string unions should match PRODUCT/ARCHITECTURE names exactly (`ACCEPTED`, `SYNCED`, etc.).
- Use `pnpm` for package management when installing dependencies.

## Testing expectations

- Every milestone and bugfix should include automated tests at the appropriate layer (unit for pure logic; temp-dir integration for FS/SQLite).
- Prefer testing domain and infrastructure without launching the full UI when possible.
- After changes, run the relevant test command for the touched package (document the exact script in the PR/summary once scripts exist).
- Do not claim “tested” without running tests.

## Repo layout expectations

As milestones progress:

```text
apps/desktop/     # Electron + React
apps/api/         # Azure Functions (from Milestone 10)
packages/shared/  # Only when duplication of types becomes painful
```

Do not create empty package scaffolding ahead of need.

## Out-of-scope temptations

Unless the user or current milestone explicitly requires it, do **not** add:

- Perceptual hashing / near-duplicate ML
- Mobile app code
- Multi-cloud provider frameworks
- Bidirectional sync engines / CRDTs
- Permanent deletion features
- IaC or CI sprawl beyond what the milestone needs
- Extra markdown docs the user did not ask for

## Working style checklist (every task)

```text
[ ] Read AGENTS.md + relevant architecture/product docs
[ ] Inspect existing implementation
[ ] Scope limited to current milestone / user ask
[ ] Smallest viable change
[ ] Tests added/updated
[ ] Relevant tests run
[ ] Summary + any architectural concerns
```
