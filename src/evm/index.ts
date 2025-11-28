// Export all types
export type {
  Address,
  Hash,
  Bytes,
  Word,
  Account,
  Transaction,
  ExecutionResult,
  Log,
  Env,
  GasCosts
} from './types.js';

// Export WorldState
export type { IWorldState, Snapshot } from './worldState.js';
export { InMemoryWorldState } from './worldState.js';

// Export EVM components
export { Evm, evm } from './core.js';
export { ExecutionContext } from './executionContext.js';
export { OPCODES, GAS_COSTS, createOpcodeHandlers } from './opcodes.js';

// Export transaction components
export { TransactionExecutor, txExecutor } from './transaction.js';

// Export high-level helpers
export { EvmHelper, evmHelper } from './evmHelpers.js';
export {
  addressFromHex,
  addressToHex,
  createRandomAddress
} from './evmHelpers.js';

// Export utilities
export {
  hexToBytes,
  bytesToHex,
  bigintToWord,
  wordToBigint,
  bigintToBytes,
  bytesToBigint,
  addressFromHash,
  generateContractAddress,
  addressEquals,
  zeroAddress,
  zeroHash,
  storageKeyToString,
  storageKeyFromString,
  padBytes,
  toWord
} from './utils.js';


// Export bytecode builder
export { BytecodeBuilder, createDeploymentBytecode } from './bytecodeBuilder.js';

// Export compiler DSL
export { Contract, $ } from './compiler/compiler.js';

// Export ABI helpers
export {
  selector,
  selectorAsNumber,
  encodeUint256,
  decodeUint256,
  encodeAddress,
  decodeAddress,
  encodeBool,
  decodeBool,
  encodeCall,
} from './abiHelpers.js';
