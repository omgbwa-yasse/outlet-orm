class QueryBuilderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueryBuilderError';
  }
}

module.exports = QueryBuilderError;
