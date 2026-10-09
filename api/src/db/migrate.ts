import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { Pool } from 'pg';

/** Applies pending SQL migrations from ./drizzle. Used by CI/CD before a new revision goes live. */
async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
    console.log('Migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
