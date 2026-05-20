const Migration = require('outlet-orm').Migration || require('outlet-orm');

class UpdateAiUsageLogsTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.table('ai_usage_logs', (table) => {
      table.string('provider', 50).default('').after('user_id');
      table.string('model', 100).default('').after('provider');
      table.enum('usage_type', ['chat', 'embedding', 'image', 'audio', 'vision']).default('chat').after('model');
      table.decimal('cost_usd', 10, 8).default(0).after('tokens_output');
      table.boolean('is_cached').default(false).after('cost_usd');
    });

    await this.dropNamedForeignIfExists('ai_usage_logs', 'fk_aul_provider');
    await this.dropNamedForeignIfExists('ai_usage_logs', 'fk_aul_model');
    await this.dropNamedForeignIfExists('ai_usage_logs', 'fk_aul_conversation');

    await schema.table('ai_usage_logs', (table) => {
      table.dropColumn('provider_id');
      table.dropColumn('model_id');
      table.dropColumn('request_type');
      table.dropColumn('conversation_id');
      table.dropColumn('tokens_total');
      table.dropColumn('estimated_cost');
      table.dropColumn('status');
      table.dropColumn('error_message');
    });
  }

  async down() {
    const schema = this.getSchema();

    await schema.table('ai_usage_logs', (table) => {
      table.bigInteger('provider_id').unsigned().nullable().after('user_id');
      table.bigInteger('model_id').unsigned().nullable().after('provider_id');
      table.enum('request_type', ['chat', 'completion', 'embedding', 'image', 'audio']).default('chat').after('model_id');
      table.bigInteger('conversation_id').unsigned().nullable().after('request_type');
      table.integer('tokens_total').unsigned().default(0).after('tokens_output');
      table.decimal('estimated_cost', 10, 6).default(0).after('tokens_total');
      table.enum('status', ['success', 'error', 'timeout', 'rate_limited']).default('success').after('response_time_ms');
      table.text('error_message').nullable().after('status');
    });

    await schema.table('ai_usage_logs', (table) => {
      table.foreign('provider_id').references('id').on('ai_providers').onDelete('CASCADE').name('fk_aul_provider');
      table.foreign('model_id').references('id').on('ai_provider_models').onDelete('SET NULL').name('fk_aul_model');
      table.foreign('conversation_id').references('id').on('ai_conversations').onDelete('SET NULL').name('fk_aul_conversation');
    });

    await schema.table('ai_usage_logs', (table) => {
      table.dropColumn('provider');
      table.dropColumn('model');
      table.dropColumn('usage_type');
      table.dropColumn('cost_usd');
      table.dropColumn('is_cached');
    });
  }
}

module.exports = UpdateAiUsageLogsTable;
