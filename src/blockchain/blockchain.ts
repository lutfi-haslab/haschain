import type { 
  Block, BlockHeader, BlockchainConfig, GenesisConfig, 
  ChainState, BlockValidationResult, ForkChoiceResult 
} from './types.js';
import type { IWorldState } from '../evm/worldState.js';
import type { Transaction, Address, Hash } from '../evm/types.js';
import { 
  serializeBlockHeader, calculateBlockHash, calculateTransactionsRoot, 
  calculateReceiptsRoot, hashEquals, addressEquals, isValidAddress, isValidHash 
} from './utils.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

export class Blockchain {
  private worldState: IWorldState;
  private config: BlockchainConfig;
  private currentBlock: Block;
  private blocks: Map<string, Block> = new Map();
  private blockByNumber: Map<bigint, Block> = new Map();
  private validators: Address[];
  private currentValidatorIndex: number = 0;

  constructor(worldState: IWorldState, config: BlockchainConfig) {
    this.worldState = worldState;
    this.config = config;
    this.validators = [...config.validators];
    
    // Initialize with genesis block
    this.currentBlock = this.createGenesisBlock();
    this.addBlock(this.currentBlock);
  }

  // Get current chain state
  getChainState(): ChainState {
    return {
      currentBlock: this.currentBlock,
      totalDifficulty: 0n, // Not used in PoA
      validators: [...this.validators],
      pendingTransactions: []
    };
  }

  // Get current block
  getCurrentBlock(): Block {
    return this.currentBlock;
  }

  // Get block by hash
  getBlock(hash: Hash): Block | undefined {
    return this.blocks.get(bytesToHex(hash));
  }

  // Get block by number
  getBlockByNumber(number: bigint): Block | undefined {
    return this.blockByNumber.get(number);
  }

  // Get latest block number
  getLatestBlockNumber(): bigint {
    return this.currentBlock.header.number;
  }

  // Add a new block to the chain
  addBlock(block: Block): boolean {
    const hash = calculateBlockHash(block);
    const hashHex = bytesToHex(hash);
    
    // Check if block already exists
    if (this.blocks.has(hashHex)) {
      return false;
    }

    // Validate block
    const validation = this.validateBlock(block);
    if (!validation.valid) {
      throw new Error(`Invalid block: ${validation.error}`);
    }

    // Add to storage
    this.blocks.set(hashHex, block);
    this.blockByNumber.set(block.header.number, block);

    // Update current block if this extends the chain
    if (block.header.number > this.currentBlock.header.number) {
      this.currentBlock = block;
    }

    return true;
  }

  // Validate a block
  validateBlock(block: Block): BlockValidationResult {
    try {
      // Check block structure
      if (!block.header || !block.transactions) {
        return { valid: false, error: 'Invalid block structure' };
      }

      // Check parent block exists (except for genesis)
      if (block.header.number > 0n) {
        const parentHashHex = bytesToHex(block.header.parentHash);
        if (!this.blocks.has(parentHashHex)) {
          return { valid: false, error: 'Parent block not found' };
        }

        const parentBlock = this.blocks.get(parentHashHex)!;
        if (parentBlock.header.number !== block.header.number - 1n) {
          return { valid: false, error: 'Invalid block number' };
        }
      }

      // Check validator
      if (!this.isValidValidator(block.header.validator, block.header.number)) {
        return { valid: false, error: 'Invalid validator' };
      }

      // Check timestamp
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (block.header.timestamp > now + 60n) { // Allow 1 minute future
        return { valid: false, error: 'Block timestamp too far in future' };
      }

      if (block.header.number > 0n) {
        const parentBlock = this.blocks.get(bytesToHex(block.header.parentHash))!;
        if (block.header.timestamp <= parentBlock.header.timestamp) {
          return { valid: false, error: 'Block timestamp must be greater than parent' };
        }
      }

      // Check gas limit
      if (block.header.gasLimit !== this.config.gasLimit) {
        return { valid: false, error: 'Invalid gas limit' };
      }

      // Check gas used
      if (block.header.gasUsed > block.header.gasLimit) {
        return { valid: false, error: 'Gas used exceeds gas limit' };
      }

      // Validate transactions
      let totalGasUsed = 0n;
      for (const tx of block.transactions) {
        // Basic transaction validation
        if (!this.validateTransaction(tx, block.header.number)) {
          return { valid: false, error: 'Invalid transaction in block' };
        }
        totalGasUsed += tx.gasLimit || 0n;
      }

      if (totalGasUsed !== block.header.gasUsed) {
        return { valid: false, error: 'Gas used mismatch' };
      }

      // Calculate and verify roots
      const transactionsRoot = calculateTransactionsRoot(block.transactions);
      if (!hashEquals(transactionsRoot, block.header.transactionsRoot)) {
        return { valid: false, error: 'Invalid transactions root' };
      }

      // Note: We can't verify state root and receipts root without executing transactions
      // This would be done during block execution

      return { 
        valid: true, 
        gasUsed: block.header.gasUsed,
        stateRoot: block.header.stateRoot,
        receiptsRoot: block.header.receiptsRoot
      };

    } catch (error) {
      return { valid: false, error: `Validation error: ${error}` };
    }
  }

  // Check if address is a valid validator for the given block number
  private isValidValidator(validator: Address, blockNumber: bigint): boolean {
    if (blockNumber === 0n) {
      // Genesis block can have any validator
      return true;
    }

    // Simple round-robin validator selection
    const validatorIndex = Number(blockNumber % BigInt(this.validators.length));
    const expectedValidator = this.validators[validatorIndex];
    return expectedValidator ? addressEquals(validator, expectedValidator) : false;
  }

