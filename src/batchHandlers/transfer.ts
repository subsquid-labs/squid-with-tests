// transfer.ts
// This module maps Transfer event logs to
// any TypeORM model classes these logs might affect.

import {Transfer, Account} from '../model'
import {ProcessorContext} from '../processor'
import {Store} from '@subsquid/typeorm-store'
import {In} from 'typeorm'

export interface RawTransfer {
  id: string
  block: number
  from: string
  to: string
  value: bigint
  txnHash: string
}

export async function handleTransfers(
  ctx: ProcessorContext<Store>,
  rawTransfers: RawTransfer[]
): Promise<{
  transfers: Transfer[]
  accounts: Account[]
}> {

  const involvedAccountAddresses = new Set(
    rawTransfers.flatMap(rt => [rt.from, rt.to])
  )

  const accounts = new Map(
    (await ctx.store.findBy(
      Account,
      {id: In([...involvedAccountAddresses])}
    )).map(a => [a.id, a])
  )

  const transfers: Transfer[] = []

  for (const rawTransfer of rawTransfers) {
    const transfer = new Transfer({
      id: rawTransfer.id,
      block: rawTransfer.block,
      from: rawTransfer.from,
      to: rawTransfer.to,
      value: rawTransfer.value,
      txnHash: rawTransfer.txnHash
    })

    const fromAccount = accounts.get(rawTransfer.from) || new Account({
      id: rawTransfer.from,
      balance: BigInt(0)
    })

    const toAccount = accounts.get(rawTransfer.to) || new Account({
      id: rawTransfer.to,
      balance: BigInt(0)
    })

    fromAccount.balance -= rawTransfer.value
    toAccount.balance += rawTransfer.value

    accounts.set(rawTransfer.from, fromAccount)
    accounts.set(rawTransfer.to, toAccount)
    transfers.push(transfer)
  }

  // Final entity instances may be used downstream,
  // so we return them instead of saving in place.
  return {
    transfers,
    accounts: [...accounts.values()]
  }  
}