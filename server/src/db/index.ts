import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Resolve .env path relative to this file to be robust across different execution directories
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;

// Do NOT throw error at import time if DATABASE_URL is missing.
// This prevents compilation/import-time crashes during local builds or tests when env is not set.
// A clean verification is performed during bootstrap() in index.ts.
export const pool = new Pool(
  databaseUrl ? { connectionString: databaseUrl } : undefined
);

export const db = drizzle(pool, { schema });

