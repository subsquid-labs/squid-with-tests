import { sendAnvilTransaction, ethToWei } from './sendAnvilTransaction'

// Example usage of the sendAnvilTransaction function
async function exampleUsage() {
  try {
    // Mint 100 tokens to Alice
    console.log('Minting tokens to Alice...')
    const mintTxHash = await sendAnvilTransaction('Deployer', 'mint', {
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
      amount: ethToWei('100') // 100 tokens
    })
    console.log(`Mint transaction hash: ${mintTxHash}`)

    // Transfer 50 tokens from Alice to Bob
    console.log('\nTransferring tokens from Alice to Bob...')
    const transferTxHash = await sendAnvilTransaction('Alice', 'transfer', {
      to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Bob's address
      value: ethToWei('50') // 50 tokens
    })
    console.log(`Transfer transaction hash: ${transferTxHash}`)

    // Alice approves Bob to spend 25 tokens
    console.log('\nAlice approving Bob to spend tokens...')
    const approveTxHash = await sendAnvilTransaction('Alice', 'approve', {
      spender: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Bob's address
      value: ethToWei('25') // 25 tokens
    })
    console.log(`Approve transaction hash: ${approveTxHash}`)

    // Bob transfers 10 tokens from Alice to himself using transferFrom
    console.log('\nBob transferring tokens from Alice using transferFrom...')
    const transferFromTxHash = await sendAnvilTransaction('Bob', 'transferFrom', {
      from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice's address
      to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Bob's address
      value: ethToWei('10') // 10 tokens
    })
    console.log(`TransferFrom transaction hash: ${transferFromTxHash}`)

  } catch (error) {
    console.error('Error in example usage:', error)
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  exampleUsage()
}

export { exampleUsage } 