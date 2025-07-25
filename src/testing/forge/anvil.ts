import axios from 'axios'
import { Transaction, weieth, weigwei } from 'micro-eth-signer'
import { createContract } from 'micro-eth-signer/abi/index.js'
import { mytokenabi } from './mytokenabi'
import { 
  participants,
  CONTRACT_ADDRESS,
  CHAIN_ID,
  hexState
} from './constants'

// Configuration
const maxPriorityFeePerGas = weigwei.decode('0.1')
const maxFeePerGas = weigwei.decode('1.0')
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

// Contract instance
const myTokenContract = createContract(mytokenabi) as any

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

// Get nonce for an account
async function getNonce(address: string): Promise<bigint> {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      method: 'eth_getTransactionCount',
      params: [address, 'latest'],
      id: 1
    })
    
    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`)
    }
    
    return BigInt(response.data.result)
  } catch (error) {
    console.error('Failed to get nonce:', error)
    throw error
  }
}

// Send raw transaction
async function sendRawTransaction(signedTxHex: string): Promise<string> {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      method: 'eth_sendRawTransaction',
      params: [signedTxHex],
      id: 1
    })
    
    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`)
    }
    
    return response.data.result
  } catch (error) {
    console.error('Failed to send transaction:', error)
    throw error
  }
}

// Call read-only contract method
async function callContractMethod(data: string): Promise<string> {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{
        to: CONTRACT_ADDRESS,
        data: data
      }, 'latest'],
      id: 1
    })
    
    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`)
    }
    
    return response.data.result
  } catch (error) {
    console.error('Failed to call contract method:', error)
    throw error
  }
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
  const fromAddress = getAddress(privateKey)
  const nonce = await getNonce(fromAddress)
  
  // Encode the contract method call
  let encodedData: string
  
  switch (what) {
    case 'mint':
      encodedData = myTokenContract.mint.encodeInput(args as MethodArgs['mint'])
      break
    case 'transfer':
      encodedData = myTokenContract.transfer.encodeInput(args as MethodArgs['transfer'])
      break
    case 'approve':
      encodedData = myTokenContract.approve.encodeInput(args as MethodArgs['approve'])
      break
    case 'transferFrom':
      encodedData = myTokenContract.transferFrom.encodeInput(args as MethodArgs['transferFrom'])
      break
    case 'burn':
      encodedData = myTokenContract.burn.encodeInput(args as MethodArgs['burn'])
      break
    default:
      throw new Error(`Unknown method: ${what}`)
  }
  
  // Prepare unsigned transaction
  const unsignedTx = Transaction.prepare({
    to: CONTRACT_ADDRESS,
    maxPriorityFeePerGas,
    maxFeePerGas,
    value: 0n,
    nonce,
    chainId,
    gasLimit,
    data: Buffer.from(encodedData).toString('hex')
  })
  
  // Sign the transaction
  const signedTx = unsignedTx.signBy(privateKey)
  const signedTxHex = signedTx.toHex()
  
  // Send the transaction
  const txHash = await sendRawTransaction(signedTxHex)
  
  console.log(`Transaction sent: ${txHash}`)
  console.log(`Method: ${what}`)
  console.log(`From: ${who} (${fromAddress})`)
  console.log(`To: ${CONTRACT_ADDRESS}`)
  
  return txHash
}

export async function callAnvilReadOnly<T extends ReadOnlyMethod>(
  what: T,
  args: ReadOnlyMethodArgs[T]
): Promise<any> {
  // Encode the contract method call
  let encodedData: string
  
  switch (what) {
    case 'balanceOf':
      encodedData = myTokenContract.balanceOf.encodeInput(args as ReadOnlyMethodArgs['balanceOf'])
      break
    case 'allowance':
      encodedData = myTokenContract.allowance.encodeInput(args as ReadOnlyMethodArgs['allowance'])
      break
    case 'decimals':
      encodedData = myTokenContract.decimals.encodeInput(args as ReadOnlyMethodArgs['decimals'])
      break
    case 'name':
      encodedData = myTokenContract.name.encodeInput(args as ReadOnlyMethodArgs['name'])
      break
    case 'symbol':
      encodedData = myTokenContract.symbol.encodeInput(args as ReadOnlyMethodArgs['symbol'])
      break
    case 'totalSupply':
      encodedData = myTokenContract.totalSupply.encodeInput(args as ReadOnlyMethodArgs['totalSupply'])
      break
    default:
      throw new Error(`Unknown read-only method: ${what}`)
  }
  
  // Call the contract method
  const result = await callContractMethod(encodedData)
  
  // Decode the result based on the method
  let decodedResult: any
  
  switch (what) {
    case 'balanceOf':
    case 'totalSupply':
      decodedResult = BigInt(result)
      break
    case 'allowance':
      decodedResult = BigInt(result)
      break
    case 'decimals':
      decodedResult = parseInt(result, 16)
      break
    case 'name':
    case 'symbol':
      // For string returns, we need to decode the hex
      decodedResult = decodeString(result)
      break
    default:
      decodedResult = result
  }
  
  console.log(`Read-only call: ${what}`)
  console.log(`Result: ${decodedResult}`)
  
  return decodedResult
}

// Helper function to decode string from hex
function decodeString(hex: string): string {
  // Remove '0x' prefix and decode
  const hexWithoutPrefix = hex.startsWith('0x') ? hex.slice(2) : hex
  // Convert hex to string
  return Buffer.from(hexWithoutPrefix, 'hex').toString('utf8').replace(/\0/g, '')
}

// Helper function to convert ETH to Wei
export function ethToWei(eth: string): bigint {
  return weieth.decode(eth)
}

// Helper function to convert Wei to ETH
export function weiToEth(wei: bigint): string {
  return weieth.encode(wei)
}

// Load Anvil state without arguments (uses default state file)
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

export async function restoreStandardState(): Promise<void> {
  await loadAnvilState(hexState)
}