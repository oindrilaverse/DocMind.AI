import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';
import * as path from 'path';

async function runMigrations() {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
