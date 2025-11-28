import type { Block, BlockHeader, TransactionReceipt, BlockValidationResult } from './types.js';
import type { Transaction, Address, Hash } from '../evm/types.js';
import type { IWorldState } from '../evm/worldState.js';
import type { PoAConsensus } from '../consensus/poa.js';
import type { TransactionPool, PoolTransaction } from '../pool/txPool.js';
import { 
  calculateBlockHash, calculateTransactionsRoot, calculateReceiptsRoot,
  serializeTransaction, calculateTransactionHash 
} from './utils.js';
import { bytesToHex } from '../evm/utils.js';

// Block processing options
export interface BlockProcessingOptions {
  maxTransactions: number;
  gasLimit: bigint;
  blockTime: number;
  reward: bigint;
}

// Block processing result
export interface BlockProcessingResult {
  success: boolean;
  block?: Block;
  receipts?: TransactionReceipt[];
  error?: string;
  gasUsed?: bigint;
  stateRoot?: Hash;
}

// Transaction execution result
export interface TransactionExecutionResult {
  success: boolean;
  receipt?: TransactionReceipt;
  error?: string;
  gasUsed?: bigint;
}

// Block processor for creating and validating blocks
export class BlockProcessor {
  private worldState: IWorldState;
  private consensus: PoAConsensus;
  private txPool: TransactionPool;
  private options: BlockProcessingOptions;

  constructor(
    worldState: IWorldState,
    consensus: PoAConsensus,
    txPool: TransactionPool,
    options: BlockProcessingOptions
  ) {
    this.worldState = worldState;
    this.consensus = consensus;
    this.txPool = txPool;
    this.options = options;
  }

  // Create a new block
  createBlock(parentBlock: Block, validator: Address): BlockProcessingResult {
    try {
      // Get transactions from pool
      const poolTransactions = this.txPool.getTransactionsForBlock(this.options.gasLimit);
      
      // Execute transactions
      const executionResults: TransactionExecutionResult[] = [];
      const receipts: TransactionReceipt[] = [];
      let totalGasUsed = 0n;
      
      // Create snapshot before execution
      const snapshotId = this.worldState.snapshot();
      
      for (const poolTx of poolTransactions) {
        if (totalGasUsed + poolTx.gasLimit > this.options.gasLimit) {
          break; // Block gas limit reached
        }

        const result = this.executeTransaction(poolTx.transaction, parentBlock.header.number + 1n);
        executionResults.push(result);
        
        if (result.success && result.receipt) {
          receipts.push(result.receipt);
          totalGasUsed += result.gasUsed || 0n;
        } else {
          // Transaction failed, but we continue with other transactions
          console.warn(`Transaction failed: ${result.error}`);
        }
      }

      // Calculate state root
      const stateRoot = this.calculateStateRoot();

      // Create block header
      const header: BlockHeader = {
        parentHash: calculateBlockHash(parentBlock),
        number: parentBlock.header.number + 1n,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        stateRoot,
        transactionsRoot: calculateTransactionsRoot(poolTransactions.map(tx => tx.transaction)),
        receiptsRoot: calculateReceiptsRoot(receipts),
        validator,
        signature: new Uint8Array(0), // Will be signed by consensus
        gasLimit: this.options.gasLimit,
        gasUsed: totalGasUsed,
        extraData: new Uint8Array(0)
      };

      // Sign block header
      const signedHeader = this.consensus.signBlockHeader(header, validator);

      // Create block
      const block: Block = {
        header: signedHeader,
        transactions: poolTransactions.map(tx => tx.transaction)
      };

      // Commit state changes
      this.worldState.commit(snapshotId);

      // Remove processed transactions from pool
      const processedHashes = poolTransactions.map(tx => tx.hash);
      this.txPool.removeTransactions(processedHashes);

      return {
        success: true,
        block,
        receipts,
        gasUsed: totalGasUsed,
        stateRoot
      };

    } catch (error) {
      return {
        success: false,
        error: `Block creation failed: ${error}`
      };
    }
  }

