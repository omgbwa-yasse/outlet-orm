# Quickstart: Using the `Ai` Alias

**Feature**: 001-ai-alias

## Overview

`Ai` is a pure alias of `AIManager`. Every feature available via `AIManager` is equally available via `Ai`. Strict equality holds: `Ai === AIManager`.

## Installation

```sh
npm install outlet-orm
```

## Basic Usage

```js
const { Ai } = require('outlet-orm');

// Instantiate just like AIManager
const ai = new Ai({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});

// Use the full AIManager API
const response = await ai.chat('Hello, how are you?');
console.log(response);
```

## TypeScript Usage

```ts
import { Ai } from 'outlet-orm';

const ai = new Ai({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

const reply: string = await ai.chat('Hello!');
```

## Strict Equality

The alias preserves full identity with the original class:

```js
const { Ai, AIManager } = require('outlet-orm');

console.log(Ai === AIManager); // true — same reference
```

## Migration from `AIManager`

If you previously imported `AIManager`, you can switch to `Ai` without any other code changes:

```js
// Before
const { AIManager } = require('outlet-orm');
const ai = new AIManager(config);

// After (equivalent)
const { Ai } = require('outlet-orm');
const ai = new Ai(config);
```

Both styles remain valid simultaneously.
