import { Pool } from 'pg'
import { DataSource } from 'typeorm'
import { Account } from '../model/generated/account.model'
import { Transfer } from '../model/generated/transfer.model'

// Helper to generate a random DB name
export function randomDbName() {
  return `test_db_${Math.random().toString(36).substring(2, 10)}`
}

// Postgres connection config
export const PG_CONFIG = {
  host: 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
}

// Migration script
const MigrationClass = require('../../db/migrations/1753441806659-Data.js')
const migration = new MigrationClass()

export async function setupTestDatabase() : Promise<{
  dataSource: DataSource
  cleanup: () => Promise<void>
  dbName: string
}> {
  const dbName = randomDbName()
  const pool = new Pool({ ...PG_CONFIG, database: 'postgres' })
  await pool.query(`CREATE DATABASE "${dbName}"`)

  // Connect to the new test DB
  const testPool = new Pool({ ...PG_CONFIG, database: dbName })
  await migration.up(testPool)
  await testPool.end()

  // Set up TypeORM DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: PG_CONFIG.host,
    port: PG_CONFIG.port,
    username: PG_CONFIG.user,
    password: PG_CONFIG.password,
    database: dbName,
    entities: [Account, Transfer],
    synchronize: false,
    logging: false,
  })
  await dataSource.initialize()

  async function cleanup() {
    await dataSource.destroy()
    await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`)
    await pool.end()
  }

  return { dataSource, cleanup, dbName }
} 