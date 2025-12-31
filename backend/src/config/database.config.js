/**
 * Database Configuration
 * 
 * SQLite database setup and connection management.
 * Using better-sqlite3 for synchronous, fast database operations.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'captive_portal.db');

// Create database connection
const db = new Database(dbPath, {
  verbose: process.env.LOG_LEVEL === 'verbose' ? console.log : null,
});

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

module.exports = db;
