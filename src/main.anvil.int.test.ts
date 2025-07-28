import { spawn, ChildProcess } from 'child_process'
import { Pool } from 'pg'
import { setupTestDatabase } from './testing/testDatabase'
import { restoreStandardState, sendAnvilTransaction, callAnvilReadOnly, ethToWei, getCurrentBlockNumber, waitForBlock } from './testing/forge/anvil'
import { participants } from './testing/forge/constants'

// Configuration
const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL || 'http://localhost:8545'
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432
const DB_USER = process.env.DB_USER || 'postgres'
const DB_PASS = process.env.DB_PASS || 'postgres'
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'

// Helper function to run the indexer as a child process
function runIndexer(dbName: string, toBlock: number): ChildProcess {
  const env = {
    ...process.env,
    DB_PORT: DB_PORT.toString(),
    DB_USER,
    DB_PASS,
    DB_NAME: dbName,
    CONTRACT_ADDRESS,
    ETHEREUM_RPC: ANVIL_RPC_URL,
    START_BLOCK: '1',
    END_BLOCK: toBlock.toString(),
    // The indexer will wait for chain updates forever if it comes to within
    // FINALITY_CONFIRMATION blocks of the chain head. Since we want to index
    // the whole chain history and exit, it must be set to zero.
    FINALITY_CONFIRMATION: '0',
    // Disable SQD gateway for local testing
    ETHEREUM_SQD_GATEWAY: ''
  }

  console.log(`Starting indexer with DB: ${dbName}, to block: ${toBlock}`)
  
  const child = spawn('node', ['lib/main.js'], {
    env,
    stdio: 'pipe'
  })

  child.stdout?.on('data', (data) => {
    console.log(`Indexer stdout: ${data}`)
  })

  child.stderr?.on('data', (data) => {
    console.log(`Indexer stderr: ${data}`)
  })

  return child
}

// Helper function to wait for indexer to complete
function waitForIndexer(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Indexer process exited with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

describe('Anvil Integration Test', () => {
  let testDb: { dataSource: any; cleanup: () => Promise<void>; dbName: string } | null = null
  let indexerProcess: ChildProcess | null = null

  beforeAll(async () => {
    // Restore Anvil to standard state
    console.log('Restoring Anvil standard state...')
    await restoreStandardState()
    
    // Wait a moment for state to be loaded
    await new Promise(resolve => setTimeout(resolve, 2000))
  })

  afterAll(async () => {
    // Clean up indexer process
    if (indexerProcess) {
      indexerProcess.kill('SIGTERM')
    }
    
    // Clean up test database
    if (testDb) {
      await testDb.cleanup()
    }
  })

  it('should index Anvil data correctly', async () => {
    // Step 1: Get initial state
    const initialBlock = await getCurrentBlockNumber()
    console.log(`Initial block number: ${initialBlock}`)

    // Step 2: Send some test transactions
    console.log('Sending test transactions...')
    
    // Mint tokens to Alice
    const mintTxHash = await sendAnvilTransaction('Deployer', 'mint', {
      to: participants.alice.address,
      amount: ethToWei('100')
    })
    console.log(`Mint transaction: ${mintTxHash}`)

    // Transfer tokens from Alice to Bob
    const transferTxHash = await sendAnvilTransaction('Alice', 'transfer', {
      to: participants.bob.address,
      value: ethToWei('50')
    })
    console.log(`Transfer transaction: ${transferTxHash}`)

    // Wait for transactions to be mined
    await waitForBlock(initialBlock + 2, 10000)
    
    const finalBlock = await getCurrentBlockNumber()
    console.log(`Final block number: ${finalBlock}`)

    // Step 3: Set up test database
    console.log('Setting up test database...')
    testDb = await setupTestDatabase()
    
    // Step 4: Run the indexer
    console.log('Starting indexer...')
    indexerProcess = runIndexer(testDb.dbName, finalBlock)
    
    // Wait for indexer to complete
    await waitForIndexer(indexerProcess)
    console.log('Indexer completed successfully')

    // Step 5: Verify indexed data
    console.log('Verifying indexed data...')
    
    // Check that accounts were created
    const accountCount = await testDb.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('account', 'account')
      .getRawOne()
    
    console.log(`Total accounts indexed: ${accountCount.count}`)
    expect(parseInt(accountCount.count)).toBeGreaterThan(0)

    // Check that transfers were indexed
    const transferCount = await testDb.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('transfer', 'transfer')
      .getRawOne()
    
    console.log(`Total transfers indexed: ${transferCount.count}`)
    expect(parseInt(transferCount.count)).toBeGreaterThan(0)

    // Verify specific transfers
    const transfers = await testDb.dataSource
      .createQueryBuilder()
      .select('*')
      .from('transfer', 'transfer')
      .orderBy('transfer.block', 'ASC')
      .getRawMany()

    console.log('Indexed transfers:', transfers)

    // Verify Alice's balance was indexed correctly
    const aliceAccount = await testDb.dataSource
      .createQueryBuilder()
      .select('*')
      .from('account', 'account')
      .where('account.id = :address', { address: participants.alice.address.toLowerCase() })
      .getRawOne()

    if (aliceAccount) {
      console.log(`Alice's indexed balance: ${aliceAccount.balance}`)
      // Alice should have 50 tokens after minting 100 and transferring 50
      expect(BigInt(aliceAccount.balance)).toBe(ethToWei('50'))
    }

    // Verify Bob's balance was indexed correctly
    const bobAccount = await testDb.dataSource
      .createQueryBuilder()
      .select('*')
      .from('account', 'account')
      .where('account.id = :address', { address: participants.bob.address.toLowerCase() })
      .getRawOne()

    if (bobAccount) {
      console.log(`Bob's indexed balance: ${bobAccount.balance}`)
      // Bob should have 50 tokens from the transfer
      expect(BigInt(bobAccount.balance)).toBe(ethToWei('50'))
    }

    // Step 6: Verify current state matches indexed state
    console.log('Verifying current state matches indexed state...')
    
    const currentAliceBalance = await callAnvilReadOnly('balanceOf', {
      account: participants.alice.address
    })
    
    const currentBobBalance = await callAnvilReadOnly('balanceOf', {
      account: participants.bob.address
    })

    console.log(`Current Alice balance: ${currentAliceBalance}`)
    console.log(`Current Bob balance: ${currentBobBalance}`)

    // The indexed balances should match the current on-chain balances
    if (aliceAccount) {
      expect(BigInt(aliceAccount.balance)).toBe(currentAliceBalance)
    }
    
    if (bobAccount) {
      expect(BigInt(bobAccount.balance)).toBe(currentBobBalance)
    }
  }, 60000) // 60 second timeout for integration test
})