/**
 * Database Configuration
 * 
 * SQLite database using sql.js (pure JavaScript/WebAssembly).
 * This works on all platforms including Raspberry Pi ARM64.
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'captive_portal.db');

// Database instance
let db = null;
let SQL = null;

/**
 * Initialize database (must be called before using db)
 */
async function initDatabase() {
  if (db) return db;

  try {
    // Initialize sql.js
    SQL = await initSqlJs();

    // Load existing database file if it exists
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('✓ Database loaded from file (sql.js)');
    } else {
      // Create new database
      db = new SQL.Database();
      console.log('✓ New database created (sql.js)');
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Save database to file
 */
function saveDatabase() {
  if (!db) return;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

// Auto-save every 30 seconds
setInterval(saveDatabase, 30000);

// Save on process exit
process.on('exit', saveDatabase);
process.on('SIGINT', () => {
  saveDatabase();
  process.exit();
});
process.on('SIGTERM', () => {
  saveDatabase();
  process.exit();
});

/**
 * Wrapper to provide better-sqlite3 compatible API
 */
const dbWrapper = {
  /**
   * Prepare a statement (returns object with run, get, all methods)
   */
  prepare(sql) {
    return {
      run(...params) {
        if (!db) throw new Error('Database not initialized');
        try {
          db.run(sql, params);
          saveDatabase(); // Save after write operations
          return { changes: db.getRowsModified(), lastInsertRowid: 0 };
        } catch (error) {
          console.error('SQL run error:', error.message, 'SQL:', sql);
          return { changes: 0, lastInsertRowid: 0 };
        }
      },
      get(...params) {
        if (!db) return undefined;
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
          }
          stmt.free();
          return undefined;
        } catch (error) {
          console.error('SQL get error:', error.message, 'SQL:', sql);
          return undefined;
        }
      },
      all(...params) {
        if (!db) return [];
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (error) {
          console.error('SQL all error:', error.message, 'SQL:', sql);
          return [];
        }
      },
    };
  },

  /**
   * Execute SQL directly (for schema creation, etc.)
   */
  exec(sql) {
    if (!db) throw new Error('Database not initialized');
    try {
      db.run(sql);
      saveDatabase();
    } catch (error) {
      console.error('SQL exec error:', error.message);
    }
  },

  /**
   * Pragma commands
   */
  pragma(pragma) {
    if (!db) return;
    try {
      db.run(`PRAGMA ${pragma}`);
    } catch (error) {
      // Ignore pragma errors
    }
  },

  /**
   * Transaction wrapper
   */
  transaction(fn) {
    return (...args) => {
      if (!db) throw new Error('Database not initialized');
      try {
        db.run('BEGIN TRANSACTION');
        const result = fn(...args);
        db.run('COMMIT');
        saveDatabase();
        return result;
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    };
  },

  /**
   * Check if database is initialized
   */
  get isInitialized() {
    return db !== null;
  },
};

module.exports = dbWrapper;
module.exports.initDatabase = initDatabase;
module.exports.saveDatabase = saveDatabase;
