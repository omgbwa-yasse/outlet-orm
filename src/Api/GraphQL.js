'use strict';

const { Api } = require('./Api');
const { ApiError } = require('./Errors/ApiError');

/**
 * ApiGraphQL — extends Api for GraphQL endpoints.
 *
 * Usage:
 *   class User extends ApiGraphQL {
 *     static queries = { find: `query GetUser($id: ID!) { user(id: $id) { id name } }` }
 *   }
 *   User.configure({ adapter, graphqlEndpoint: '/graphql' })
 *   const user = await User.query('{ users { id name } }')
 */
class ApiGraphQL extends Api {
  // ── Configuration ──────────────────────────────────────────────────
  static get graphqlEndpoint() {
    return (this._config && this._config.graphqlEndpoint) || '/graphql';
  }

  /**
   * Execute a raw GraphQL query/mutation.
   * @param {string} queryStr
   * @param {object} [variables]
   * @returns {Promise<*>} — the parsed `data` portion of the response
   */
  static async rawQuery(queryStr, variables) {
    const adapter = this._getAdapter();
    const ep = this.graphqlEndpoint;
    const body = { query: queryStr };
    if (variables && Object.keys(variables).length) body.variables = variables;
    const response = await adapter.request('POST', ep, { body });
    if (response && response.errors && response.errors.length) {
      const err = new ApiError(response.errors[0].message || 'GraphQL error');
      err.graphqlErrors = response.errors;
      throw err;
    }
    return response && response.data !== undefined ? response.data : response;
  }

  /**
   * Execute a named query from `static queries`.
   * @param {string} queryStr — raw GQL string or name from `static queries`
   * @param {object} [variables]
   */
  static async query(queryStr, variables) {
    const gql = (this.queries && this.queries[queryStr]) || queryStr;
    return this.rawQuery(gql, variables);
  }

  /**
   * Execute a named mutation from `static mutations`.
   * @param {string} mutationStr — raw GQL string or name from `static mutations`
   * @param {object} [variables]
   */
  static async mutate(mutationStr, variables) {
    const gql = (this.mutations && this.mutations[mutationStr]) || mutationStr;
    return this.rawQuery(gql, variables);
  }

  /**
   * Build a reusable GraphQL fragment string.
   * @param {string} name
   * @param {string} on — type name
   * @param {string} body — field selection body
   * @returns {string}
   */
  static fragment(name, on, body) {
    return 'fragment ' + name + ' on ' + on + ' { ' + body + ' }';
  }

  /**
   * Subscribe to a GraphQL subscription (requires graphql-ws peer dep).
   * Falls back gracefully if graphql-ws is not available.
   *
   * @param {string} gqlStr
   * @param {object} [variables]
   * @param {object} [opts] — { wsUrl, onNext, onError, onComplete }
   * @returns {{ unsubscribe: Function }}
   */
  static subscribe(gqlStr, variables, opts) {
    opts = opts || {};
    let wsClient;
    try {
      // Optional peer dep — graceful fallback
      const { createClient } = require('graphql-ws');
      const wsUrl = opts.wsUrl || (this._config && this._config.wsUrl) || '';
      wsClient = createClient({ url: wsUrl });
    } catch (e) {
      const err = new ApiError('graphql-ws is not installed. Run: npm install graphql-ws');
      err.code = 'MISSING_PEER_DEP';
      if (opts.onError) { opts.onError(err); return { unsubscribe: () => {} }; }
      throw err;
    }
    const ModelClass = this;
    const unsubscribe = wsClient.subscribe(
      { query: gqlStr, variables: variables || {} },
      {
        next: (result) => {
          const data = result.data;
          if (opts.onNext) opts.onNext(data);
        },
        error: (err) => {
          if (opts.onError) opts.onError(err);
        },
        complete: () => {
          if (opts.onComplete) opts.onComplete();
        }
      }
    );
    return { unsubscribe };
  }

  // ── Override CRUD to use GraphQL queries/mutations ─────────────────
  static async find(id) {
    if (this.queries && this.queries.find) {
      const pk = this.primaryKey || 'id';
      const data = await this.rawQuery(this.queries.find, { [pk]: id });
      const item = Array.isArray(data) ? data[0] : (data && typeof data === 'object' ? Object.values(data)[0] : data);
      return item ? this._hydrate(item) : null;
    }
    return super.find(id);
  }

  static async all(params) {
    if (this.queries && this.queries.all) {
      const data = await this.rawQuery(this.queries.all, params || {});
      const items = Array.isArray(data) ? data : (data && typeof data === 'object' ? Object.values(data)[0] : []);
      return Array.isArray(items) ? items.map(i => this._hydrate(i)) : [];
    }
    return super.all(params);
  }

  static async get(params) {
    return this.all(params);
  }

  static async create(data) {
    if (this.mutations && this.mutations.create) {
      const responseData = await this.rawQuery(this.mutations.create, data);
      const item = Array.isArray(responseData) ? responseData[0] : (responseData && typeof responseData === 'object' ? Object.values(responseData)[0] : responseData);
      return item ? this._hydrate(item) : null;
    }
    return super.create(data);
  }
}

// Default statics
ApiGraphQL.queries    = null;
ApiGraphQL.mutations  = null;

module.exports = { ApiGraphQL };
