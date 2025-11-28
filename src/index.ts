// Main entry point for HasChain blockchain implementation

// Export EVM components
export * as EVM from './evm/index.js';

// Export blockchain components
export * as Blockchain from './blockchain/index.js';

// Export consensus components
export * as Consensus from './consensus/poa.js';

// Export transaction pool
export * as TxPool from './pool/txPool.js';

// Export LevelDB world state
export { LevelDBWorldState } from './evm/levelDbWorldState.js';

// Export examples
export * as Examples from './examples/blockchain-demo.js';