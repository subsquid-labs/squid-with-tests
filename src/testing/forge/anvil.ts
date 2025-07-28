import axios from 'axios'
import { ethers } from 'ethers'
import { mytokenabi } from './mytokenabi'
import { 
  participants,
  CONTRACT_ADDRESS,
  CHAIN_ID,
  hexState
} from './constants'

// Configuration
const maxPriorityFeePerGas = ethers.parseUnits('0.1', 'gwei')
const maxFeePerGas = ethers.parseUnits('1.0', 'gwei')
const gasLimit = 11000000n
const chainId = BigInt(CHAIN_ID)

// RPC endpoint (assuming local Anvil instance)
const RPC_URL = process.env.ANVIL_RPC_URL || 'http://localhost:8545'

// Account mapping
const ACCOUNT_KEYS = {
  Deployer: participants.deployer.privateKey,
  Alice: participants.alice.privateKey,
  Bob: participants.bob.privateKey,
} as const

// Provider and contract instance
const provider = new ethers.JsonRpcProvider(RPC_URL)
const myTokenContract = new ethers.Contract(CONTRACT_ADDRESS, mytokenabi, provider) as any

// Type for contract methods
type ContractMethod = 
  | 'mint'
  | 'transfer'
  | 'approve'
  | 'transferFrom'
  | 'burn'

// Type for read-only contract methods
type ReadOnlyMethod = 
  | 'balanceOf'
  | 'allowance'
  | 'decimals'
  | 'name'
  | 'symbol'
  | 'totalSupply'

// Type for method arguments
type MethodArgs = {
  mint: { to: string; amount: bigint }
  transfer: { to: string; value: bigint }
  approve: { spender: string; value: bigint }
  transferFrom: { from: string; to: string; value: bigint }
  burn: { form: string; amount: bigint }
}

// Type for read-only method arguments
type ReadOnlyMethodArgs = {
  balanceOf: { account: string }
  allowance: { owner: string; spender: string }
  decimals: {}
  name: {}
  symbol: {}
  totalSupply: {}
}

// Get private key from account name
function getPrivateKey(who: 'Deployer' | 'Alice' | 'Bob'): string {
  const privateKey = ACCOUNT_KEYS[who]
  if (!privateKey) {
    throw new Error(`Unknown account: ${who}`)
  }
  return privateKey
}

// Get address from private key
function getAddress(privateKey: string): string {
  // Find the participant with the matching private key
  const participant = Object.values(participants).find(p => p.privateKey === privateKey)
  if (!participant) {
    throw new Error('Unknown private key')
  }
  return participant.address
}

export async function sendAnvilTransaction<T extends ContractMethod>(
  who: 'Deployer' | 'Alice' | 'Bob',
  what: T,
  args: MethodArgs[T]
): Promise<string> {
  const privateKey = getPrivateKey(who)
  
  // Create a fresh provider and wallet for each transaction
  const freshProvider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(privateKey, freshProvider)
  const freshContract = new ethers.Contract(CONTRACT_ADDRESS, mytokenabi, freshProvider) as any
  const contractWithSigner = freshContract.connect(wallet)
  
  let tx: ethers.ContractTransactionResponse
  
  switch (what) {
    case 'mint': {
      const mintArgs = args as MethodArgs['mint']
      tx = await contractWithSigner.mint(
        mintArgs.to,
        mintArgs.amount,
        {
          maxPriorityFeePerGas,
          maxFeePerGas,
          gasLimit
        }
      )
      break
    }
    case 'transfer': {
      const transferArgs = args as MethodArgs['transfer']
      tx = await contractWithSigner.transfer(
        transferArgs.to,
        transferArgs.value,
        {
          maxPriorityFeePerGas,
          maxFeePerGas,
          gasLimit
        }
      )
      break
    }
    case 'approve': {
      const approveArgs = args as MethodArgs['approve']
      tx = await contractWithSigner.approve(
        approveArgs.spender,
        approveArgs.value,
        {
          maxPriorityFeePerGas,
          maxFeePerGas,
          gasLimit
        }
      )
      break
    }
    case 'transferFrom': {
      const transferFromArgs = args as MethodArgs['transferFrom']
      tx = await contractWithSigner.transferFrom(
        transferFromArgs.from,
        transferFromArgs.to,
        transferFromArgs.value,
        {
          maxPriorityFeePerGas,
          maxFeePerGas,
          gasLimit
        }
      )
      break
    }
    case 'burn': {
      const burnArgs = args as MethodArgs['burn']
      tx = await contractWithSigner.burn(
        burnArgs.form,
        burnArgs.amount,
        {
          maxPriorityFeePerGas,
          maxFeePerGas,
          gasLimit
        }
      )
      break
    }
    default:
      throw new Error(`Unknown method: ${what}`)
  }
  
  console.log(`Transaction sent: ${tx.hash}`)
  console.log(`Method: ${what}`)
  console.log(`From: ${who} (${wallet.address})`)
  console.log(`To: ${CONTRACT_ADDRESS}`)
  
  // Wait for the transaction to be mined to ensure nonce is updated
  await tx.wait()
  console.log(`Transaction confirmed: ${tx.hash}`)
  
  return tx.hash
}

