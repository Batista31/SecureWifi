/**
 * Database Initialization Utility
 * 
 * Run this script to initialize the database manually:
 * node backend/src/utils/init-database.js
 */

require('dotenv').config();

const { initializeDatabase } = require('../services/database.service');

async function main() {
  console.log('Initializing database...');
  
  try {
    await initializeDatabase();
    console.log('\n✓ Database initialized successfully!\n');
    
    // Show some stats
    const db = require('../config/database.config');
    
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();
    
    console.log('Created tables:');
    tables.forEach(t => console.log(`  - ${t.name}`));
    
    const voucherCount = db.prepare('SELECT COUNT(*) as count FROM vouchers').get();
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
    
    console.log(`\nSample data:`);
    console.log(`  - Vouchers: ${voucherCount.count}`);
    console.log(`  - Admin users: ${adminCount.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

main();
