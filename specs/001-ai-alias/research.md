# Research: AI Alias for AiManager

**Feature**: 001-ai-alias  
**Date**: 2026-05-03  
**Status**: Complete — no unknowns remain

## Findings

### 1. Existing exports (runtime — src/index.js)

| Export name | Source | Line | Type |
|-------------|--------|------|------|
| `AIManager` | `src/AI/AIManager.js` | 53 | Class (instantiated: `new AIManager(config)`) |
| `AIFacade`  | `src/AI/Facades/AI.js` | 54 | Static singleton object (not a class) |

**Decision**: `Ai` aliases `AIManager` (the class). The user's description "alias de AiManager" is unambiguous. `AIFacade` is a different entity.  
**Rationale**: Direct match to the user's stated intent; no ambiguity.  
**Alternatives considered**: Aliasing `AIFacade` — rejected because the user explicitly named `AiManager`.

---

### 2. No existing `Ai` export

Searched `src/index.js` and `types/index.d.ts` for any `Ai` export — none found.  
**Decision**: No naming conflict; the alias can be added safely.

---

### 3. Implementation pattern for a pure re-export alias (CommonJS)

```js
// After the AIManager require() line:
const Ai = AIManager;

// In module.exports:
module.exports = {
  // ... existing exports ...
  AIManager,
  Ai,          // pure alias — Ai === AIManager is true
};
```

**Decision**: Use `const Ai = AIManager` at the require-block level, add to `module.exports`.  
**Rationale**: CommonJS does not support `export { X as Y }` syntax; this pattern is idiomatic and achieves strict equality.  
**Alternatives considered**: Adding a new `src/AI/Facades/Ai.js` file — rejected as unnecessary indirection for a single-line alias.

---

### 4. TypeScript declaration pattern

```ts
// In types/index.d.ts, after the AIManager class declaration:
export { AIManager as Ai };
```

**Decision**: Use `export { AIManager as Ai }` (re-export syntax inside a `declare module` block).  
**Rationale**: This is the canonical TypeScript way to declare an alias that is type-identical to the original without duplicating the class definition.  
**Alternatives considered**: `export class Ai extends AIManager {}` — rejected because it changes the type identity and adds unnecessary inheritance.

---

### 5. Test strategy

No new test file is required. A single test case appended to the existing `tests/AI.test.js` is sufficient:

```js
it('exports Ai as a strict alias of AIManager', () => {
  const { Ai, AIManager } = require('../src/index');
  expect(Ai).toBe(AIManager);
});
```

**Decision**: One assertion in the existing AI test file.  
**Rationale**: The feature has exactly one verifiable outcome (`Ai === AIManager`); a dedicated test file would be over-engineered.

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| What `Ai` aliases | `AIManager` (the class) |
| Runtime implementation | `const Ai = AIManager` + added to `module.exports` in `src/index.js` |
| TypeScript | `export { AIManager as Ai }` appended to `types/index.d.ts` |
| New files | None |
| Test | One assertion in `tests/AI.test.js` |
| Backward compatibility | Full — existing `AIManager` export unchanged |
