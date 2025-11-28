# Getting Started with HasChain EVM

HasChain is a minimal EVM implementation in TypeScript with a human-readable smart contract DSL.

## Installation

```bash
bun install
```

## Quick Start

### 1. Create a Simple Contract

```typescript
import { Contract, $, EvmHelper, addressFromHex, selector, encodeCall, decodeUint256 } from '../evm';

// Define a simple storage contract
const storage = new Contract()
  .uint256('value')

  .function('setValue', [{ name: '_value', type: 'uint256' }])
    .set('value', $.param(0))

  .function('getValue', [], { view: true, returns: 'uint256' })
    .returns($.var('value'));

// Compile to bytecode
const bytecode = storage.compile();
```

### 2. Deploy and Interact

```typescript
// Create EVM instance
const evm = new EvmHelper();

// Create an account with 1 ETH
const user = addressFromHex('0x1234567890123456789012345678901234567890');
evm.createAccount(user, 10n ** 18n);

// Deploy the contract
const { contractAddress } = evm.deployContract(user, bytecode);

// Call setValue(42)
evm.sendTransaction(user, contractAddress, encodeCall('setValue(uint256)', 42n));

// Call getValue() - view function
const result = evm.call(user, contractAddress, selector('getValue()'));
console.log('Value:', decodeUint256(result.returnData)); // 42n
```

## Running Examples

```bash
# Simple storage
bun run src/examples/storage.ts

# Counter with increment/decrement
bun run src/examples/counter.ts

# Calculator with pure functions
bun run src/examples/calculator.ts
```

## Next Steps

- Read [Smart Contract DSL](./smart-contracts.md) for the full contract language reference
- Check the `src/examples/` folder for more contract examples
