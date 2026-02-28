const Model = require('./Model');
const QueryBuilder = require('./QueryBuilder');
const DatabaseConnection = require('./DatabaseConnection');

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
const { Schema, Blueprint, ColumnDefinition, ForeignKeyDefinition } = require('./Schema/Schema');
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

// AI Bridge (v8.0.0) — Multi-provider LLM abstraction
const AiBridgeManager       = require('./AI/Bridge/AiBridgeManager');
const TextBuilder           = require('./AI/Bridge/Builders/TextBuilder');
const ChatProviderContract  = require('./AI/Bridge/Contracts/ChatProviderContract');
const EmbeddingsProviderContract = require('./AI/Bridge/Contracts/EmbeddingsProviderContract');
const ImageProviderContract = require('./AI/Bridge/Contracts/ImageProviderContract');
const AudioProviderContract = require('./AI/Bridge/Contracts/AudioProviderContract');
const ModelsProviderContract = require('./AI/Bridge/Contracts/ModelsProviderContract');
const ToolContract          = require('./AI/Bridge/Contracts/ToolContract');
const OpenAIProvider        = require('./AI/Bridge/Providers/OpenAIProvider');
const OllamaProvider        = require('./AI/Bridge/Providers/OllamaProvider');
const OllamaTurboProvider   = require('./AI/Bridge/Providers/OllamaTurboProvider');
const ClaudeProvider        = require('./AI/Bridge/Providers/ClaudeProvider');
const GeminiProvider        = require('./AI/Bridge/Providers/GeminiProvider');
const GrokProvider          = require('./AI/Bridge/Providers/GrokProvider');
const MistralProvider       = require('./AI/Bridge/Providers/MistralProvider');
const OnnProvider           = require('./AI/Bridge/Providers/OnnProvider');
const CustomOpenAIProvider  = require('./AI/Bridge/Providers/CustomOpenAIProvider');
const StreamChunk           = require('./AI/Bridge/Support/StreamChunk');
const Message               = require('./AI/Bridge/Support/Message');
const Document              = require('./AI/Bridge/Support/Document');
const ProviderError         = require('./AI/Bridge/Support/ProviderError');
const ToolRegistry          = require('./AI/Bridge/Support/ToolRegistry');
const ToolChatRunner        = require('./AI/Bridge/Support/ToolChatRunner');
const SystemInfoTool        = require('./AI/Bridge/Tools/SystemInfoTool');

// AI ORM Features (v8.0.0) — NL→SQL, AI Seeding, Optimization
const AIQueryBuilder        = require('./AI/AIQueryBuilder');
const AISeeder              = require('./AI/AISeeder');
const AIQueryOptimizer      = require('./AI/AIQueryOptimizer');
const AIPromptEnhancer      = require('./AI/AIPromptEnhancer');

module.exports = {
  // Core
  Model,
  QueryBuilder,
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

  // AI Bridge (v8.0.0)
  AiBridgeManager,
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
  AIPromptEnhancer
};
