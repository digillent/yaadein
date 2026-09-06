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
| Keep filesystem, hashing, and moves in main/domain/infrastructure | Import `fs` / hashing from React |
| Keep React + Redux for UI presentation | Put Cosms catalog in Redux as source of truth |
| Access Cosms/Blob with **Entra user tokens** behind adapters | Put Cosms/storage **account keys** in the app (plain or encrypted) |
| Treat Cosms as authoritative for accepted/rejected | Local SQL decision cache; Cosms docs for duplicates |
| Move `ACCEPTED` to `preserve/` only after Blob `SYNCED` | Move accepted before upload succeeds |
| Prefer batch Cosms ops; size to narrow duplicate candidates | One request per file by default; size-only “duplicates” |
| Keep decision / `cloudStatus` / local availability separate | Encode sync into the decision enum |

## Product rules agents must not violate

- Workflow: Cosms lookup → rejected/`rejected/` ; accepted/`duplicate/` ; unknown → review.
- Accept: Cosms full + Blob `SYNCED` → then `preserve/YYYY/MM`.
- Reject: Cosms lean → `rejected/YYYY/MM`.
- Duplicate: local only when hash matches accepted; no Cosms duplicate doc.
- No local SQL decision cache in MVP.
- No Azure Functions required for solo MVP (do not scaffold `apps/api` unless the milestone says so).
- Secrets: never embed Cosms keys, storage account keys, DB passwords, client secrets, or privileged function keys.
- Hash: SHA-256 `contentHash` + always `fileSize`.
- Cosms: partition `/userId`; separate `contentHash` and `fileSize` fields.
- Online MVP for classify/accept/reject.

## Preferred coding practices

- Simple TypeScript; small modules; explicit boundary types; match existing patterns.
- Comments only for non-obvious constraints.
- No drive-by refactors or unsolicited docs.

## Testing expectations

- Unit tests for pure logic; mocked Cosms/Blob clients; temp-dir FS tests.
- Run relevant package tests; do not claim “tested” without running them.

## Repo layout

```text
apps/desktop/     # Electron + React
```

Do not create `apps/api` for solo MVP.

## Out-of-scope temptations

- Functions gateway “while you’re here”
- Encrypted account-key files
- Offline decision catalogs / SQLite decisions
- Perceptual near-dupe ML; mobile; multi-cloud frameworks

## Working style checklist

```text
[ ] Read AGENTS + product/architecture
[ ] Inspect existing code
[ ] Scope = current milestone only
[ ] Smallest viable change
[ ] Tests added/updated and run
[ ] Summary + concerns
```
