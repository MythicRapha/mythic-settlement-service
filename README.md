# Mythic Settlement Service

Posts Mythic L2 state roots to Solana L1 for data availability and fraud proof verification. Runs as a background daemon, reading the latest L2 state every 100 slots and submitting a settlement transaction to the L1 settlement program.

## How It Works

1. Polls the Mythic L2 validator for the latest confirmed slot and bank hash
2. Constructs a state root from the slot number, bank hash, and block time
3. Submits the state root to the L1 settlement program (`4TrowzShv4CrsuqZeUdLLVMdnDDkqkmnER1MZ5NsSaav`)
4. Records submitted roots locally to avoid duplicate submissions

## Environment Variables

| Variable | Description |
|----------|-------------|
| `L1_RPC_URL` | Solana mainnet RPC endpoint |
| `L2_RPC_URL` | Mythic L2 RPC endpoint |
| `SETTLEMENT_PROGRAM` | Settlement program ID on L1 |
| `SEQUENCER_KEY` | Path to sequencer keypair JSON |
| `SETTLEMENT_INTERVAL` | Slots between settlements (default: 100) |

## Program IDs

- **L1 Settlement**: `4TrowzShv4CrsuqZeUdLLVMdnDDkqkmnER1MZ5NsSaav`
- **L2 Settlement**: `MythSett1ement11111111111111111111111111111`

## Setup

```bash
npm install
cp .env.example .env
npm start
```

## License

Proprietary - Mythic Labs
