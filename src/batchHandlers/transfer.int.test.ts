import { handleTransfers, RawTransfer } from './transfer'
import { Account } from '../model'
import { Store } from '@subsquid/typeorm-store'
import { setupTestDatabase } from '../testing/testDatabase'

describe('handleTransfers integration', () => {
  let db: any
  let store: Store

  beforeAll(async () => {
    const db = await setupTestDatabase()
    store = new Store(() => db.dataSource.manager)
  })

  afterAll(async () => {
    await db.cleanup()
  })

  it('should process a transfer and update accounts', async () => {
    // Insert initial accounts
    const from = '0xfrom'
    const to = '0xto'
    const initialBalance = BigInt(1000)
    await db.dataSource.manager.insert(Account, [
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