  // Validate transaction
  private validateTransaction(tx: Transaction, blockNumber: bigint): boolean {
    // Basic validation
    if (!tx.from || !isValidAddress(tx.from)) {
      return false;
    }

    if (tx.to && !isValidAddress(tx.to)) {
      return false;
    }

    if (tx.nonce < 0) {
      return false;
    }

    if (tx.gasLimit && tx.gasLimit < 0) {
      return false;
    }

    if (tx.gasPrice && tx.gasPrice < 0) {
      return false;
    }

    if (tx.value && tx.value < 0) {
      return false;
    }

    // Check nonce against account state
    const accountNonce = this.worldState.getNonce(tx.from);
    if (tx.nonce !== accountNonce) {
      return false;
    }

    // Check balance
    const accountBalance = this.worldState.getBalance(tx.from);
    const gasCost = (tx.gasLimit || 0n) * (tx.gasPrice || 0n);
    const totalCost = gasCost + (tx.value || 0n);
    
    if (accountBalance < totalCost) {
      return false;
    }

    return true;
  }

  // Create genesis block
  private createGenesisBlock(): Block {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    
    const header: BlockHeader = {
      parentHash: new Uint8Array(32), // Zero hash for genesis
      number: 0n,
      timestamp,
      stateRoot: new Uint8Array(32), // Will be set after state initialization
      transactionsRoot: calculateTransactionsRoot([]),
      receiptsRoot: calculateReceiptsRoot([]),
      validator: this.validators[0] || new Uint8Array(20),
      signature: new Uint8Array(0), // No signature needed for genesis
      gasLimit: this.config.gasLimit,
      gasUsed: 0n,
      extraData: new Uint8Array(0)
    };

    return {
      header,
      transactions: []
    };
  }

  // Initialize genesis state
  initializeGenesisState(genesisConfig: GenesisConfig): void {
    // Set up initial accounts
    for (const [address, accountData] of genesisConfig.alloc) {
      // Create account with initial balance
      this.worldState.addBalance(address, accountData.balance);
      
      if (accountData.nonce !== undefined) {
        this.worldState.setNonce(address, accountData.nonce);
      }
      
      if (accountData.code) {
        this.worldState.setCode(address, accountData.code);
      }
      
      if (accountData.storage) {
        for (const [key, value] of accountData.storage) {
          this.worldState.setStorage(address, BigInt('0x' + key), value);
        }
      }
    }

    // Update genesis block state root
    // Note: In a real implementation, you'd calculate the actual state root
    // For now, we'll use a placeholder
    this.currentBlock.header.stateRoot = new Uint8Array(32);
  }

  // Get next validator
  getNextValidator(): Address {
    if (this.validators.length === 0) {
      throw new Error('No validators configured');
    }
    
    const validatorIndex = (this.currentValidatorIndex + 1) % this.validators.length;
    this.currentValidatorIndex = validatorIndex;
    return this.validators[validatorIndex]!;
  }

  // Add validator
  addValidator(address: Address): void {
    if (!isValidAddress(address)) {
      throw new Error('Invalid validator address');
    }

    if (!this.validators.some(v => addressEquals(v, address))) {
      this.validators.push(address);
    }
  }

  // Remove validator
  removeValidator(address: Address): void {
    const index = this.validators.findIndex(v => addressEquals(v, address));
    if (index !== -1) {
      this.validators.splice(index, 1);
    }
  }

  // Get validators
  getValidators(): Address[] {
    return [...this.validators];
  }

  // Handle fork choice
  handleForkChoice(newBlock: Block): ForkChoiceResult {
    const newBlockHash = calculateBlockHash(newBlock);
    
    // Check if we already have this block
    if (this.blocks.has(bytesToHex(newBlockHash))) {
      return { action: 'ignore' };
    }

    // Check if this extends our current chain
    if (hashEquals(newBlock.header.parentHash, calculateBlockHash(this.currentBlock))) {
      return { action: 'extend' };
    }

    // Check if we need to reorg
    const commonAncestor = this.findCommonAncestor(newBlock);
    if (commonAncestor) {
      const newChain = this.buildNewChain(newBlock, commonAncestor);
      if (newChain.length > 0) {
        return { 
          action: 'reorg', 
          newChain, 
          commonAncestor 
        };
      }
    }

    return { action: 'ignore' };
  }

  // Find common ancestor between current chain and new block
  private findCommonAncestor(newBlock: Block): Block | undefined {
    let current = newBlock;
    
    // Traverse back from new block
    while (current.header.number > 0n) {
      const parentHashHex = bytesToHex(current.header.parentHash);
      const parent = this.blocks.get(parentHashHex);
      
      if (parent) {
        return parent;
      }
      
      // We don't have the parent, so we can't find common ancestor
      break;
    }

    return undefined;
  }

  // Build new chain from common ancestor to new block
  private buildNewChain(newBlock: Block, commonAncestor: Block): Block[] {
    const chain: Block[] = [];
    let current = newBlock;
    
    // Build chain backwards from new block to common ancestor
    while (current.header.number > commonAncestor.header.number) {
      chain.unshift(current);
      
      const parentHashHex = bytesToHex(current.header.parentHash);
      const parent = this.blocks.get(parentHashHex);
      if (!parent) {
        return []; // Can't build complete chain
      }
      
      current = parent;
    }

    return chain;
  }
}

// Helper function to convert bytes to hex
function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}