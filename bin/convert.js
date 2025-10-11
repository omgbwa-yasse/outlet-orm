#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Convertir un type SQL en type de cast JavaScript
function sqlTypeToCast(sqlType) {
  const type = sqlType.toLowerCase();

  if (type.includes('int') || type.includes('serial')) return 'int';
  if (type.includes('float') || type.includes('double') || type.includes('decimal') || type.includes('numeric')) return 'float';
  if (type.includes('bool')) return 'boolean';
  if (type.includes('json')) return 'json';
  if (type.includes('date') || type.includes('time')) return 'date';
  if (type.includes('text') || type.includes('char') || type.includes('varchar')) return 'string';

  return null;
}

// Parser une instruction CREATE TABLE
function parseCreateTable(sql) {
  const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(/i);
  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const columns = [];
  const relations = [];

  // Extraire les définitions de colonnes
  const columnRegex = /`?(\w+)`?\s+(\w+(?:\(\d+(?:,\d+)?\))?)\s*([^,]*?)(?:[,)])/gi;
  let match;

  while ((match = columnRegex.exec(sql)) !== null) {
    const [, columnName, columnType, constraints] = match;

    // Ignorer les contraintes et index
    if (columnName.toUpperCase() === 'PRIMARY' ||
        columnName.toUpperCase() === 'UNIQUE' ||
        columnName.toUpperCase() === 'KEY' ||
        columnName.toUpperCase() === 'CONSTRAINT' ||
        columnName.toUpperCase() === 'INDEX' ||
        columnName.toUpperCase() === 'FOREIGN') {
      continue;
    }

    const column = {
      name: columnName,
      type: columnType,
      nullable: !constraints.toLowerCase().includes('not null'),
      default: null,
      autoIncrement: constraints.toLowerCase().includes('auto_increment'),
      primary: constraints.toLowerCase().includes('primary key'),
      unique: constraints.toLowerCase().includes('unique')
    };

    // Extraire la valeur par défaut
    const defaultRegex = /DEFAULT\s+([^,\s]+)/i;
    const defaultMatch = defaultRegex.exec(constraints);
    if (defaultMatch) {
      column.default = defaultMatch[1].replace(/['"]/g, '');
    }

    columns.push(column);

    // Détecter les clés étrangères
    if (columnName.endsWith('_id')) {
      const relatedTable = columnName.replace(/_id$/, '') + 's';
      relations.push({
        type: 'belongsTo',
        table: relatedTable,
        foreignKey: columnName
      });
    }
  }

  // Détecter les clés étrangères explicites
  const fkRegex = /FOREIGN\s+KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/gi;
  while ((match = fkRegex.exec(sql)) !== null) {
    const [, foreignKey, referencedTable, referencedColumn] = match;

    const existingRelation = relations.find(r => r.foreignKey === foreignKey);
    if (existingRelation) {
      existingRelation.table = referencedTable;
      existingRelation.relatedKey = referencedColumn;
    } else {
      relations.push({
        type: 'belongsTo',
        table: referencedTable,
        foreignKey: foreignKey,
        relatedKey: referencedColumn
      });
    }
  }

  return { tableName, columns, relations };
}

// Analyser toutes les tables pour détecter les relations
function analyzeRelations(allTablesInfo) {
  const relationshipMap = {};

  // Initialiser la map pour chaque table
  allTablesInfo.forEach(tableInfo => {
    relationshipMap[tableInfo.tableName] = {
      belongsTo: [],
      hasMany: [],
      hasOne: [],
      belongsToMany: []
    };
  });

  // Analyser les relations belongsTo et leurs inverses
  allTablesInfo.forEach(tableInfo => {
    const { tableName, columns, relations } = tableInfo;

    relations.forEach(rel => {
      if (rel.type === 'belongsTo') {
        // Ajouter la relation belongsTo
        relationshipMap[tableName].belongsTo.push(rel);

        // Détecter la relation inverse (hasMany ou hasOne)
        const foreignKey = rel.foreignKey;
        const relatedTable = rel.table;

        // Vérifier si c'est une relation hasOne (clé unique) ou hasMany
        const foreignColumn = columns.find(col => col.name === foreignKey);
        const isUnique = foreignColumn?.unique;

        if (isUnique) {
          // Relation hasOne inverse
          relationshipMap[relatedTable].hasOne.push({
            table: tableName,
            foreignKey: foreignKey,
            localKey: rel.relatedKey || 'id'
          });
        } else {
          // Relation hasMany inverse
          relationshipMap[relatedTable].hasMany.push({
            table: tableName,
            foreignKey: foreignKey,
            localKey: rel.relatedKey || 'id'
          });
        }
      }
    });
  });

  // Détecter les tables pivot pour relations belongsToMany
  allTablesInfo.forEach(tableInfo => {
    const { tableName, columns } = tableInfo;

    // Une table pivot typique a:
    // - Pas de clé primaire auto-increment OU clé primaire composite
    // - Exactement 2 clés étrangères
    // - Peu ou pas d'autres colonnes (sauf timestamps)
    const foreignKeys = columns.filter(col => col.name.endsWith('_id'));
    const nonForeignNonTimestamp = columns.filter(col =>
      !col.name.endsWith('_id') &&
      col.name !== 'id' &&
      col.name !== 'created_at' &&
      col.name !== 'updated_at'
    );

    const isPivotTable = foreignKeys.length === 2 && nonForeignNonTimestamp.length === 0;

    if (isPivotTable) {
      const [fk1, fk2] = foreignKeys;
      const table1 = fk1.name.replace(/_id$/, '') + 's';
      const table2 = fk2.name.replace(/_id$/, '') + 's';

      // Ajouter la relation belongsToMany pour les deux tables
      if (relationshipMap[table1] && relationshipMap[table2]) {
        relationshipMap[table1].belongsToMany.push({
          table: table2,
          pivotTable: tableName,
          foreignPivotKey: fk1.name,
          relatedPivotKey: fk2.name
        });

        relationshipMap[table2].belongsToMany.push({
          table: table1,
          pivotTable: tableName,
          foreignPivotKey: fk2.name,
          relatedPivotKey: fk1.name
        });
      }
    }
  });

  return relationshipMap;
}

// Générer le code du modèle
function generateModel(tableInfo, relationshipMap, options = {}) {
  const { tableName, columns } = tableInfo;

  // Nom de classe (PascalCase, singulier)
  const className = tableName
    .replace(/_/g, ' ')
    .replace(/s$/, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  // Colonnes fillable (exclure id, timestamps, clés étrangères si demandé)
  const fillable = columns
    .filter(col => {
      if (col.name === 'id') return false;
      if (col.name === 'created_at' || col.name === 'updated_at') return false;
      if (options.excludeForeignKeys && col.name.endsWith('_id')) return false;
      return true;
    })
    .map(col => col.name);

  // Colonnes hidden (password, token, secret, etc.)
  const hidden = columns
    .filter(col => {
      const name = col.name.toLowerCase();
      return name.includes('password') ||
             name.includes('token') ||
             name.includes('secret') ||
             name.includes('api_key');
    })
    .map(col => col.name);

  // Casts
  const casts = {};
  columns.forEach(col => {
    const cast = sqlTypeToCast(col.type);
    if (cast && cast !== 'string') {
      casts[col.name] = cast;
    }
  });

  // Timestamps
  const hasTimestamps = columns.some(col => col.name === 'created_at') &&
                        columns.some(col => col.name === 'updated_at');

  // Clé primaire
  const primaryKey = columns.find(col => col.primary)?.name || 'id';

  // Générer le code
  let code = `const { Model } = require('outlet-orm');\n\n`;

  // Imports des modèles liés
  const relatedModels = new Set();

  // Obtenir toutes les relations pour cette table
  const allRelations = relationshipMap[tableName] || {
    belongsTo: [],
    hasMany: [],
    hasOne: [],
    belongsToMany: []
  };

  // Collecter tous les modèles liés
  [...allRelations.belongsTo, ...allRelations.hasMany, ...allRelations.hasOne, ...allRelations.belongsToMany].forEach(rel => {
    const relatedClassName = rel.table
      .replace(/_/g, ' ')
      .replace(/s$/, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    relatedModels.add(relatedClassName);
  });

  if (relatedModels.size > 0) {
    code += `// Importer les modèles liés\n`;
    relatedModels.forEach(model => {
      code += `// const ${model} = require('./${model}');\n`;
    });
    code += `\n`;
  }

  code += `class ${className} extends Model {\n`;
  code += `  static table = '${tableName}';\n`;

  if (primaryKey !== 'id') {
    code += `  static primaryKey = '${primaryKey}';\n`;
  }

  code += `  static timestamps = ${hasTimestamps};\n`;

  if (fillable.length > 0) {
    code += `  static fillable = [\n`;
    fillable.forEach((col, i) => {
      code += `    '${col}'${i < fillable.length - 1 ? ',' : ''}\n`;
    });
    code += `  ];\n`;
  }

  if (hidden.length > 0) {
    code += `  static hidden = [\n`;
    hidden.forEach((col, i) => {
      code += `    '${col}'${i < hidden.length - 1 ? ',' : ''}\n`;
    });
    code += `  ];\n`;
  }

  if (Object.keys(casts).length > 0) {
    code += `  static casts = {\n`;
    Object.entries(casts).forEach(([col, type], i, arr) => {
      code += `    ${col}: '${type}'${i < arr.length - 1 ? ',' : ''}\n`;
    });
    code += `  };\n`;
  }

  // Relations
  const hasRelations = allRelations.belongsTo.length > 0 ||
                       allRelations.hasMany.length > 0 ||
                       allRelations.hasOne.length > 0 ||
                       allRelations.belongsToMany.length > 0;

  if (hasRelations) {
    code += `\n  // Relations\n`;

    // Relations belongsTo
    allRelations.belongsTo.forEach(rel => {
      const relatedClassName = rel.table
        .replace(/_/g, ' ')
        .replace(/s$/, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      const methodName = rel.table.replace(/_/g, '').replace(/s$/, '');

      code += `  ${methodName}() {\n`;
      code += `    return this.belongsTo(${relatedClassName}, '${rel.foreignKey}'`;
      if (rel.relatedKey && rel.relatedKey !== 'id') {
        code += `, '${rel.relatedKey}'`;
      }
      code += `);\n`;
      code += `  }\n\n`;
    });

    // Relations hasMany
    allRelations.hasMany.forEach(rel => {
      const relatedClassName = rel.table
        .replace(/_/g, ' ')
        .replace(/s$/, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      const methodName = rel.table.replace(/_/g, '');

      code += `  ${methodName}() {\n`;
      code += `    return this.hasMany(${relatedClassName}, '${rel.foreignKey}'`;
      if (rel.localKey && rel.localKey !== 'id') {
        code += `, '${rel.localKey}'`;
      }
      code += `);\n`;
      code += `  }\n\n`;
    });

    // Relations hasOne
    allRelations.hasOne.forEach(rel => {
      const relatedClassName = rel.table
        .replace(/_/g, ' ')
        .replace(/s$/, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      const methodName = rel.table.replace(/_/g, '').replace(/s$/, '');

      code += `  ${methodName}() {\n`;
      code += `    return this.hasOne(${relatedClassName}, '${rel.foreignKey}'`;
      if (rel.localKey && rel.localKey !== 'id') {
        code += `, '${rel.localKey}'`;
      }
      code += `);\n`;
      code += `  }\n\n`;
    });

    // Relations belongsToMany
    allRelations.belongsToMany.forEach(rel => {
      const relatedClassName = rel.table
        .replace(/_/g, ' ')
        .replace(/s$/, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      const methodName = rel.table.replace(/_/g, '');

      code += `  ${methodName}() {\n`;
      code += `    return this.belongsToMany(${relatedClassName}, '${rel.pivotTable}', '${rel.foreignPivotKey}', '${rel.relatedPivotKey}');\n`;
      code += `  }\n\n`;
    });
  }

  code += `}\n\n`;
  code += `module.exports = ${className};\n`;

  return { className, code };
}

// Convertir un fichier SQL
async function convertFromFile() {
  const sqlFile = await question('Chemin du fichier SQL: ');

  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ Fichier non trouvé: ${sqlFile}`);
    rl.close();
    return;
  }

  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Extraire toutes les instructions CREATE TABLE
  const createTableRegex = /CREATE\s+TABLE\s+.*?;/gis;
  const tables = sqlContent.match(createTableRegex) || [];

  if (tables.length === 0) {
    console.error('❌ Aucune instruction CREATE TABLE trouvée');
    rl.close();
    return;
  }

  console.log(`\n✅ ${tables.length} table(s) trouvée(s)\n`);

  const outputDir = await question('Dossier de sortie pour les modèles (défaut: ./models): ') || './models';

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const excludeFk = await question('Exclure les clés étrangères de fillable? (o/N): ');
  const options = {
    excludeForeignKeys: excludeFk.toLowerCase() === 'o' || excludeFk.toLowerCase() === 'y'
  };

  // Parser toutes les tables
  const allTablesInfo = [];
  tables.forEach(sql => {
    const tableInfo = parseCreateTable(sql);
    if (tableInfo) {
      allTablesInfo.push(tableInfo);
    }
  });

  // Analyser les relations entre toutes les tables
  console.log('\n🔍 Analyse des relations...\n');
  const relationshipMap = analyzeRelations(allTablesInfo);

  // Générer les modèles avec toutes les relations
  allTablesInfo.forEach(tableInfo => {
    const { className, code } = generateModel(tableInfo, relationshipMap, options);
    const filename = path.join(outputDir, `${className}.js`);

    fs.writeFileSync(filename, code);

    // Afficher les relations trouvées
    const relations = relationshipMap[tableInfo.tableName];
    const relationCount = relations.belongsTo.length + relations.hasMany.length +
                         relations.hasOne.length + relations.belongsToMany.length;

    console.log(`✅ ${className}.js (${relationCount} relation${relationCount > 1 ? 's' : ''})`);
  });

  console.log(`\n✨ Conversion terminée! ${allTablesInfo.length} modèle(s) créé(s) dans ${outputDir}\n`);
  rl.close();
}

// Récupérer la configuration de la base de données depuis l'utilisateur
async function getDatabaseConfig() {
  const driver = await question('Driver (mysql/postgres/sqlite): ');
  const dbConfig = { driver };

  if (driver === 'mysql') {
    dbConfig.host = await question('Host (défaut: localhost): ') || 'localhost';
    dbConfig.port = await question('Port (défaut: 3306): ') || 3306;
    dbConfig.database = await question('Database: ');
    dbConfig.user = await question('User: ');
    dbConfig.password = await question('Password: ');
  } else if (driver === 'postgres' || driver === 'postgresql') {
    dbConfig.host = await question('Host (défaut: localhost): ') || 'localhost';
    dbConfig.port = await question('Port (défaut: 5432): ') || 5432;
    dbConfig.database = await question('Database: ');
    dbConfig.user = await question('User: ');
    dbConfig.password = await question('Password: ');
  } else if (driver === 'sqlite') {
    dbConfig.filename = await question('Chemin du fichier SQLite: ');
  } else {
    throw new Error('Driver non supporté');
  }

  return dbConfig;
}

// Récupérer la liste des tables depuis la base de données
async function fetchTablesList(connection, driver) {
  let tables = [];

  if (driver === 'mysql') {
    const result = await connection.query('SHOW TABLES');
    const key = Object.keys(result[0])[0];
    tables = result.map(row => row[key]);
  } else if (driver === 'postgres' || driver === 'postgresql') {
    const result = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    tables = result.map(row => row.table_name);
  } else if (driver === 'sqlite') {
    const result = await connection.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    tables = result.map(row => row.name);
  }

  return tables;
}

// Récupérer le CREATE TABLE pour une table donnée
async function fetchCreateTableSql(connection, driver, tableName) {
  let createTableSql = '';

  if (driver === 'mysql') {
    const result = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
    createTableSql = result[0]['Create Table'];
  } else if (driver === 'postgres' || driver === 'postgresql') {
    // Pour PostgreSQL, construire le CREATE TABLE depuis information_schema
    const columns = await connection.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position
    `);

    createTableSql = `CREATE TABLE ${tableName} (\n`;
    columns.forEach((col, i) => {
      createTableSql += `  ${col.column_name} ${col.data_type}`;
      if (col.is_nullable === 'NO') createTableSql += ' NOT NULL';
      if (col.column_default) createTableSql += ` DEFAULT ${col.column_default}`;
      if (i < columns.length - 1) createTableSql += ',';
      createTableSql += '\n';
    });
    createTableSql += ');';
  } else if (driver === 'sqlite') {
    const result = await connection.query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
    createTableSql = result[0].sql;
  }

  return createTableSql;
}

// Convertir depuis une base de données connectée
async function convertFromDatabase() {
  console.log('\n📊 Conversion depuis une base de données\n');

  try {
    // Récupérer la configuration
    const dbConfig = await getDatabaseConfig();

    // Connexion à la base de données
    const { DatabaseConnection } = require('../src/index.js');
    const connection = new DatabaseConnection(dbConfig);

    console.log('\n🔄 Connexion à la base de données...');
    await connection.connect();
    console.log('✅ Connecté!\n');

    // Récupérer la liste des tables
    const tables = await fetchTablesList(connection, dbConfig.driver);

    if (tables.length === 0) {
      console.error('❌ Aucune table trouvée');
      await connection.close();
      rl.close();
      return;
    }

    console.log(`✅ ${tables.length} table(s) trouvée(s):\n`);
    tables.forEach((table, i) => console.log(`  ${i + 1}. ${table}`));
    console.log('');

    const outputDir = await question('Dossier de sortie pour les modèles (défaut: ./models): ') || './models';

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const excludeFk = await question('Exclure les clés étrangères de fillable? (o/N): ');
    const options = {
      excludeForeignKeys: excludeFk.toLowerCase() === 'o' || excludeFk.toLowerCase() === 'y'
    };

    // Parser toutes les tables
    console.log('\n🔍 Récupération des schémas...\n');
    const allTablesInfo = [];

    // Pour chaque table, récupérer le CREATE TABLE
    for (const tableName of tables) {
      const createTableSql = await fetchCreateTableSql(connection, dbConfig.driver, tableName);
      const tableInfo = parseCreateTable(createTableSql);
      if (tableInfo) {
        allTablesInfo.push(tableInfo);
      }
    }

    // Analyser les relations entre toutes les tables
    console.log('🔍 Analyse des relations...\n');
    const relationshipMap = analyzeRelations(allTablesInfo);

    // Générer les modèles avec toutes les relations
    allTablesInfo.forEach(tableInfo => {
      const { className, code } = generateModel(tableInfo, relationshipMap, options);
      const filename = path.join(outputDir, `${className}.js`);

      fs.writeFileSync(filename, code);

      // Afficher les relations trouvées
      const relations = relationshipMap[tableInfo.tableName];
      const relationCount = relations.belongsTo.length + relations.hasMany.length +
                           relations.hasOne.length + relations.belongsToMany.length;

      console.log(`✅ ${className}.js (${relationCount} relation${relationCount > 1 ? 's' : ''})`);
    });

    console.log(`\n✨ Conversion terminée! ${allTablesInfo.length} modèle(s) créé(s) dans ${outputDir}\n`);

    await connection.close();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.message === 'Driver non supporté') {
      rl.close();
      return;
    }
  }

  rl.close();
}

// Menu principal
async function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  Outlet ORM - Convertisseur SQL      ║');
  console.log('╚═══════════════════════════════════════╝\n');

  console.log('Choisissez une option:\n');
  console.log('  1. Convertir depuis un fichier SQL');
  console.log('  2. Convertir depuis une base de données connectée');
  console.log('  3. Quitter\n');

  const choice = await question('Votre choix: ');

  switch (choice) {
    case '1':
      await convertFromFile();
      break;
    case '2':
      await convertFromDatabase();
      break;
    case '3':
      console.log('Au revoir! 👋\n');
      rl.close();
      break;
    default:
      console.log('❌ Choix invalide\n');
      rl.close();
  }
}

main().catch(error => {
  console.error('❌ Erreur:', error.message);
  rl.close();
});
