# HasChain API Reference

Complete REST API documentation with curl examples and responses.

## Quick Start

```bash
# Start the server
bun run server

# Server runs at http://localhost:3000
```

## Pre-funded Accounts

The server starts with 5 pre-funded accounts (100,000 ETH each):

| Index | Address | Private Key |
|-------|---------|-------------|
| 0 | 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1 | 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d |
| 1 | 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 | 0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1 |
| 2 | 0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b | 0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c |
| 3 | 0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d | 0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913 |
| 4 | 0xd03ea8624C8C5987235048901fB614fDcA89b117 | 0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743 |

---

## API Endpoints

### Health & Info

#### GET /
Get API info.

```bash
curl http://localhost:3000/
```

Response:
```json
{
  "name": "HasChain",
  "version": "1.0.0",
  "chainId": 1337,
  "status": "running"
}
```

#### GET /api/health
Health check endpoint.

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /api/accounts
List all pre-funded accounts with private keys.

```bash
curl http://localhost:3000/api/accounts
```

Response:
```json
{
  "accounts": [
    {
      "index": 0,
      "address": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
      "privateKey": "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
      "balance": "100,000 ETH"
    },
    {
      "index": 1,
      "address": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
      "privateKey": "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1",
      "balance": "100,000 ETH"
    }
  ]
}
```

---

### Blockchain Info

#### GET /api/chain
Get blockchain information.

```bash
curl http://localhost:3000/api/chain
```

Response:
```json
{
  "chainId": 1337,
  "blockNumber": "5",
  "blockHash": "0x4293a38e8fe4d4ed2645fd1fd958c529f97d4869c1b7d88b92036200a4a56cf2",
  "validators": ["0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1"],
  "totalBlocks": 6,
  "totalTransactions": 10
}
```

#### GET /api/validators
Get validator information.

```bash
curl http://localhost:3000/api/validators
```

Response:
```json
{
  "validators": [
    {
      "address": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
      "isActive": true,
      "blocksProduced": 5,
      "missedBlocks": 0
    }
  ]
}
```

---

### Account Operations

#### GET /api/balance/:address
Get account balance.

```bash
curl http://localhost:3000/api/balance/0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1
```

Response:
```json
{
  "address": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
  "balance": "100000000000000000000000",
  "balanceEth": "100,000 ETH"
}
```

---

### Transaction Operations

#### POST /api/tx/send
Send a transaction.

```bash
curl -X POST http://localhost:3000/api/tx/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
    "value": "1000000000000000000",
    "gasLimit": "21000",
    "gasPrice": "1000000000",
    "nonce": "0"
  }'
```

Response:
```json
{
  "success": true,
  "txHash": "0xe048236289bbf2f88ebacbb75903b0bf6ddbcd59d84743c7a19d9d82e84c2447"
}
```

Parameters:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| from | string | Yes | Sender address |
| to | string | No | Recipient address (null for contract deploy) |
| value | string | No | Value in wei (default: "0") |
| gasLimit | string | No | Gas limit (default: "21000") |
| gasPrice | string | No | Gas price in wei (default: "1000000000") |
| nonce | string | No | Transaction nonce (default: "0") |
| data | string | No | Hex-encoded data |

#### GET /api/tx/:hash
Get transaction by hash.

```bash
curl http://localhost:3000/api/tx/0xe048236289bbf2f88ebacbb75903b0bf6ddbcd59d84743c7a19d9d82e84c2447
```

Response:
```json
{
  "success": true,
  "transaction": {
    "from": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
    "to": "0xffcf8fdee72ac11b5c542428b35eef5769c409f0",
    "value": "1000000000000000000",
    "gasLimit": "21000",
    "gasPrice": "1000000000",
    "nonce": "0",
    "data": "0x"
  }
}
```

#### GET /api/tx/pending
Get pending transactions.

```bash
curl http://localhost:3000/api/tx/pending
```

