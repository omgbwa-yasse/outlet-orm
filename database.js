const { DatabaseConnection } = require('outlet-orm');

// Configuration de la base de données
const db = new DatabaseConnection({
  "driver": "mysql",
  "host": "1",
  "port": 3306,
  "database": "lumiere",
  "user": "root",
  "password": ""
});

module.exports = db;
