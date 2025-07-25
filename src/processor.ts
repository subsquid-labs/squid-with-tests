// processor.ts
// This is where the processor is configured.

// EvmBatchProcessor is the class responsible for data retrieval and processing.
import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction
} from '@subsquid/evm-processor'
// erc20abi is a utility module generated from the common JSON ABI
// of ERC20 contracts. It contains methods for event decoding,
// direct RPC queries and some useful constants.
import * as erc20abi from './abi/erc20'
import {assertNotNull} from '@subsquid/util-internal'

export const CONTRACT_ADDRESS = assertNotNull(
  process.env.CONTRACT_ADDRESS,
  'CONTRACT_ADDRESS is not set'
)

// First we configure data retrieval.
export const processor = new EvmBatchProcessor()
  // SQD Network gateways are the primary source of blockchain data in
  // squids, providing pre-filtered data in chunks of roughly 1-10k blocks.
  // Set this for a fast sync.
  .setGateway(assertNotNull(
    process.env.ETHEREUM_SQD_GATEWAY,
    'ETHEREUM_SQD_GATEWAY is not set'
  ))
  // Another data source squid processors can use is chain RPC.
  // In this particular squid it is used to retrieve the very latest chain data
  // (including unfinalized blocks) in real time. It can also be used to
  //   - make direct RPC queries to get extra data during indexing
  //   - sync a squid without a gateway (slow)
  .setRpcEndpoint(assertNotNull(
    process.env.ETHEREUM_RPC,
    'ETHEREUM_RPC is not set'
  ))
  // The processor needs to know how many newest blocks it should mark as "hot".
  // If it detects a blockchain fork, it will roll back any changes to the
  // database made due to orphaned blocks, then re-run the processing for the
  // main chain blocks.
  .setFinalityConfirmation(75)
  .setBlockRange({
    from: parseInt(assertNotNull(process.env.START_BLOCK, 'START_BLOCK is not set')),
    to: process.env.END_BLOCK ? parseInt(process.env.END_BLOCK) : undefined
  })
  // .addXXX() methods request data items. In this case we're asking for
  // Transfer(address,address,uint256) event logs emitted by the USDC contract.
  //
  // We could have omitted the "address" filter to get Transfer events from
  // all contracts, or the "topic0" filter to get all events from the USDC
  // contract, or both to get all event logs chainwide. We also could have
  // requested some related data, such as the parent transaction or its traces.
  //
  // Other .addXXX() methods (.addTransaction(), .addTrace(), .addStateDiff()
  // on EVM) are similarly feature-rich.
  .addLog({
    address: [CONTRACT_ADDRESS],
    topic0: [erc20abi.events.Transfer.topic],
  })
  // .setFields() is for choosing data fields for the selected data items.
  // Here we're requesting hashes of parent transaction for all event logs.
  .setFields({
    log: {
      transactionHash: true,
    },
  })

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>