Response:
```json
{
  "count": 2,
  "transactions": [
    {
      "hash": "0xe048236289bbf2f88ebacbb75903b0bf6ddbcd59d84743c7a19d9d82e84c2447",
      "from": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
      "gasPrice": "1000000000",
      "nonce": "0"
    }
  ]
}
```

---

### Block Operations

#### POST /api/block/create
Mine a new block.

```bash
curl -X POST http://localhost:3000/api/block/create
```

Response:
```json
{
  "success": true,
  "block": {
    "number": "1",
    "timestamp": "1705312200",
    "transactions": 2,
    "gasUsed": "42000"
  }
}
```

#### GET /api/block/latest
Get the latest block.

```bash
curl http://localhost:3000/api/block/latest
```

Response:
```json
{
  "success": true,
  "block": {
    "number": "5",
    "timestamp": "1705312200",
    "validator": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
    "gasLimit": "30000000",
    "gasUsed": "21000",
    "transactionCount": 1,
    "parentHash": "0x4293a38e8fe4d4ed2645fd1fd958c529f97d4869c1b7d88b92036200a4a56cf2",
    "stateRoot": "0x0101010101010101010101010101010101010101010101010101010101010101"
  }
}
```

#### GET /api/block/number/:number
Get block by number.

```bash
curl http://localhost:3000/api/block/number/1
```

Response:
```json
{
  "success": true,
  "block": {
    "number": "1",
    "timestamp": "1705312200",
    "validator": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
    "gasLimit": "30000000",
    "gasUsed": "21000",
    "transactionCount": 1,
    "parentHash": "0x4293a38e8fe4d4ed2645fd1fd958c529f97d4869c1b7d88b92036200a4a56cf2",
    "stateRoot": "0x0101010101010101010101010101010101010101010101010101010101010101",
    "transactions": [
      {
        "from": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
        "to": "0xffcf8fdee72ac11b5c542428b35eef5769c409f0",
        "value": "1000000000000000000",
        "type": "transfer"
      }
    ]
  }
}
```

#### GET /api/block/hash/:hash
Get block by hash.

```bash
curl http://localhost:3000/api/block/hash/0x4293a38e8fe4d4ed2645fd1fd958c529f97d4869c1b7d88b92036200a4a56cf2
```

Response:
```json
{
  "success": true,
  "block": {
    "number": "0",
    "timestamp": "1705312200",
    "validator": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
    "gasLimit": "30000000",
    "gasUsed": "0",
    "transactionCount": 0
  }
}
```

#### GET /api/blocks?count=N
Get latest N blocks.

```bash
curl "http://localhost:3000/api/blocks?count=5"
```

Response:
```json
{
  "count": 5,
  "blocks": [
    {
      "number": "0",
      "timestamp": "1705312200",
      "validator": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
      "transactionCount": 0,
      "gasUsed": "0"
    },
    {
      "number": "1",
      "timestamp": "1705312201",
      "validator": "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
      "transactionCount": 2,
      "gasUsed": "42000"
    }
  ]
}
```

---

### Contract Operations

#### POST /api/contract/deploy
Deploy a smart contract.

```bash
curl -X POST http://localhost:3000/api/contract/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "bytecode": "0x6080604052348015600f57600080fd5b50603f80601d6000396000f3fe",
    "gasLimit": "500000",
    "gasPrice": "1000000000",
    "nonce": "0"
  }'
```

Response:
```json
{
  "success": true,
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

Parameters:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| from | string | Yes | Deployer address |
| bytecode | string | Yes | Contract bytecode (hex) |
| gasLimit | string | No | Gas limit (default: "500000") |
| gasPrice | string | No | Gas price in wei |
| nonce | string | No | Transaction nonce |
| value | string | No | ETH to send with deployment |

#### POST /api/contract/call
Call a contract method.

```bash
# Using method signature
curl -X POST http://localhost:3000/api/contract/call \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0x1234567890123456789012345678901234567890",
    "method": "setValue(uint256)",
    "args": ["42"],
    "gasLimit": "100000",
    "nonce": "1"
  }'

