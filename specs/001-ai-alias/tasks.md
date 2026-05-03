# Tasks: AI Alias for AiManager

**Input**: Design documents from `specs/001-ai-alias/`
**Branch**: `001-ai-alias`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: User Story 1 — Import `Ai` directly (P1)

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this is a two-file edit in an existing package.

*No setup tasks required — library is already bootstrapped.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify that `AIManager` is already exported and no `Ai` conflict exists before writing any code.

- [x] T001 Confirm `AIManager` is a named export in `src/index.js` and no existing `Ai` export is present

**Checkpoint**: Confirmed — `AIManager` exported at line 134 of `src/index.js`; no `Ai` name present. ✅

---

## Phase 3: User Story 1 — Import Ai directly (Priority: P1) 🎯 MVP

**Goal**: Export `Ai` as a strict alias of `AIManager` from the package entry point, so `require('outlet-orm').Ai === require('outlet-orm').AIManager` is `true`.

**Independent Test**: `const { Ai, AIManager } = require('./src/index'); assert(Ai === AIManager)` — passes without any other changes.

### Implementation for User Story 1

- [x] T002 [P] [US1] Add `const Ai = AIManager;` after the AIManager require and add `Ai,` to `module.exports` in `src/index.js`
- [x] T003 [P] [US1] Add `export { AIManager as Ai };` to `types/index.d.ts` after the `AIManager` class declaration

### Verification for User Story 1

- [x] T004 [US1] Add one test assertion to `tests/AI.test.js`: `expect(require('../src/index').Ai).toBe(require('../src/index').AIManager)`
- [x] T005 [US1] Run `npm test` and confirm all existing tests still pass (SC-002) and the new assertion passes (SC-001, SC-003)

**Checkpoint**: `Ai === AIManager` is `true`; all 826+ tests pass; `Ai` appears in module exports.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T006 [P] Validate quickstart.md usage snippet works: `const { Ai } = require('./src/index'); new Ai({})` does not throw

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **User Story 1 (Phase 3)**: Depends on Phase 2 confirmation
- **Polish (Phase 4)**: Depends on Phase 3 completion

### User Story Dependencies

- **US1** is the entire feature scope — only one user story.

### Within User Story 1

- T002 and T003 are independent (different files) — run in **parallel**
- T004 depends on T002 (needs the export to exist before writing the test)
- T005 depends on T004

---

## Parallel Example: User Story 1

```bash
# T002 and T003 can be done simultaneously (different files):
Task T002: "src/index.js — add Ai alias"
Task T003: "types/index.d.ts — add Ai type alias"

# Then sequentially:
Task T004: "tests/AI.test.js — add assertion"
Task T005: "npm test — verify all pass"
```

---

## Implementation Strategy

### MVP (User Story 1 Only — this IS the entire feature)

1. Complete Phase 2: verify no conflict
2. Complete T002 + T003 in parallel
3. Complete T004 (test assertion)
4. Run T005: `npm test` — all green
5. **Done** ✅

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 6 |
| Tasks for US1 | 4 (T002–T005) |
| Parallelizable | T002 + T003 |
| New files | 0 |
| Files modified | 2 (`src/index.js`, `types/index.d.ts`) + 1 test (`tests/AI.test.js`) |
| MVP scope | All of Phase 3 (entire feature) |
