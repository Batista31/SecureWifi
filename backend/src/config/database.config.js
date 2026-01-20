/**
 * Database Configuration
 * 
 * SQLite database setup and connection management.
 * Using better-sqlite3 for synchronous, fast database operations.
 */

const path = require('path');
const fs = require('fs');

// Ensure database directory exists

// Ensure database directory exists
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'captive_portal.db');

// Create database connection
let db;

try {
  // Try to load better-sqlite3 (Native)
  const Database = require('better-sqlite3');
  db = new Database(dbPath, {
    verbose: process.env.LOG_LEVEL === 'verbose' ? console.log : null,
  });
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  console.log('✓ Database connected (Native Mode)');
} catch (error) {
  console.warn('⚠️  Native database driver failed to load. Falling back to Mock Mode.');
  console.warn('   (Login and data persistence will NOT work, but you can view the UI)');
  console.error('   Error:', error.message);

  // Mock implementation to allow server to start
  db = {
    prepare: (sql) => ({
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      get: () => ({ count: 0 }), // Return safe defaults
      all: () => [],
    }),
    exec: () => { },
    pragma: () => { },
    transaction: (fn) => fn, // Immediate execution
  };
}

module.exports = db;
