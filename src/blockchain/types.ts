import type { Address, Hash, Transaction } from '../evm/types.js';

// Block header structure
export interface BlockHeader {
  parentHash: Hash;           // Hash of the parent block
  number: bigint;             // Block number
  timestamp: bigint;          // Unix timestamp when block was created
  stateRoot: Hash;            // Merkle root of the world state
  transactionsRoot: Hash;    // Merkle root of transactions
  receiptsRoot: Hash;         // Merkle root of transaction receipts
  validator: Address;         // Address of the validator who created this block
  signature: Uint8Array;      // Validator's signature of the block header
  gasLimit: bigint;          // Maximum gas allowed in this block
  gasUsed: bigint;           // Total gas used by transactions in this block
  extraData: Uint8Array;     // Extra data field for future use
}

// Block structure
export interface Block {
  header: BlockHeader;
  transactions: Transaction[];
}

// Transaction receipt
export interface TransactionReceipt {
  transactionHash: Hash;     // Hash of the transaction
  blockNumber: bigint;       // Block number containing the transaction
  blockHash: Hash;           // Hash of the block containing the transaction
  transactionIndex: number;   // Index of the transaction in the block
  gasUsed: bigint;           // Gas used by the transaction
  cumulativeGasUsed: bigint; // Cumulative gas used in the block up to this transaction
  contractAddress?: Address; // Address of the contract created (if any)
  logs: Log[];               // Logs emitted by the transaction
  status: number;            // 1 = success, 0 = failure
}

// Log entry
export interface Log {
  address: Address;          // Contract address that emitted the log
  topics: Hash[];            // Log topics
  data: Uint8Array;          // Log data
}

// Blockchain configuration
export interface BlockchainConfig {
  chainId: bigint;           // Chain identifier
  blockTime: number;         // Target block time in seconds
  gasLimit: bigint;          // Default gas limit for blocks
  difficulty: bigint;        // Mining difficulty (for PoW, unused in PoA)
  validators: Address[];     // Initial validator set
  reward: bigint;            // Block reward for validators
}

// Genesis block configuration
export interface GenesisConfig {
  alloc: Map<Address, { balance: bigint; nonce?: bigint; code?: Uint8Array; storage?: Map<string, bigint> }>;
  config: BlockchainConfig;
  timestamp?: bigint;
  extraData?: Uint8Array;
}

// Chain state information
export interface ChainState {
  currentBlock: Block;        // Current head of the chain
  totalDifficulty: bigint;    // Total difficulty (for PoW, unused in PoA)
  validators: Address[];      // Current validator set
  pendingTransactions: Transaction[]; // Pending transactions
}

// Block validation result
export interface BlockValidationResult {
  valid: boolean;
  error?: string;
  gasUsed?: bigint;
  stateRoot?: Hash;
  receiptsRoot?: Hash;
}

// Fork choice rule result
export interface ForkChoiceResult {
  action: 'extend' | 'reorg' | 'ignore';
  newChain?: Block[];
  commonAncestor?: Block;
}