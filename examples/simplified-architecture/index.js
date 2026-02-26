'use strict';

/**
 * Simplified Architecture Example — Express App Entry Point
 *
 * This example demonstrates the outlet-orm 2-layer architecture:
 *
 *   HTTP Request → Routes → Middlewares → Controllers → Models (outlet-orm) → DB
 *
 * No services/ or repositories/ directories are used.
 * All business logic is handled directly in the controllers.
 *
 * Usage:
 *   cp .env.example .env        # configure DB credentials
 *   npm install
 *   node index.js
 */

require('dotenv').config();

const express = require('express');
const { DatabaseConnection } = require('outlet-orm');
const router = require('./routes/index');

// ──────────────────────────────────────────────
//  Database connection (outlet-orm)
// ──────────────────────────────────────────────
const db = new DatabaseConnection({
  driver: process.env.DB_DRIVER || 'sqlite',
  filename: process.env.DB_FILE || ':memory:',      // SQLite (demo)
  // For MySQL / PostgreSQL, set these in .env:
  // host: process.env.DB_HOST,
  // port: process.env.DB_PORT,
  // user: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,
  // database: process.env.DB_NAME,
});

const { Model } = require('outlet-orm');
Model.setConnection(db);

// ──────────────────────────────────────────────
//  Express app
// ──────────────────────────────────────────────
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Mount all routes under /api/v1
app.use('/api/v1', router);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ──────────────────────────────────────────────
//  Start server
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[outlet-orm simplified example] Server running on http://localhost:${PORT}`);
  console.log('Architecture: Controllers ↔ Models (2-layer, no Services/Repositories)');
});

module.exports = app;
