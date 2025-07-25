import assert from 'assert'
import fs from 'fs'
import { addr, Transaction, weieth, weigwei } from 'micro-eth-signer'
import { createContract } from 'micro-eth-signer/abi/index.js'

import { mytokenabi } from '../mytokenabi.js'

/***** config section *****/

const maxPriorityFeePerGas = weigwei.decode('0.1')

const maxFeePerGas = weigwei.decode('1.0')
const gasLimit = 11000000n

const mintAmount = weieth.decode('100')

const nonce = 1n
const chainId = 31337n

/***** config section - end *****/

const privateKey = process.argv[2]
assert(privateKey, 'Please supply the private key')

const myTokenContract = createContract(mytokenabi)
const mintInput = myTokenContract.mint.encodeInput({to: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', amount: mintAmount})

const data = Buffer.from(mintInput).toString('hex')

const unsignedTx = Transaction.prepare({
	to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
	maxPriorityFeePerGas,
	maxFeePerGas,
	value: 0n,
	nonce,
	chainId,
	gasLimit,
	data
})

const tx = unsignedTx.signBy(privateKey)
console.log(tx.toHex())
//fs.writeFileSync('./tx.hex', tx.toHex())
