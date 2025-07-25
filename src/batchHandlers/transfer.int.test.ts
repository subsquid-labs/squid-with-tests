import { Pool } from 'pg'
import { DataSource } from 'typeorm'
import { handleTransfers, RawTransfer } from './transfer'
import { Account } from '../model/generated/account.model'
import { Transfer } from '../model/generated/transfer.model'
import { Store } from '@subsquid/typeorm-store'

// Helper to generate a random DB name
function randomDbName() {
  return `test_db_${Math.random().toString(36).substring(2, 10)}`
}

// Postgres connection config
const PG_CONFIG = {
  host: 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
}

// Migration script
const MigrationClass = require('../../db/migrations/1753441806659-Data.js')
const migration = new MigrationClass()

describe('handleTransfers integration', () => {
  let dbName: string
  let pool: Pool
  let dataSource: DataSource
  let store: Store

  beforeAll(async () => {
    dbName = randomDbName()
    pool = new Pool({ ...PG_CONFIG, database: 'postgres' })
    await pool.query(`CREATE DATABASE "${dbName}"`)
    // Connect to the new test DB
    const testPool = new Pool({ ...PG_CONFIG, database: dbName })
    // Run migration
    await migration.up(testPool)
    await testPool.end()

    // Set up TypeORM DataSource
    dataSource = new DataSource({
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
    store = new Store(() => dataSource.manager)
  })

  afterAll(async () => {
    await dataSource.destroy()
    await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`)
    await pool.end()
  })

  it('should process a transfer and update accounts', async () => {
    // Insert initial accounts
    const from = '0xfrom'
    const to = '0xto'
    const initialBalance = BigInt(1000)
    await dataSource.manager.insert(Account, [
      { id: from, balance: initialBalance },
      { id: to, balance: BigInt(0) },
    ])

    // Prepare transfer
    const transferValue = BigInt(250)
    const rawTransfers: RawTransfer[] = [
      {
        id: 'tx1',
        block: 1,
        from,
        to,
        value: transferValue,
        txnHash: 'hash1',
      },
    ]

    // Minimal ProcessorContext mock
    const ctx = { store } as any
    const { transfers, accounts } = await handleTransfers(ctx, rawTransfers)

    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({
      id: 'tx1',
      block: 1,
      from,
      to,
      value: transferValue,
      txnHash: 'hash1',
    })

    expect(accounts).toHaveLength(2)
    const fromAccount = accounts.find(a => a.id === from)
    const toAccount = accounts.find(a => a.id === to)
    expect(fromAccount?.id).toBe(from)
    expect(fromAccount?.balance).toBe(initialBalance - transferValue)
    expect(toAccount?.id).toBe(to)
    expect(toAccount?.balance).toBe(transferValue)
  })
}) 
