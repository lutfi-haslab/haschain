import type { Block, BlockchainConfig, GenesisConfig, ForkChoiceResult } from './types.js';
import type { Transaction, Address } from '../evm/types.js';
import type { IWorldState } from '../evm/worldState.js';
import { Blockchain } from './blockchain.js';
import { PoAConsensus } from '../consensus/poa.js';
import { TransactionPool, type TxPoolConfig } from '../pool/txPool.js';
import { BlockProcessor, type BlockProcessingOptions } from './processor.js';
import { BlockchainStorage, type StorageConfig } from './storage.js';
import { createDevGenesisConfig, validateGenesisConfig } from './genesis.js';
import { LevelDBWorldState } from '../evm/levelDbWorldState.js';

// Blockchain manager configuration
export interface BlockchainManagerConfig {
  storage: StorageConfig;
  blockchain: BlockchainConfig;
  txPool: TxPoolConfig;
  processing: BlockProcessingOptions;
}

// Blockchain manager that coordinates all blockchain components
export class BlockchainManager {
  private storage: BlockchainStorage;
  private worldState: IWorldState;
  private blockchain: Blockchain;
  private consensus: PoAConsensus;
  private txPool: TransactionPool;
  private processor: BlockProcessor;
  private config: BlockchainManagerConfig;
  private isInitialized: boolean = false;

  constructor(config: BlockchainManagerConfig) {
    this.config = config;
    
    // Initialize storage
    this.storage = new BlockchainStorage(config.storage);
    
    // Initialize world state (using LevelDB implementation with separate path)
    this.worldState = new LevelDBWorldState(config.storage.dbPath + '-state');
    
    // Initialize consensus
    this.consensus = new PoAConsensus(config.blockchain);
    
    // Initialize transaction pool
    this.txPool = new TransactionPool(config.txPool);
    
    // Initialize block processor
    this.processor = new BlockProcessor(
      this.worldState,
      this.consensus,
      this.txPool,
      config.processing
    );
    
    // Initialize blockchain
    this.blockchain = new Blockchain(this.worldState, config.blockchain);
  }

