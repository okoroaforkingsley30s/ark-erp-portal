import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const migrationDirectory = path.resolve('supabase/migrations')
const migrationPattern = /^(\d{12})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/
const files = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort()

const failures = []
const timestamps = new Map()

if (files.length === 0) failures.push('No SQL migrations were found.')

for (const [index, file] of files.entries()) {
  const match = migrationPattern.exec(file)
  if (!match) {
    failures.push(`${file}: expected YYYYMMDDHHMM_description.sql naming.`)
    continue
  }

  const [, timestamp] = match
  if (timestamps.has(timestamp)) {
    failures.push(`${file}: duplicate timestamp also used by ${timestamps.get(timestamp)}.`)
  }
  timestamps.set(timestamp, file)

  if (index > 0 && file.localeCompare(files[index - 1]) <= 0) {
    failures.push(`${file}: migration ordering is not strictly increasing.`)
  }

  const sql = await readFile(path.join(migrationDirectory, file), 'utf8')
  if (!sql.trim()) failures.push(`${file}: migration is empty.`)
  if (sql.includes('\0')) failures.push(`${file}: contains NUL bytes.`)
  if (sql.charCodeAt(0) === 0xfeff) failures.push(`${file}: contains a UTF-8 BOM.`)
  if (/\b(drop\s+database|drop\s+schema\s+public\s+cascade)\b/i.test(sql)) {
    failures.push(`${file}: contains a prohibited destructive database operation.`)
  }
  if (/\b(auth|storage)\.[a-z_]+\b/i.test(sql) && !/set\s+search_path\s*=/i.test(sql) && /security\s+definer/i.test(sql)) {
    failures.push(`${file}: SECURITY DEFINER code using Auth/Storage must set search_path.`)
  }
}

if (failures.length) {
  console.error(`Migration validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Validated ${files.length} ordered Supabase migrations.`)