  // Execute a single transaction
  private executeTransaction(transaction: Transaction, blockNumber: bigint): TransactionExecutionResult {
    try {
      // Create snapshot before transaction execution
      const snapshotId = this.worldState.snapshot();

      // Validate transaction against current state
      const sender = transaction.from || new Uint8Array(20);
      const balance = this.worldState.getBalance(sender);
      const nonce = this.worldState.getNonce(sender);
      
      const gasCost = (transaction.gasLimit || 0n) * (transaction.gasPrice || 0n);
      const totalCost = gasCost + (transaction.value || 0n);

      // Check if transaction is still valid
      if (transaction.nonce !== nonce) {
        this.worldState.revert(snapshotId);
        return {
          success: false,
          error: 'Invalid nonce',
          gasUsed: 0n
        };
      }

      if (balance < totalCost) {
        this.worldState.revert(snapshotId);
        return {
          success: false,
          error: 'Insufficient balance',
          gasUsed: 0n
        };
      }

      // Deduct gas cost upfront
      this.worldState.subBalance(sender, gasCost);
      this.worldState.incrementNonce(sender);

      // Execute transaction using EVM
      const gasLimit = transaction.gasLimit || 0n;
      const gasPrice = transaction.gasPrice || 0n;
      
      // This is where you'd integrate with your EVM implementation
      // For now, we'll simulate execution
      const executionResult = this.simulateTransactionExecution(transaction, gasLimit);

      // Create receipt
      const receipt: TransactionReceipt = {
        transactionHash: calculateTransactionHash(transaction),
        blockNumber,
        blockHash: new Uint8Array(32), // Will be set when block is finalized
        transactionIndex: 0, // Will be set when block is finalized
        gasUsed: executionResult.gasUsed,
        cumulativeGasUsed: 0n, // Will be calculated when block is finalized
        contractAddress: executionResult.contractAddress,
        logs: executionResult.logs || [],
        status: executionResult.success ? 1 : 0
      };

      // Refund unused gas
      const unusedGas = gasLimit - executionResult.gasUsed;
      const refundAmount = unusedGas * gasPrice;
      this.worldState.addBalance(sender, refundAmount);

      // If transaction failed, revert state changes except for gas deduction
      if (!executionResult.success) {
        this.worldState.revert(snapshotId);
        // Re-deduct gas cost
        this.worldState.subBalance(sender, gasCost);
        this.worldState.incrementNonce(sender);
      }

      return {
        success: executionResult.success,
        receipt,
        gasUsed: executionResult.gasUsed,
        error: executionResult.error
      };

    } catch (error) {
      return {
        success: false,
        error: `Transaction execution error: ${error}`,
        gasUsed: 0n
      };
    }
  }

  // Simulate transaction execution (placeholder for EVM integration)
  private simulateTransactionExecution(transaction: Transaction, gasLimit: bigint): {
    success: boolean;
    gasUsed: bigint;
    contractAddress?: Address;
    logs?: any[];
    error?: string;
  } {
    // This is a simplified simulation
    // In a real implementation, you'd use your EVM here
    
    const gasUsed = gasLimit / 2n; // Assume half the gas is used
    const success = true; // Assume success for now

    if (transaction.to) {
      // Regular transaction
      return {
        success,
        gasUsed,
        error: success ? undefined : 'Execution failed'
      };
    } else {
      // Contract creation
      // Generate a contract address (simplified)
      const sender = transaction.from || new Uint8Array(20);
      const nonce = transaction.nonce;
      const contractAddress = this.generateContractAddress(sender, nonce);

      return {
        success,
        gasUsed,
        contractAddress,
        error: success ? undefined : 'Contract creation failed'
      };
    }
  }

  // Generate contract address (simplified)
  private generateContractAddress(sender: Address, nonce: bigint): Address {
    // This is a simplified version
    // In a real implementation, you'd use the proper RLP encoding
    const combined = new Uint8Array([
      ...sender,
      ...new Uint8Array([Number(nonce)])
    ]);
    
    // Create a simple hash (in production, use keccak256)
    const hash = new Uint8Array(32);
    for (let i = 0; i < combined.length; i++) {
      hash[i % 32]! ^= combined[i]!;
    }
    
    // Take last 20 bytes as address
    return hash.slice(-20);
  }