# Using raw calldata
curl -X POST http://localhost:3000/api/contract/call \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0x1234567890123456789012345678901234567890",
    "data": "0x60fe47b1000000000000000000000000000000000000000000000000000000000000002a",
    "gasLimit": "100000",
    "nonce": "1"
  }'
```

Response:
```json
{
  "success": true,
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "calldata": "0x55241077000000000000000000000000000000000000000000000000000000000000002a"
}
```

---

### Signing Operations

#### POST /api/sign/message
Sign a message.

```bash
curl -X POST http://localhost:3000/api/sign/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello HasChain!",
    "privateKey": "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Hello HasChain!",
  "messageHash": "0xb49c69ce7ae93d59d5a0930b58fec06c27521d29de82c0331dbedcbf0d6f0cd3",
  "signature": "0x1e36c364d04397f37f0a39a1f2546ac68df8b78374286a99b7147615a7c5a6791e36c364d04397f37f0a39a1f2546ac68df8b78374286a99b7147615a7c5a6791b"
}
```

#### POST /api/sign/transaction
Sign a transaction.

```bash
curl -X POST http://localhost:3000/api/sign/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
    "value": "1000000000000000000",
    "gasLimit": "21000",
    "gasPrice": "1000000000",
    "nonce": "0",
    "privateKey": "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
  }'
```

Response:
```json
{
  "success": true,
  "txHash": "0xe048236289bbf2f88ebacbb75903b0bf6ddbcd59d84743c7a19d9d82e84c2447",
  "signature": "0x..."
}
```

---

### Utility Endpoints

#### POST /api/encode/call
Encode a function call.

```bash
curl -X POST http://localhost:3000/api/encode/call \
  -H "Content-Type: application/json" \
  -d '{
    "method": "transfer(address,uint256)",
    "args": ["0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", "1000000000000000000"]
  }'
```

Response:
```json
{
  "success": true,
  "method": "transfer(address,uint256)",
  "args": ["0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", "1000000000000000000"],
  "calldata": "0xa9059cbb000000000000000000000000ffcf8fdee72ac11b5c542428b35eef5769c409f00000000000000000000000000000000000000000000000000de0b6b3a7640000"
}
```

#### GET /api/selector/:signature
Get function selector from signature.

```bash
curl "http://localhost:3000/api/selector/transfer(address,uint256)"
```

Response:
```json
{
  "signature": "transfer(address,uint256)",
  "selector": "0xa9059cbb"
}
```

---

## Common Workflows

### 1. Send ETH Transfer

```bash
# 1. Send transaction
curl -X POST http://localhost:3000/api/tx/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
    "value": "1000000000000000000",
    "nonce": "0"
  }'

# 2. Mine block to include transaction
curl -X POST http://localhost:3000/api/block/create

# 3. Check block
curl http://localhost:3000/api/block/latest
```

### 2. Deploy and Interact with Contract

```bash
# 1. Deploy contract
curl -X POST http://localhost:3000/api/contract/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "bytecode": "0x608060405234801561001057600080fd5b5060...",
    "nonce": "0"
  }'

# 2. Mine block
curl -X POST http://localhost:3000/api/block/create

# 3. Call contract method
curl -X POST http://localhost:3000/api/contract/call \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0xCONTRACT_ADDRESS",
    "method": "setValue(uint256)",
    "args": ["42"],
    "nonce": "1"
  }'

# 4. Mine block
curl -X POST http://localhost:3000/api/block/create
```

### 3. Sign and Send Transaction

```bash
# 1. Sign transaction
SIGNED=$(curl -s -X POST http://localhost:3000/api/sign/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
    "value": "1000000000000000000",
    "nonce": "0",
    "privateKey": "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
  }')

echo $SIGNED

# 2. Send the transaction
curl -X POST http://localhost:3000/api/tx/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "to": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
    "value": "1000000000000000000",
    "nonce": "0"
  }'
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common errors:
- `"Blockchain not initialized"` - Server not ready
- `"Transaction not found"` - Invalid transaction hash
- `"Block not found"` - Invalid block number/hash
- `"Message and privateKey required"` - Missing required fields