export async function callAnvilReadOnly<T extends ReadOnlyMethod>(
  what: T,
  args: ReadOnlyMethodArgs[T]
): Promise<any> {
  let result: any
  
  switch (what) {
    case 'balanceOf': {
      const balanceArgs = args as ReadOnlyMethodArgs['balanceOf']
      result = await myTokenContract.balanceOf(balanceArgs.account)
      break
    }
    case 'allowance': {
      const allowanceArgs = args as ReadOnlyMethodArgs['allowance']
      result = await myTokenContract.allowance(allowanceArgs.owner, allowanceArgs.spender)
      break
    }
    case 'decimals':
      result = await myTokenContract.decimals()
      break
    case 'name':
      result = await myTokenContract.name()
      break
    case 'symbol':
      result = await myTokenContract.symbol()
      break
    case 'totalSupply':
      result = await myTokenContract.totalSupply()
      break
    default:
      throw new Error(`Unknown read-only method: ${what}`)
  }
  
  console.log(`Read-only call: ${what}`)
  console.log(`Result: ${result}`)
  
  return result
}

// Get current block number from Anvil
export async function getCurrentBlockNumber(): Promise<number> {
  try {
    const blockNumber = await provider.getBlockNumber()
    return blockNumber
  } catch (error) {
    console.error('Failed to get block number:', error)
    throw error
  }
}

// Wait for a specific block number
export async function waitForBlock(blockNumber: number, timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    const currentBlock = await getCurrentBlockNumber()
    if (currentBlock >= blockNumber) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  throw new Error(`Timeout waiting for block ${blockNumber}`)
}

export function ethToWei(eth: string): bigint {
  return ethers.parseEther(eth)
}

export function weiToEth(wei: bigint): string {
  return ethers.formatEther(wei)
}

// Reset Anvil
export async function resetAnvil(): Promise<void> {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      method: 'anvil_reset',
      params: [],
      id: 1
    })
    
    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`)
    }
    
    console.log('Anvil reset success')
  } catch (error) {
    console.error('Failed to reset Anvil:', error)
    throw error
  }
}

// Load Anvil state
export async function loadAnvilState(hexState: string): Promise<void> {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      method: 'anvil_loadState',
      params: [hexState],
      id: 1
    })
    
    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`)
    }
    
    console.log('Anvil state loaded successfully')
  } catch (error) {
    console.error('Failed to load Anvil state:', error)
    throw error
  }
}

// Use the standard state from state.ts with one deployed ERC20 contract
export async function restoreStandardState(): Promise<void> {
	await resetAnvil()
  await loadAnvilState(hexState)
}
