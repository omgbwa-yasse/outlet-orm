'use strict';

class ApiPaginator {
  constructor(rawResponse, config) {
    config = config || {};
    this._config = config;
    this._queryBuilder = config.queryBuilder || null;
    this._model = config.model || null;

    // Detect response shape and normalize
    if (rawResponse && rawResponse.next_cursor !== undefined) {
      // cursor-based: { data, next_cursor, prev_cursor, has_more }
      this._type = 'cursor';
      this.data = rawResponse.data || [];
      this.nextCursor = rawResponse.next_cursor || null;
      this.prevCursor = rawResponse.prev_cursor || null;
      this.hasMore = rawResponse.has_more !== false && !!this.nextCursor;
      this.total = null;
      this.perPage = null;
      this.currentPage = null;
      this.lastPage = null;
      this.from = null;
      this.to = null;
      this.limit = null;
      this.offset = null;

    } else if (rawResponse && rawResponse.total !== undefined && rawResponse.offset !== undefined && rawResponse.per_page === undefined && rawResponse.current_page === undefined) {
      // offset-based: { data, total, limit, offset }
      this._type = 'offset';
      this.data = rawResponse.data || [];
      this.total = rawResponse.total || 0;
      this.limit = rawResponse.limit || config.limit || 15;
      this.offset = rawResponse.offset != null ? rawResponse.offset : (config.offset || 0);
      this.hasMore = (this.offset + this.data.length) < this.total;
      this.nextCursor = null;
      this.prevCursor = null;
      this.perPage = null;
      this.currentPage = null;
      this.lastPage = null;
      this.from = this.offset + 1;
      this.to = this.offset + this.data.length;

    } else {
      // page-based: { data, total, per_page, current_page, last_page, from, to }
      this._type = 'page';
      this.data = rawResponse && rawResponse.data ? rawResponse.data : (Array.isArray(rawResponse) ? rawResponse : []);
      this.total = (rawResponse && rawResponse.total) || 0;
      this.perPage = (rawResponse && rawResponse.per_page) || config.perPage || 15;
      this.currentPage = (rawResponse && rawResponse.current_page) || config.page || 1;
      this.lastPage = (rawResponse && rawResponse.last_page) || Math.ceil(this.total / this.perPage) || 1;
      this.from = (rawResponse && rawResponse.from) || ((this.currentPage - 1) * this.perPage + 1);
      this.to = (rawResponse && rawResponse.to) || Math.min(this.currentPage * this.perPage, this.total);
      this.nextCursor = null;
      this.prevCursor = null;
      this.hasMore = this.currentPage < this.lastPage;
      this.limit = null;
      this.offset = null;
    }
  }

  hasMorePages() {
    if (this._type === 'cursor') return this.hasMore;
    if (this._type === 'offset') return this.hasMore;
    return this.currentPage < this.lastPage;
  }

  async nextPage() {
    if (this._type === 'cursor') {
      if (!this.nextCursor || !this._queryBuilder) return null;
      return this._queryBuilder.cursorPaginate({ cursor: this.nextCursor });
    }
    if (this._type === 'offset') {
      if (!this.hasMorePages() || !this._queryBuilder) return null;
      const newOffset = this.offset + this.limit;
      return this._queryBuilder.offsetPaginate({ limit: this.limit, offset: newOffset });
    }
    if (!this.hasMorePages() || !this._queryBuilder) return null;
    return this._queryBuilder.paginate(this.currentPage + 1, this.perPage);
  }

  async prevPage() {
    if (this._type === 'cursor') {
      if (!this.prevCursor || !this._queryBuilder) return null;
      return this._queryBuilder.cursorPaginate({ cursor: this.prevCursor });
    }
    if (this._type === 'offset') {
      if (this.offset <= 0 || !this._queryBuilder) return null;
      const newOffset = Math.max(0, this.offset - this.limit);
      return this._queryBuilder.offsetPaginate({ limit: this.limit, offset: newOffset });
    }
    if (this.currentPage <= 1 || !this._queryBuilder) return null;
    return this._queryBuilder.paginate(this.currentPage - 1, this.perPage);
  }

  async goToPage(n) {
    if (this._type !== 'page' || !this._queryBuilder) return null;
    return this._queryBuilder.paginate(n, this.perPage);
  }

  // Async iterator — walks through all pages
  async *[Symbol.asyncIterator]() {
    // Yield current page items
    for (const item of this.data) {
      yield this._model ? this._model._hydrate(item) : item;
    }
    // Follow next pages
    let current = this;
    while (current.hasMorePages()) {
      const next = await current.nextPage();
      if (!next) break;
      current = next;
      for (const item of current.data) {
        yield this._model ? this._model._hydrate(item) : item;
      }
    }
  }
}

module.exports = { ApiPaginator };
