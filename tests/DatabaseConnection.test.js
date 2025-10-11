const DatabaseConnection = require('../src/DatabaseConnection');

describe('DatabaseConnection', () => {
  describe('Query Building', () => {
    let connection;

    beforeEach(() => {
      connection = new DatabaseConnection({ driver: 'mysql' });
    });

    test('should build SELECT query', () => {
      const query = {
        columns: ['id', 'name'],
        wheres: [
          { column: 'age', operator: '>', value: 18, type: 'basic', boolean: 'and' }
        ],
        orders: [
          { column: 'name', direction: 'asc' }
        ],
        limit: 10,
        offset: 0
      };

      const { sql, params } = connection.buildSelectQuery('users', query);
      
      expect(sql).toContain('SELECT id, name FROM users');
      expect(sql).toContain('WHERE age > ?');
      expect(sql).toContain('ORDER BY name ASC');
      expect(sql).toContain('LIMIT 10');
      expect(params).toEqual([18]);
    });

    test('should build WHERE IN clause', () => {
      const wheres = [
        { column: 'id', values: [1, 2, 3], type: 'in', boolean: 'and' }
      ];

      const { whereClause, params } = connection.buildWhereClause(wheres);
      
      expect(whereClause).toContain('WHERE id IN (?, ?, ?)');
      expect(params).toEqual([1, 2, 3]);
    });

    test('should build WHERE NULL clause', () => {
      const wheres = [
        { column: 'deleted_at', type: 'null', boolean: 'and' }
      ];

      const { whereClause } = connection.buildWhereClause(wheres);
      
      expect(whereClause).toContain('WHERE deleted_at IS NULL');
    });

    test('should build multiple WHERE clauses', () => {
      const wheres = [
        { column: 'age', operator: '>', value: 18, type: 'basic', boolean: 'and' },
        { column: 'status', operator: '=', value: 'active', type: 'basic', boolean: 'and' }
      ];

      const { whereClause, params } = connection.buildWhereClause(wheres);
      
      expect(whereClause).toContain('WHERE age > ?');
      expect(whereClause).toContain('AND status = ?');
      expect(params).toEqual([18, 'active']);
    });
  });

  describe('Placeholder Conversion', () => {
    test('should convert to PostgreSQL placeholders', () => {
      const connection = new DatabaseConnection({ driver: 'postgres' });
      const sql = 'SELECT * FROM users WHERE age > ? AND status = ?';
      const converted = connection.convertToDriverPlaceholder(sql, 'postgres');
      
      expect(converted).toBe('SELECT * FROM users WHERE age > $1 AND status = $2');
    });

    test('should keep MySQL placeholders', () => {
      const connection = new DatabaseConnection({ driver: 'mysql' });
      const sql = 'SELECT * FROM users WHERE age > ? AND status = ?';
      const converted = connection.convertToDriverPlaceholder(sql);
      
      expect(converted).toBe(sql);
    });
  });

  describe('Placeholders', () => {
    test('should generate correct number of placeholders', () => {
      const connection = new DatabaseConnection({ driver: 'mysql' });
      const placeholders = connection.getPlaceholders(3);
      
      expect(placeholders).toBe('?, ?, ?');
    });
  });
});
