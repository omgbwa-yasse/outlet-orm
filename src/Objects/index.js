'use strict';
const View        = require('./View');
const Trigger     = require('./Trigger');
const Procedure   = require('./Procedure');
const Function    = require('./Function');
const Transaction = require('./Transaction');

/**
 * Bind all five DB object builder classes to a Schema or DatabaseConnection.
 *
 * @param {Schema|DatabaseConnection} schemaOrDb
 * @returns {{ View: View, Trigger: Trigger, Procedure: Procedure, Function: Function, Transaction: Transaction }}
 */
function useSchema(schemaOrDb) {
  return {
    View:        View.use(schemaOrDb),
    Trigger:     Trigger.use(schemaOrDb),
    Procedure:   Procedure.use(schemaOrDb),
    Function:    Function.use(schemaOrDb),
    Transaction: Transaction.use(schemaOrDb)
  };
}

module.exports = {

  // Noms courts (rétrocompatibilité)
  View,
  Trigger,
  Procedure,
  Function,
  Transaction,

  // Série harmonisée Schema*
  SchemaView:        View,
  SchemaTrigger:     Trigger,
  SchemaProcedure:   Procedure,
  SchemaFunction:    Function,
  SchemaTransaction: Transaction,
  useSchema
};