  // Initialize blockchain with genesis configuration
  async initialize(genesisConfig?: GenesisConfig): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Blockchain already initialized');
    }

    try {
      // Initialize storage
      await this.storage.initialize();
      
      // Use provided genesis config or create default
      const config = genesisConfig || createDevGenesisConfig();
      
      // Validate genesis configuration
      const validation = validateGenesisConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid genesis configuration: ${validation.error}`);
      }
      
      // Initialize blockchain state
      this.blockchain.initializeGenesisState(config);
      
      // Get or create genesis block
      let genesisBlock = await this.storage.getChainTip();
      
      if (!genesisBlock) {
        // Create new genesis block
        genesisBlock = this.createGenesisBlock(config);
        await this.storage.storeBlock(genesisBlock);
      }
      
      // Initialize validators from genesis config
      for (const validator of config.config.validators) {
        try {
          this.consensus.addValidator(validator);
        } catch (e) {
          // Validator might already exist from config
        }
      }
      
      // Update consensus state
      this.consensus.updateValidatorState(genesisBlock);
      
      this.isInitialized = true;
      
      console.log('Blockchain initialized successfully');
      console.log(`Genesis block: ${await this.storage.getChainTipHash()}`);
      console.log(`Validators: ${this.consensus.getValidators().length}`);
      
    } catch (error) {
      throw new Error(`Failed to initialize blockchain: ${error}`);
    }
  }

  // Create genesis block
  private createGenesisBlock(config: GenesisConfig): Block {
    const timestamp = config.timestamp || BigInt(Math.floor(Date.now() / 1000));
    
    return {
      header: {
        parentHash: new Uint8Array(32), // Zero hash for genesis
        number: 0n,
        timestamp,
        stateRoot: new Uint8Array(32), // Will be calculated after state initialization
        transactionsRoot: new Uint8Array(32), // Empty transactions
        receiptsRoot: new Uint8Array(32), // Empty receipts
        validator: config.config.validators[0] || new Uint8Array(20),
        signature: new Uint8Array(0), // No signature for genesis
        gasLimit: config.config.gasLimit,
        gasUsed: 0n,
        extraData: config.extraData || new Uint8Array(0)
      },
      transactions: []
    };
  }

  // Get current blockchain state
  async getBlockchainInfo(): Promise<{
    blockNumber: bigint;
    blockHash: string;
    validators: Address[];
    txPoolStats: any;
    storageStats: any;
  }> {
    if (!this.isInitialized) {
      throw new Error('Blockchain not initialized');
    }

    const tip = await this.storage.getChainTip();
    const tipHash = await this.storage.getChainTipHash();
    const tipNumber = await this.storage.getChainTipNumber();
    
    return {
      blockNumber: tipNumber || 0n,
      blockHash: tipHash || '0x',
      validators: this.consensus.getValidators().map(v => v.address),
      txPoolStats: this.txPool.getStats(),
      storageStats: await this.storage.getStats()
    };
  }

  // Add a transaction to the pool
  addTransaction(transaction: Transaction): { added: boolean; reason?: string } {
    if (!this.isInitialized) {
      return { added: false, reason: 'Blockchain not initialized' };
    }

    return this.txPool.addTransaction(transaction);
  }

  // Get transactions from pool
  getPendingTransactions(): any[] {
    if (!this.isInitialized) {
      return [];
    }

    return this.txPool.getPendingTransactions();
  }

  // Create a new block
  async createBlock(validatorAddress?: Address): Promise<{
    success: boolean;
    block?: Block;
    error?: string;
  }> {
    if (!this.isInitialized) {
      return { success: false, error: 'Blockchain not initialized' };
    }

    try {
      // Get current tip
      const currentTip = await this.storage.getChainTip();
      if (!currentTip) {
        return { success: false, error: 'No current block found' };
      }

      // Get validator for this block
      const validator = validatorAddress || this.consensus.getNextValidator();
      if (!validator) {
        return { success: false, error: 'No validator available' };
      }

      // Create block
      const result = this.processor.createBlock(currentTip, validator);
      
      if (result.success && result.block) {
        // Store block
        await this.storage.storeBlock(result.block);
        
        // Update consensus
        this.consensus.updateValidatorState(result.block);
        
        console.log(`Block created: ${await this.storage.getChainTipHash()}`);
      }

      return {
        success: result.success,
        block: result.block,
        error: result.error
      };

    } catch (error) {
      return { success: false, error: `Block creation failed: ${error}` };
    }
  }

  // Validate and add a block (for receiving blocks from other nodes)
  async addBlock(block: Block): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.isInitialized) {
      return { success: false, error: 'Blockchain not initialized' };
    }

    try {
      // Get parent block for validation
      const parentBlock = block.header.number > 0n 
        ? await this.storage.getBlockByNumber(block.header.number - 1n)
        : undefined;

      // Validate block
      const validation = this.processor.validateBlock(block, parentBlock || undefined);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check for reorg
      const currentTip = await this.storage.getChainTip();
      if (currentTip) {
        const forkChoice = this.consensus.shouldReorg(block, currentTip);
        
        if ((forkChoice as any).action === 'reorg') {
          // Handle reorganization
          await this.handleReorg(block, forkChoice as ForkChoiceResult);
        } else if ((forkChoice as any).action === 'extend') {
          // Simply add the block
          await this.storage.storeBlock(block);
          this.consensus.updateValidatorState(block);
          this.txPool.removeTransactions(block.transactions.map(tx =>
            this.calculateTransactionHash(tx)
          ));
          
          console.log(`Block added: ${this.calculateBlockHash(block)}`);
        } else {
          return { success: false, error: 'Block ignored' };
        }
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: `Block addition failed: ${error}` };
    }
  }

  // Handle blockchain reorganization
  private async handleReorg(newBlock: Block, forkChoice: ForkChoiceResult): Promise<void> {
    console.log('Handling reorganization...');
    
    if (!forkChoice.newChain || !forkChoice.commonAncestor) {
      throw new Error('Invalid fork choice for reorg');
    }

    // Remove blocks from old chain
    const currentTip = await this.storage.getChainTip();
    if (currentTip) {
      let currentBlock = currentTip;
      while (currentBlock.header.number > forkChoice.commonAncestor.header.number) {
        const blockHash = this.calculateBlockHash(currentBlock);
        await this.storage.deleteBlock(blockHash);
        
        // Add transactions back to pool
        this.txPool.removeTransactions(currentBlock.transactions.map(tx => 
          this.calculateTransactionHash(tx)
        ));
        
        // Move to parent
        const parentHash = this.calculateBlockHash({ header: currentBlock.header, transactions: [] });
        const parentBlock = await this.storage.getBlock(parentHash);
        currentBlock = parentBlock || currentBlock;
      }
    }

    // Add new chain blocks
    for (const block of forkChoice.newChain) {
      await this.storage.storeBlock(block);
      this.consensus.updateValidatorState(block);
      
      // Remove transactions from pool
      this.txPool.removeTransactions(block.transactions.map(tx => 
        this.calculateTransactionHash(tx)
      ));
    }

    console.log('Reorganization completed');
  }

  // Get a block by hash
  async getBlock(hash: string): Promise<Block | null> {
    if (!this.isInitialized) {
      return null;
    }

    return this.storage.getBlock(hash);
  }

  // Get a block by number
  async getBlockByNumber(number: bigint): Promise<Block | null> {
    if (!this.isInitialized) {
      return null;
    }

    return this.storage.getBlockByNumber(number);
  }

  // Get latest blocks
  async getLatestBlocks(count: number): Promise<Block[]> {
    if (!this.isInitialized) {
      return [];
    }

    return this.storage.getLatestBlocks(count);
  }

  // Get transaction by hash
  async getTransaction(hash: string): Promise<Transaction | null> {
    if (!this.isInitialized) {
      return null;
    }

    return this.storage.getTransaction(hash);
  }

  // Get validator information
  getValidatorInfo(): any[] {
    if (!this.isInitialized) {
      return [];
    }

    return this.consensus.getValidatorStats();
  }

  // Add a validator
  addValidator(address: Address): void {
    if (!this.isInitialized) {
      throw new Error('Blockchain not initialized');
    }

    this.consensus.addValidator(address);
  }

  // Remove a validator
  removeValidator(address: Address): void {
    if (!this.isInitialized) {
      throw new Error('Blockchain not initialized');
    }

    this.consensus.removeValidator(address);
  }

  // Close blockchain manager
  async close(): Promise<void> {
    if (this.storage) {
      await this.storage.close();
    }
    
    if (this.worldState && 'close' in this.worldState) {
      await (this.worldState as any).close();
    }
    
    this.isInitialized = false;
  }

  // Get blockchain statistics
  async getStats(): Promise<{
    totalBlocks: number;
    totalTransactions: number;
    chainTip: string | null;
    chainTipNumber: bigint | null;
  }> {
    if (!this.isInitialized) {
      return {
        totalBlocks: 0,
        totalTransactions: 0,
        chainTip: null,
        chainTipNumber: null
      };
    }

    return this.storage.getStats();
  }

  // Helper method to calculate block hash
  private calculateBlockHash(block: Block): string {
    const hash = this.calculateTransactionHash(block.header);
    return hash;
  }

  // Helper method to calculate transaction hash
  private calculateTransactionHash(tx: any): string {
    // Simple hash calculation (in production, use proper keccak256)
    const txJson = JSON.stringify(tx);
    const encoder = new TextEncoder();
    const data = encoder.encode(txJson);
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i]!;
      hash = hash & hash;
      hash = ((hash >> 2) & 0x0fffffff) + (hash << 4);
      hash = hash ^ (hash >> 12);
      hash = hash * 0x1000193;
      hash = hash ^ (hash >> 16);
      hash = hash * 0x85ebca6b;
      hash = hash ^ (hash >> 13);
      hash = hash * 0xc2b2ae35;
      hash = hash ^ (hash >> 16);
    }
    
    return hash.toString(16).padStart(8, '0');
  }
}