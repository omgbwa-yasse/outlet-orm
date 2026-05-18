# Implementation Plan: AI Alias for AiManager

**Branch**: `001-ai-alias` | **Date**: 2026-05-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-ai-alias/spec.md`

## Summary

Export `Ai` as a pure re-export alias of the existing `AIManager` class so that consumers can write `const { Ai } = require('outlet-orm')` and get strict equality with `AIManager`. Two touch-points: `src/index.js` (runtime) and `types/index.d.ts` (TypeScript declarations).

## Technical Context

**Language/Version**: Node.js 18+ — CommonJS (`require`/`module.exports`)  
**Primary Dependencies**: None — change is a one-line alias  
**Storage**: N/A  
**Testing**: Jest (`npm test`)  
**Target Platform**: Node.js (npm package `outlet-orm`)  
**Project Type**: npm library  
**Performance Goals**: N/A  
**Constraints**: Zero behaviour change; backward compatible; `Ai === AIManager` must hold  
**Scale/Scope**: 2 files touched (runtime index + TypeScript declarations)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is a blank template — no project-specific principles have been ratified. No gates to evaluate. ✅

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-alias/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A — no entities)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
└── index.js             # Add: const Ai = AIManager; + export Ai

types/
└── index.d.ts           # Add: export { AIManager as Ai }
```

**Structure Decision**: Single-project library. The change touches exactly two existing files at the package root level. No new directories or modules are created.

## Complexity Tracking

*No constitution violations.*