  // Calculate state root (simplified)
  private calculateStateRoot(): Hash {
    // This is a simplified implementation
    // In a real blockchain, you'd calculate a proper Merkle root of the state
    return new Uint8Array(32).fill(1); // Non-zero hash to indicate non-empty state
  }

  // Validate a block
  validateBlock(block: Block, parentBlock?: Block): BlockValidationResult {
    try {
      // Validate block header using consensus
      const headerValidation = this.consensus.validateBlockHeader(block.header, parentBlock?.header);
      if (!headerValidation.valid) {
        return { valid: false, error: headerValidation.error };
      }

      // Validate block hash
      const expectedHash = calculateBlockHash(block);
      // Note: In a real implementation, you'd compare against a known hash
      // For now, we just ensure it's non-zero

      // Validate transactions
      let totalGasUsed = 0n;
      const transactionHashes: string[] = [];

      for (let i = 0; i < block.transactions.length; i++) {
        const tx = block.transactions[i];
        if (!tx) {
          return { valid: false, error: `Transaction at index ${i} is undefined` };
        }
        
        const txHash = bytesToHex(calculateTransactionHash(tx));

        // Check for duplicate transactions
        if (transactionHashes.includes(txHash)) {
          return { valid: false, error: 'Duplicate transaction in block' };
        }
        transactionHashes.push(txHash);

        // Validate transaction against current state
        const validation = this.validateTransactionAgainstState(tx, block.header.number);
        if (!validation.valid) {
          return { valid: false, error: `Invalid transaction at index ${i}: ${validation.error}` };
        }

        totalGasUsed += tx.gasLimit || 0n;
      }

      // Check gas usage
      if (totalGasUsed !== block.header.gasUsed) {
        return { valid: false, error: 'Block gas used mismatch' };
      }

      if (totalGasUsed > block.header.gasLimit) {
        return { valid: false, error: 'Block gas limit exceeded' };
      }

      // Validate transaction root
      const expectedTransactionsRoot = calculateTransactionsRoot(block.transactions);
      const transactionsRootHex = bytesToHex(block.header.transactionsRoot);
      const expectedRootHex = bytesToHex(expectedTransactionsRoot);
      
      if (transactionsRootHex !== expectedRootHex) {
        return { valid: false, error: 'Invalid transactions root' };
      }

      return { 
        valid: true, 
        gasUsed: totalGasUsed,
        stateRoot: block.header.stateRoot,
        receiptsRoot: block.header.receiptsRoot
      };

    } catch (error) {
      return { valid: false, error: `Block validation error: ${error}` };
    }
  }

  // Validate transaction against current state
  private validateTransactionAgainstState(transaction: Transaction, blockNumber: bigint): { valid: boolean; error?: string } {
    try {
      const sender = transaction.from || new Uint8Array(20);
      
      // Check sender exists
      if (!this.worldState.accountExists(sender)) {
        return { valid: false, error: 'Sender account does not exist' };
      }

      // Check nonce
      const currentNonce = this.worldState.getNonce(sender);
      if (transaction.nonce !== currentNonce) {
        return { valid: false, error: 'Invalid nonce' };
      }

      // Check balance
      const balance = this.worldState.getBalance(sender);
      const gasCost = (transaction.gasLimit || 0n) * (transaction.gasPrice || 0n);
      const totalCost = gasCost + (transaction.value || 0n);

      if (balance < totalCost) {
        return { valid: false, error: 'Insufficient balance' };
      }

      // Check gas limit
      if (transaction.gasLimit && transaction.gasLimit <= 0) {
        return { valid: false, error: 'Invalid gas limit' };
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, error: `Transaction validation error: ${error}` };
    }
  }

  // Get processing options
  getOptions(): BlockProcessingOptions {
    return { ...this.options };
  }

  // Update processing options
  updateOptions(newOptions: Partial<BlockProcessingOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}