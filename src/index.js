const Model = require('./Model');
const QueryBuilder = require('./QueryBuilder');
const QueryBuilderError = require('./Errors/QueryBuilderError');
const DatabaseConnection = require('./DatabaseConnection');
const { UnsupportedCapabilityError } = require('./Errors/UnsupportedCapabilityError');

// DB Objects — Fluent API (v11.4.0)
const { View, Trigger, Procedure, Function, Transaction, useSchema } = require('./Objects');

/**
 * Isolation level constants for use with DatabaseConnection.setIsolationLevel().
 * @readonly
 * @enum {string}
 */
const IsolationLevel = Object.freeze({
  READ_UNCOMMITTED: 'READ UNCOMMITTED',
  READ_COMMITTED:   'READ COMMITTED',
  REPEATABLE_READ:  'REPEATABLE READ',
  SERIALIZABLE:     'SERIALIZABLE'
});

// Relations
const Relation = require('./Relations/Relation');
const HasOneRelation = require('./Relations/HasOneRelation');
const HasManyRelation = require('./Relations/HasManyRelation');
const BelongsToRelation = require('./Relations/BelongsToRelation');
const BelongsToManyRelation = require('./Relations/BelongsToManyRelation');
const HasManyThroughRelation = require('./Relations/HasManyThroughRelation');
const HasOneThroughRelation = require('./Relations/HasOneThroughRelation');
const MorphOneRelation = require('./Relations/MorphOneRelation');
const MorphManyRelation = require('./Relations/MorphManyRelation');
const MorphToRelation = require('./Relations/MorphToRelation');

// Schema & Migrations (v5.0.0 - moved from lib/)
const { Schema, Blueprint, ColumnDefinition, ForeignKeyDefinition, CheckConstraintDefinition } = require('./Schema/Schema');
const Migration = require('./Migrations/Migration');
const MigrationManager = require('./Migrations/MigrationManager');
const Seeder = require('./Seeders/Seeder');
const SeederManager = require('./Seeders/SeederManager');

// Backup
const BackupManager      = require('./Backup/BackupManager');
const BackupScheduler    = require('./Backup/BackupScheduler');
const BackupEncryption   = require('./Backup/BackupEncryption');
const BackupSocketServer = require('./Backup/BackupSocketServer');
const BackupSocketClient = require('./Backup/BackupSocketClient');

// AI (v7.0.0)
const MCPServer          = require('./AI/MCPServer');
const AISafetyGuardrails = require('./AI/AISafetyGuardrails');
const PromptGenerator    = require('./AI/PromptGenerator');

// AI (v8.0.0) — Multi-provider LLM abstraction
const AIManager             = require('./AI/AIManager');
const Ai                    = AIManager;
const AIFacade              = require('./AI/Facades/AI');
const TextBuilder           = require('./AI/Builders/TextBuilder');
const ChatProviderContract  = require('./AI/Contracts/ChatProviderContract');
const EmbeddingsProviderContract = require('./AI/Contracts/EmbeddingsProviderContract');
const ImageProviderContract = require('./AI/Contracts/ImageProviderContract');
const AudioProviderContract = require('./AI/Contracts/AudioProviderContract');
const ModelsProviderContract = require('./AI/Contracts/ModelsProviderContract');
const ToolContract          = require('./AI/Contracts/ToolContract');
const OpenAIProvider        = require('./AI/Providers/OpenAIProvider');
const OllamaProvider        = require('./AI/Providers/OllamaProvider');
const OllamaTurboProvider   = require('./AI/Providers/OllamaTurboProvider');
const ClaudeProvider        = require('./AI/Providers/ClaudeProvider');
const GeminiProvider        = require('./AI/Providers/GeminiProvider');
const GrokProvider          = require('./AI/Providers/GrokProvider');
const MistralProvider       = require('./AI/Providers/MistralProvider');
const OnnProvider           = require('./AI/Providers/OnnProvider');
const CustomOpenAIProvider  = require('./AI/Providers/CustomOpenAIProvider');
const StreamChunk           = require('./AI/Support/StreamChunk');
const Message               = require('./AI/Support/Message');
const Document              = require('./AI/Support/Document');
const ProviderError         = require('./AI/Support/Exceptions/ProviderError');
const ToolRegistry          = require('./AI/Support/ToolRegistry');
const ToolChatRunner        = require('./AI/Support/ToolChatRunner');
const SystemInfoTool        = require('./AI/Tools/SystemInfoTool');

// AI ORM Features (v8.0.0) — NL→SQL, AI Seeding, Optimization
const AIQueryBuilder        = require('./AI/AIQueryBuilder');
const AISeeder              = require('./AI/AISeeder');
const AIQueryOptimizer      = require('./AI/AIQueryOptimizer');
const AIPromptEnhancer      = require('./AI/AIPromptEnhancer');

// API Layer (v13.0.0)
const ApiLayer = require('./Api');

module.exports = {
  // Core
  Model,
  QueryBuilder,
  QueryBuilderError,
  DatabaseConnection,

  // Relations
  Relation,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  HasManyThroughRelation,
  HasOneThroughRelation,
  MorphOneRelation,
  MorphManyRelation,
  MorphToRelation,

  // Schema Builder (v5.0.0)
  Schema,
  Blueprint,
  ColumnDefinition,
  ForeignKeyDefinition,
  CheckConstraintDefinition,

  // Migrations (v5.0.0)
  Migration,
  MigrationManager,

  // Seeders
  Seeder,
  SeederManager,

  // Backup
  BackupManager,
  BackupScheduler,
  BackupEncryption,
  BackupSocketServer,
  BackupSocketClient,

  // AI (v7.0.0)
  MCPServer,
  AISafetyGuardrails,
  PromptGenerator,

  // AI (v8.0.0)
  AIManager,
  Ai,
  AIFacade,
  TextBuilder,
  ChatProviderContract,
  EmbeddingsProviderContract,
  ImageProviderContract,
  AudioProviderContract,
  ModelsProviderContract,
  ToolContract,
  OpenAIProvider,
  OllamaProvider,
  OllamaTurboProvider,
  ClaudeProvider,
  GeminiProvider,
  GrokProvider,
  MistralProvider,
  OnnProvider,
  CustomOpenAIProvider,
  StreamChunk,
  Message,
  Document,
  ProviderError,
  ToolRegistry,
  ToolChatRunner,
  SystemInfoTool,

  // AI ORM Features (v8.0.0)
  AIQueryBuilder,
  AISeeder,
  AIQueryOptimizer,
  AIPromptEnhancer,

  // DB Objects support (v11.3.0)
  IsolationLevel,
  UnsupportedCapabilityError,

  // DB Objects — Fluent API (v11.4.0)
  View,
  Trigger,
  Procedure,
  Function,
  Transaction,
  useSchema,

  // API Layer (v13.0.0)
  ...ApiLayer
};
