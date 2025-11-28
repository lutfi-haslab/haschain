# Smart Contract DSL Reference

HasChain provides a human-readable DSL for writing EVM smart contracts that compiles to bytecode.

## Contract Definition

```typescript
import { Contract, $ } from '../evm';

const myContract = new Contract()
  // Define storage variables
  .uint256('balance')
  .address('owner')

  // Define functions
  .function('deposit', [{ name: 'amount', type: 'uint256' }])
    .set('balance', $.add($.var('balance'), $.param(0)))

  .function('getBalance', [], { view: true, returns: 'uint256' })
    .returns($.var('balance'));

// Compile to EVM bytecode
const bytecode = myContract.compile();
```

## Storage Variables

Define contract state that persists between calls:

```typescript
const contract = new Contract()
  .uint256('count')      // 256-bit unsigned integer
  .address('owner')      // 20-byte address
```

Each variable gets its own storage slot (0, 1, 2, ...).

## Functions

### Basic Function

```typescript
.function('functionName', [
  { name: 'param1', type: 'uint256' },
  { name: 'param2', type: 'address' }
])
```

### View Function (read-only)

```typescript
.function('getValue', [], { view: true, returns: 'uint256' })
  .returns($.var('value'))
```

### Function Body Operations

| Method | Description |
|--------|-------------|
| `.set(varName, expr)` | Assign value to storage variable |
| `.returns(expr)` | Return a value |
| `.require(condition)` | Revert if condition is false |

## Expression Helpers (`$`)

### Variables & Parameters

| Expression | Description |
|------------|-------------|
| `$.var('name')` | Read storage variable |
| `$.param(0)` | Read function parameter (0-indexed) |
| `$.num(42)` | Number literal |

### Arithmetic

| Expression | Description |
|------------|-------------|
| `$.add(a, b)` | Addition: `a + b` |
| `$.sub(a, b)` | Subtraction: `a - b` |
| `$.mul(a, b)` | Multiplication: `a * b` |
| `$.div(a, b)` | Division: `a / b` |

### Comparisons

| Expression | Description |
|------------|-------------|
| `$.eq(a, b)` | Equal: `a == b` |
| `$.lt(a, b)` | Less than: `a < b` |
| `$.gt(a, b)` | Greater than: `a > b` |
| `$.not(a)` | Logical NOT |

### Environment

| Expression | Description |
|------------|-------------|
| `$.caller()` | Message sender address |
| `$.callvalue()` | ETH sent with call |

## ABI Helpers

### Encoding

```typescript
import { selector, encodeCall, encodeUint256, encodeAddress } from '../evm';

// Get function selector (4 bytes)
const sel = selector('transfer(address,uint256)');

// Encode full function call
const calldata = encodeCall('transfer(address,uint256)', recipientAddress, 100n);

// Encode individual values
const amount = encodeUint256(1000n);
const addr = encodeAddress('0x1234...');
```

### Decoding

```typescript
import { decodeUint256, decodeAddress, decodeBool } from '../evm';

const value = decodeUint256(result.returnData);  // bigint
const addr = decodeAddress(result.returnData);   // Uint8Array
const flag = decodeBool(result.returnData);      // boolean
```

## Complete Examples

### Counter Contract

```typescript
// Solidity equivalent:
// contract Counter {
//     uint256 count;
//     function increment() public { count++; }
//     function decrement() public { count--; }
//     function getCount() public view returns (uint256) { return count; }
// }

const counter = new Contract()
  .uint256('count')

  .function('increment')
    .set('count', $.add($.var('count'), $.num(1)))

  .function('decrement')
    .set('count', $.sub($.var('count'), $.num(1)))

  .function('getCount', [], { view: true, returns: 'uint256' })
    .returns($.var('count'));
```

### Calculator Contract

```typescript
// Pure functions - no storage
const calculator = new Contract()
  .function('add', [
    { name: 'a', type: 'uint256' },
    { name: 'b', type: 'uint256' }
  ], { returns: 'uint256' })
    .returns($.add($.param(0), $.param(1)))

  .function('multiply', [
    { name: 'a', type: 'uint256' },
    { name: 'b', type: 'uint256' }
  ], { returns: 'uint256' })
    .returns($.mul($.param(0), $.param(1)));
```

### Simple Storage

```typescript
const storage = new Contract()
  .uint256('value')

  .function('setValue', [{ name: '_value', type: 'uint256' }])
    .set('value', $.param(0))

  .function('getValue', [], { view: true, returns: 'uint256' })
    .returns($.var('value'));
```

## Deploying Contracts

```typescript
import { EvmHelper, addressFromHex } from '../evm';

const evm = new EvmHelper();

// Create account with balance
const deployer = addressFromHex('0x1111111111111111111111111111111111111111');
evm.createAccount(deployer, 10n ** 18n); // 1 ETH

// Deploy
const bytecode = myContract.compile();
const { contractAddress, result } = evm.deployContract(deployer, bytecode);

console.log('Deployed at:', contractAddress);
console.log('Gas used:', result.gasUsed);
```

## Calling Contracts

### State-Changing Calls (Transactions)

```typescript
// Modifies blockchain state
evm.sendTransaction(
  from,           // sender address
  contractAddress,
  encodeCall('setValue(uint256)', 42n),
  0n,             // value (ETH to send)
  1000000n        // gas limit
);
```

### View Calls (Read-Only)

```typescript
// Does not modify state
const result = evm.call(
  from,
  contractAddress,
  selector('getValue()')
);

if (result.success) {
  const value = decodeUint256(result.returnData);
}
```

## Low-Level Bytecode Builder

For advanced use cases, you can build bytecode directly:

```typescript
import { BytecodeBuilder, createDeploymentBytecode } from '../evm';

const b = new BytecodeBuilder();

b.push1(42)      // Push 42 onto stack
 .push1(0)       // Push storage slot 0
 .sstore()       // Store 42 at slot 0
 .stop();        // End execution

const runtimeCode = b.build();
const deployCode = createDeploymentBytecode(runtimeCode);
```
