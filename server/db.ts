//import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as ws from "ws";
import * as schema from "@shared/schema";
import { retryDatabaseOperation } from "./db-utils";
//import "dotenv/config";
import pkg from 'pg';
const { Pool } = pkg;
import "dotenv/config"; 

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: 'postgresql://curauser24nov25:cura_123@185.185.126.58:5432/Cura24nov2025',
  max: 10, // Maximum number of connections in pool
  idleTimeoutMillis: 10000, // 10 seconds idle timeout
  maxUses: 7500, // Maximum uses per connection before renewal
  allowExitOnIdle: false
});

// Set search_path to include user schema for pharmacy tables
pool.on('connect', (client: any) => {
  client.query('SET search_path TO public, curauser24nov25');
});

// One-time migration: Add recipients column to message_campaigns if missing
(async () => {
  try {
    await pool.query(`
      ALTER TABLE message_campaigns 
      ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT '[]'::jsonb
    `);
    console.log('✅ Database migration: recipients column ensured in message_campaigns');
  } catch (err: any) {
    console.warn('⚠️ Migration warning (recipients column):', err?.message || err);
  }
})();

// Wrap pool.query with retry logic to handle transient connection errors
const originalQuery = pool.query.bind(pool);
pool.query = ((...args: any[]) => {
  return retryDatabaseOperation(
    () => originalQuery(...args), 
    'SQL query'
  );
}) as typeof pool.query;

// Add pool error listener to prevent crashes from unhandled pool errors
pool.on('error', (err: any) => {
  console.warn('[DB_POOL_ERROR]', err?.code || err?.message || 'Unknown pool error');
});

// Add global unhandled rejection handler to prevent crashes during investigation
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[UNHANDLED_REJECTION]', reason?.message || reason, promise);
  // Don't exit the process, just log the error
});

export const db = drizzle({ client: pool, schema });

// Ensure treatments table exists with expected schema
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS treatments (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        name TEXT NOT NULL,
        color_code VARCHAR(7) NOT NULL DEFAULT '#2563eb',
        base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
        version INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by INTEGER NOT NULL REFERENCES users(id),
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ Ensured treatments table exists');
  } catch (error: any) {
    console.warn('⚠️ Unable to ensure treatments table:', error?.message || error);
  }
})();

// Ensure appointments has new type/ID columns
(async () => {
  try {
    await pool.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(20) NOT NULL DEFAULT 'consultation',
      ADD COLUMN IF NOT EXISTS treatment_id INTEGER,
      ADD COLUMN IF NOT EXISTS consultation_id INTEGER
    `);
    console.log('✅ Ensured appointments columns appointment_type, treatment_id, consultation_id exist');
  } catch (error: any) {
    console.warn('⚠️ Unable to ensure appointments columns:', error?.message || error);
  }
})();

// Add missing columns if they don't exist
(async () => {
  try {
    await pool.query(`
      ALTER TABLE treatments
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
    console.log('✅ Ensured treatments columns notes + metadata exist');
  } catch (error: any) {
    console.warn('⚠️ Unable to ensure treatments columns:', error?.message || error);
  }
})();
