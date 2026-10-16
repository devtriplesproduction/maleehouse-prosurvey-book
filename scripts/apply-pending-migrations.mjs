/**
 * Applies pending migrations to the Supabase PostgreSQL database
 * and updates supabase_migrations.schema_migrations.
 *
 * Usage:
 *   node -r dotenv/config scripts/apply-pending-migrations.mjs dotenv_config_path=.env.local
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');

async function main() {
  console.log('\n========================================');
  console.log('1. VALIDATING SUPABASE CREDENTIALS');
  console.log('========================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbPassword = (process.env.SUPABASE_DB_PASSWORD || '').trim();

  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing in environment.');
    process.exit(1);
  }

  const urlMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = urlMatch ? urlMatch[1] : null;
  console.log(`Supabase URL:    ${supabaseUrl}`);
  console.log(`Project Ref:     ${projectRef}`);

  // 1. Test Anon Key
  if (anonKey) {
    try {
      const anonRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
      });
      if (anonRes.ok) {
        console.log('✅ Anon Key:       Valid (Auth health 200 OK)');
      } else {
        console.log(`❌ Anon Key:       Failed (HTTP ${anonRes.status}: ${await anonRes.text()})`);
      }
    } catch (err) {
      console.log(`❌ Anon Key:       Network error: ${err.message}`);
    }
  } else {
    console.log('⚠️  Anon Key:       Not set');
  }

  // 2. Test Service Role Key
  if (serviceRoleKey) {
    try {
      const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (!error) {
        console.log('✅ Service Role:   Valid (Admin API access confirmed)');
      } else {
        console.log(`❌ Service Role:   Failed (${error.message})`);
      }
    } catch (err) {
      console.log(`❌ Service Role:   Network error: ${err.message}`);
    }
  } else {
    console.log('⚠️  Service Role:   Not set');
  }

  // 3. Test Direct Postgres Connection
  if (!dbPassword || !projectRef) {
    console.error('❌ SUPABASE_DB_PASSWORD or Project Ref is missing. Cannot connect to PostgreSQL.');
    process.exit(1);
  }

  const dbHost = `db.${projectRef}.supabase.co`;
  console.log(`Connecting to PostgreSQL at ${dbHost}:5432...`);
  const client = new Client({
    host: dbHost,
    port: 5432,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ PostgreSQL DB:  Connected successfully');
  } catch (err) {
    console.error(`❌ PostgreSQL DB:  Connection failed: ${err.message}`);
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('2. CHECKING MIGRATION STATUS');
  console.log('========================================\n');

  // Ensure supabase_migrations schema and table exist
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text NOT NULL PRIMARY KEY,
      statements text[],
      name text
    );
  `);

  const migsRes = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC;');
  const appliedVersions = new Set(migsRes.rows.map(r => r.version));
  console.log(`Currently recorded in DB: ${appliedVersions.size} migrations`);

  const localFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  console.log(`Migration files on disk:  ${localFiles.length} files`);

  const pending = [];
  for (const file of localFiles) {
    const version = file.replace(/_.*$/, '');
    if (!appliedVersions.has(version) && !appliedVersions.has(file)) {
      pending.push({ file, version });
    }
  }

  if (pending.length === 0) {
    console.log('\n✨ All migrations are already applied and up to date!');
    await client.end();
    return;
  }

  console.log(`\nFound ${pending.length} pending migrations to apply:`);
  pending.forEach(p => console.log(`  - [${p.version}] ${p.file}`));

  console.log('\n========================================');
  console.log('3. APPLYING PENDING MIGRATIONS');
  console.log('========================================\n');

  for (const item of pending) {
    console.log(`Applying: ${item.file} ...`);
    const filePath = join(migrationsDir, item.file);
    const sql = readFileSync(filePath, 'utf8');

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING;',
        [item.version, item.file.replace(/\.sql$/, '')]
      );
      await client.query('COMMIT');
      console.log(`  ✅ Applied successfully: ${item.version}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ❌ ERROR applying ${item.file}:`, err.message);
      console.error('Migration aborted to protect database consistency.');
      await client.end();
      process.exit(1);
    }
  }

  console.log('\n========================================');
  console.log('4. VERIFYING APPLIED STATE');
  console.log('========================================\n');

  const finalRes = await client.query('SELECT COUNT(*) as total FROM supabase_migrations.schema_migrations;');
  console.log(`Total migrations now recorded in DB: ${finalRes.rows[0].total} / ${localFiles.length}`);

  // Quick check on the affected items
  const tableCheck = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('print_jobs', 'print_document_types', 'material_requests')
    ORDER BY table_name;
  `);
  console.log('Verified tables:', tableCheck.rows.map(r => r.table_name).join(', '));

  const settingsCheck = await client.query(`
    SELECT key FROM public.system_settings WHERE key = 'equipment_catalog';
  `);
  console.log('Verified system settings key:', settingsCheck.rows.map(r => r.key).join(', '));

  await client.end();
  console.log('\n🎉 All migrations successfully applied and verified!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
