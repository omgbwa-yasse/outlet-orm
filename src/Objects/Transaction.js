'use strict';

class SchemaTransaction {
  constructor(db) {
    this._db        = db || null;
    this._className = 'Transaction';
  }

  static use(dbOrSchema) {
    if (!dbOrSchema) {
      throw new TypeError('Transaction.use() requires a DatabaseConnection or Schema instance');
    }
    if (typeof dbOrSchema.beginTransaction === 'function') {
      return new SchemaTransaction(dbOrSchema);
    }
    if (typeof dbOrSchema.connection?.beginTransaction === 'function') {
      return new SchemaTransaction(dbOrSchema.connection);
    }
    throw new TypeError('Transaction.use() requires a DatabaseConnection or Schema instance');
  }

  async begin()                { this._assertBound(); return this._db.beginTransaction(); }
  async commit()               { this._assertBound(); return this._db.commit(); }
  async rollback()             { this._assertBound(); return this._db.rollback(); }
  async run(callback)          { this._assertBound(); return this._db.transaction(callback); }
  async savepoint(name)        { this._assertBound(); return this._db.savepoint(name); }
  async rollbackTo(name)       { this._assertBound(); return this._db.rollbackTo(name); }
  async releaseSavepoint(name) { this._assertBound(); return this._db.releaseSavepoint(name); }
  setIsolationLevel(level)     { this._assertBound(); return this._db.setIsolationLevel(level); }

  _assertBound() {
    if (!this._db) {
      throw new TypeError(
        `${this._className} is not bound to a connection. ` +
        `Call Transaction.use(db) first.`
      );
    }
  }
}

module.exports = SchemaTransaction;
