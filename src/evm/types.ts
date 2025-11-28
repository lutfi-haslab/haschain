// Basic types for our minimal EVM implementation

export type Address = Uint8Array; // 20 bytes
export type Hash = Uint8Array;   // 32 bytes
export type Bytes = Uint8Array;  // Variable length

// 256-bit values (using BigInt for easier operations)
export type Word = bigint;

// Account representation
export interface Account {
  address: Address;
  nonce: bigint;
  balance: bigint; // in wei
  code: Bytes;
  storage: Map<string, Word>; // Using string keys for simplicity (hex representation)
}

// Transaction model
export interface Transaction {
  from: Address;
  to: Address | null; // null for contract creation
  value: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  nonce: bigint;
  data: Bytes;
}

// Execution result
export interface ExecutionResult {
  success: boolean;
  gasUsed: bigint;
  returnData: Bytes;
  logs?: Log[];
}

// Log entry (simplified)
export interface Log {
  address: Address;
  topics: Hash[];
  data: Bytes;
}

// Environment context for execution
export interface Env {
  address: Address;      // Contract address being executed
  caller: Address;       // msg.sender
  origin: Address;       // tx.origin
  value: bigint;         // msg.value
  gasPrice: bigint;
  block: {
    number: bigint;
    timestamp: bigint;
    coinbase: Address;
    gasLimit: bigint;
  };
  chainId: bigint;
}

// Gas cost table (simplified)
export interface GasCosts {
  [opcode: number]: bigint;
}