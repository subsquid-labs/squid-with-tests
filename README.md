# Squid with tests

This squid captures `Transfer(address,address,uint256)` events emitted by the contract at `env.CONTRACT_ADDRESS` ([USDC token contract](https://etherscan.io/address/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) by default). It keeps up with network updates [in real time](https://docs.sqd.ai/sdk/resources/unfinalized-blocks/). Balances of individual accounts are computed and kept up to date.

The squid has two tests:

 - [Integration test](/src/batchHandlers/transfer.int.test.ts) for the handler function for batches of `Transfer`s ([src/batchHandlers/transfer.ts](/src/batchHandlers/transfer.ts)
 - [End-to-end integration test of the indexer](/src/main.anvil.int.test.ts) on mock chain data synthesized with [Anvil](https://getfoundry.sh/anvil/overview).

Tests can run locally or [as a GitHub Action](/.github/workflows/run_tests.yml).

Dependencies: Node.js v20 or newer, Docker.

## Quickstart

```bash
git clone https://github.com/subsquid-labs/squid-with-tests
cd squid-with-tests
docker compose up -d
npm run build
npx squid-typeorm-migration apply
node -r dotenv/config lib/main.js
```
then in a separate terminal
```bash
npx squid-graphql-server
```

A GraphiQL playground will be available at [localhost:4350/graphql](http://localhost:4350/graphql).

## Testing

Enter the project folder and make sure that the database is up:
```bash
docker compose up -d
```
then run
```bash
npm test
```