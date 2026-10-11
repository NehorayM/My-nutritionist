/**
 * Regenerates the current catalog seed migration (supabase/migrations/<SEED_MIGRATION>) from src/data/system-foods.json.
 * Earlier releases (003_seed_foods.sql) are applied migrations and stay untouched.
 *
 *   node scripts/generate-seed-sql.ts           write the migration (npm run seed:sql)
 *   node scripts/generate-seed-sql.ts --check   exit 1 when the committed migration is out of date
 *
 * Runs on plain Node 24 (built-in type stripping), hence relative `.ts` imports.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SYSTEM_FOOD_ROWS } from '../src/data/catalog.ts'
import { generateSeedSql, SEED_MIGRATION } from '../src/data/seedSql.ts'

const target = fileURLToPath(new URL(`../supabase/migrations/${SEED_MIGRATION}`, import.meta.url))
const sql = generateSeedSql(SYSTEM_FOOD_ROWS)

if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null
  if (current !== sql) {
    console.error(`${target} is out of date. Run: npm run seed:sql`)
    process.exitCode = 1
  } else {
    console.info(`${target} is up to date (${SYSTEM_FOOD_ROWS.length} system foods).`)
  }
} else {
  writeFileSync(target, sql, 'utf8')
  console.info(`Wrote ${SYSTEM_FOOD_ROWS.length} system foods to ${target}`)
}
