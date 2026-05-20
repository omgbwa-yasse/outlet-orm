# AI Reference

## Contents

- When to read this document
- Scope
- AIManager
- Supported providers
- TextBuilder
- Support classes
- ORM AI features
- MCPServer
- AISafetyGuardrails
- Recommendations
- Source files to read

## When to read this document

Read this resource if the request is about `AIManager`, the `Ai` alias, providers, `TextBuilder`, `AIQueryBuilder`, `AISeeder`, `AIQueryOptimizer`, `AIPromptEnhancer`, `PromptGenerator`, `MCPServer`, or `AISafetyGuardrails`.

Do not use it as the main entry point for:

- classic SQL CRUD without an AI component: see `MODELS.md` or `QUERIES.md`
- the `Api` / `ApiGraphQL` HTTP layer: see `API.md`
- shell commands alone without AI detail: see `CLI.md`

## Scope

This document covers the AI layer of `outlet-orm`.

Main exports:

- `AIManager` et alias `Ai`
- `AIFacade`
- `TextBuilder`
- provider contracts
- concrete providers
- support classes
- `AIQueryBuilder`
- `AISeeder`
- `AIQueryOptimizer`
- `AIPromptEnhancer`
- `PromptGenerator`
- `MCPServer`
- `AISafetyGuardrails`

## AIManager

Role:

- central multi-provider facade
- orchestration of chat / embeddings / image / audio / model calls

When to use it:

- when the code should remain provider-agnostic
- when you want to swap OpenAI, Claude, Gemini, Ollama, and others

Public alias:

- `Ai === AIManager`

## Supported providers

- `OpenAIProvider`
- `OllamaProvider`
- `OllamaTurboProvider`
- `ClaudeProvider`
- `GeminiProvider`
- `GrokProvider`
- `MistralProvider`
- `OnnProvider`
- `CustomOpenAIProvider`

Exposed contracts:

- `ChatProviderContract`
- `EmbeddingsProviderContract`
- `ImageProviderContract`
- `AudioProviderContract`
- `ModelsProviderContract`
- `ToolContract`

## TextBuilder

`TextBuilder` provides a fluent API for building a readable LLM request.

Use cases:

- enriching a prompt step by step
- injecting context and output constraints
- centralizing the configuration chain for a text call

## Support classes

- `StreamChunk`
- `Message`
- `Document`
- `ProviderError`
- `ToolRegistry`
- `ToolChatRunner`
- `SystemInfoTool`
- chat / embeddings / image / audio normalizers
- `JsonSchemaValidator`
- `FileSecurity`

Use cases:

- normalizing provider formats
- driving tool calling
- validating a structured output schema
- filtering / securing attachments or AI-related files

## ORM AI features

### AIQueryBuilder

Role:

- translating a natural language question into SQL
- relying on schema introspection
- executing the query according to the AI configuration

Good usage:

- enable a read-only safe mode when the context requires it
- explicitly provide the right provider / model in a multi-provider environment

### AISeeder

Role:

- generating realistic seed data through an LLM
- preview option with `generate()`
- direct insertion with `seed()`

### AIQueryOptimizer

Role:

- analyzing a SQL query
- proposing a rewritten version
- suggesting indexes and improvements

### AIPromptEnhancer

Role:

- generating schema
- generating model code
- generating migration code

### PromptGenerator

Historical / practical role:

- parsing a business prompt
- inferring a table blueprint
- generating models, migrations, and an initial seeder
- engine notably used by `outlet-init --prompt`

## MCPServer

`MCPServer` exposes `outlet-orm` to agents over MCP on stdio.

Exposed tools:

- `migrate_status`
- `migrate_run`
- `migrate_rollback`
- `migrate_reset`
- `migrate_make`
- `seed_run`
- `schema_introspect`
- `query_execute`
- `model_list`
- `backup_create`
- `backup_restore`
- `ai_query`
- `query_optimize`

Related CLI:

```bash
outlet-mcp --project .
```

## AISafetyGuardrails

Role:

- guard destructive actions on the AI / CLI / MCP side
- require evidence of consent for sensitive operations

Typical cases:

- migration reset
- backup restore
- execution of write SQL queries from an agent

## Recommendations

- use `AIManager` or `Ai` as the main entry point, not providers directly, if you want portability
- verify guardrails for any destructive operation driven by an agent
- use `generate()` before `seed()` when the data must be reviewed
- keep a clear distinction between AI demo flows and production flows

## Source files to read

- `src/AI/AIManager.js`
- `src/AI/Builders/TextBuilder.js`
- `src/AI/Providers/*`
- `src/AI/Support/*`
- `src/AI/AIQueryBuilder.js`
- `src/AI/AISeeder.js`
- `src/AI/AIQueryOptimizer.js`
- `src/AI/AIPromptEnhancer.js`
- `src/AI/PromptGenerator.js`
- `src/AI/MCPServer.js`
- `tests/AI.test.js`
- `tests/AiBridge.test.js`
