# Feature Specification: AI Alias for AIManager

**Feature Branch**: `001-ai-alias`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "Je veux un alias de AiManager qui sera Ai"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Import Ai directly (Priority: P1)

A developer using the package wants to import the AI manager using the short name `Ai` instead of `AIManager`, making the code more concise and readable.

**Why this priority**: This is the entire scope of the feature — a simple alias that reduces verbosity for the most common usage pattern.

**Independent Test**: Can be fully tested by importing `{ Ai }` from the package entry point and verifying it is the same object as `AIManager`.

**Acceptance Scenarios**:

1. **Given** the package is installed, **When** a consumer does `import { Ai } from 'outlet-orm'` (or `const { Ai } = require('outlet-orm')`), **Then** `Ai` resolves to the same class/object as `AIManager`.
2. **Given** both names are imported, **When** the consumer compares `Ai === AIManager`, **Then** the result is `true`.
3. **Given** the package entry point, **When** the consumer inspects the exported names, **Then** both `Ai` and `AIManager` are present.

---

### Edge Cases

- If `AIManager` itself is not exported from the entry point, the alias cannot be created — `AIManager` must already be a named export.
- The alias must not shadow or conflict with any existing `Ai` export in the package.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The package MUST export an `Ai` name that is strictly equal (`===`) to the existing `AIManager` export.
- **FR-002**: The existing `AIManager` export MUST remain unchanged and fully backward compatible.
- **FR-003**: The `Ai` alias MUST be available from the same entry point as `AIManager` (i.e., the main package index).
- **FR-004**: `Ai` MUST NOT introduce new logic, behaviour, or wrapping — it is a pure re-export alias.
- **FR-005**: The TypeScript declaration file MUST export `Ai` as an alias of `AIManager` (i.e., `export { AIManager as Ai }`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `require('outlet-orm').Ai === require('outlet-orm').AIManager` evaluates to `true`.
- **SC-002**: All existing tests continue to pass without modification after the alias is added.
- **SC-003**: The `Ai` name appears in the package's public export list alongside `AIManager`.

## Assumptions

- `AIManager` is already a named export in the package's main entry point (`src/index.js`).
- No existing `Ai` export is present in the package (no naming conflict).
- The alias is added at the index level only — no changes to `AIManager`'s own file are required.
