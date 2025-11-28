import type { Transaction } from '../evm/types.js';
import type { Address } from '../evm/types.js';
import { calculateTransactionHash } from '../blockchain/utils.js';
import { bytesToHex } from '../evm/utils.js';

// Transaction pool entry with additional metadata
export interface PoolTransaction {
  transaction: Transaction;
  hash: string;
  addedTime: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  sender: Address;
  nonce: bigint;
  priority: number;
}

// Transaction pool configuration
export interface TxPoolConfig {
  maxPoolSize: number;
  maxAccountTransactions: number;
  minGasPrice: bigint;
  blockGasLimit: bigint;
  transactionTimeout: number; // in seconds
}

// Transaction pool statistics
export interface TxPoolStats {
  pending: number;
  queued: number;
  total: number;
  gasPriceRange: { min: bigint; max: bigint };
  accountCounts: Map<string, number>;
}

// Transaction pool for managing pending transactions
export class TransactionPool {
  private config: TxPoolConfig;
  private pending: Map<string, PoolTransaction> = new Map();
  private queued: Map<string, PoolTransaction> = new Map();
  private accountTransactions: Map<string, PoolTransaction[]> = new Map();
  private nextPriority: number = 0;

  constructor(config: TxPoolConfig) {
    this.config = config;
  }

  // Get transaction pool statistics
  getStats(): TxPoolStats {
    const gasPrices: bigint[] = [];
    const accountCounts = new Map<string, number>();

    for (const tx of this.pending.values()) {
      gasPrices.push(tx.gasPrice);
      const accountKey = bytesToHex(tx.sender);
      accountCounts.set(accountKey, (accountCounts.get(accountKey) || 0) + 1);
    }

    return {
      pending: this.pending.size,
      queued: this.queued.size,
      total: this.pending.size + this.queued.size,
      gasPriceRange: {
        min: gasPrices.length > 0 ? BigInt(Math.min(...gasPrices.map(Number))) : 0n,
        max: gasPrices.length > 0 ? BigInt(Math.max(...gasPrices.map(Number))) : 0n
      },
      accountCounts
    };
  }

  // Add a transaction to the pool
  addTransaction(transaction: Transaction): { added: boolean; reason?: string } {
    try {
      // Validate transaction
      const validation = this.validateTransaction(transaction);
      if (!validation.valid) {
        return { added: false, reason: validation.reason };
      }

      const hash = bytesToHex(calculateTransactionHash(transaction));
      const sender = transaction.from || new Uint8Array(20);
      const senderHex = bytesToHex(sender);

      // Check if transaction already exists
      if (this.pending.has(hash) || this.queued.has(hash)) {
        return { added: false, reason: 'Transaction already exists in pool' };
      }

      // Create pool transaction
      const poolTx: PoolTransaction = {
        transaction,
        hash,
        addedTime: BigInt(Math.floor(Date.now() / 1000)),
        gasPrice: transaction.gasPrice || 0n,
        gasLimit: transaction.gasLimit || 0n,
        sender,
        nonce: transaction.nonce,
        priority: this.nextPriority++
      };

      // Check account transaction limit
      const accountTxs = this.accountTransactions.get(senderHex) || [];
      if (accountTxs.length >= this.config.maxAccountTransactions) {
        return { added: false, reason: 'Too many transactions for this account' };
      }

      // Add to appropriate queue based on nonce
      const currentNonce = this.getCurrentNonce(sender);
      if (transaction.nonce === currentNonce) {
        // Add to pending
        this.pending.set(hash, poolTx);
        accountTxs.push(poolTx);
      } else if (transaction.nonce > currentNonce) {
        // Add to queued
        this.queued.set(hash, poolTx);
        accountTxs.push(poolTx);
      } else {
        // Nonce too old
        return { added: false, reason: 'Transaction nonce too old' };
      }

      this.accountTransactions.set(senderHex, accountTxs);

      // Enforce pool size limit
      this.enforcePoolSizeLimit();

      return { added: true };
    } catch (error) {
      return { added: false, reason: `Error adding transaction: ${error}` };
    }
  }

  // Get transactions for block creation
  getTransactionsForBlock(gasLimit: bigint): PoolTransaction[] {
    const transactions: PoolTransaction[] = [];
    let totalGas = 0n;

    // Sort transactions by gas price (highest first) and then by priority
    const sortedTransactions = Array.from(this.pending.values()).sort((a, b) => {
      if (a.gasPrice !== b.gasPrice) {
        return b.gasPrice > a.gasPrice ? 1 : -1;
      }
      return a.priority - b.priority;
    });

    // Add transactions until gas limit is reached
    for (const tx of sortedTransactions) {
      if (totalGas + tx.gasLimit > gasLimit) {
        break;
      }
      transactions.push(tx);
      totalGas += tx.gasLimit;
    }

    return transactions;
  }

  // Remove transactions from pool (after they're included in a block)
  removeTransactions(hashes: string[]): void {
    for (const hash of hashes) {
      const pendingTx = this.pending.get(hash);
      const queuedTx = this.queued.get(hash);
      const tx = pendingTx || queuedTx;

      if (tx) {
        const senderHex = bytesToHex(tx.sender);
        const accountTxs = this.accountTransactions.get(senderHex) || [];
        
        // Remove from account transactions
        const index = accountTxs.findIndex(t => t.hash === hash);
        if (index !== -1) {
          accountTxs.splice(index, 1);
        }

        if (accountTxs.length === 0) {
          this.accountTransactions.delete(senderHex);
        } else {
          this.accountTransactions.set(senderHex, accountTxs);
        }

        // Remove from pool
        this.pending.delete(hash);
        this.queued.delete(hash);

        // Try to promote queued transactions
        this.promoteQueuedTransactions(tx.sender);
      }
    }
  }

  // Get a specific transaction
  getTransaction(hash: string): PoolTransaction | undefined {
    return this.pending.get(hash) || this.queued.get(hash);
  }

  // Get all transactions for an account
  getAccountTransactions(address: Address): PoolTransaction[] {
    const addressHex = bytesToHex(address);
    return this.accountTransactions.get(addressHex) || [];
  }

  // Get all pending transactions
  getPendingTransactions(): PoolTransaction[] {
    return Array.from(this.pending.values());
  }

  // Get all queued transactions
  getQueuedTransactions(): PoolTransaction[] {
    return Array.from(this.queued.values());
  }

  // Validate a transaction
  private validateTransaction(transaction: Transaction): { valid: boolean; reason?: string } {
    // Check minimum gas price
    if (transaction.gasPrice && transaction.gasPrice < this.config.minGasPrice) {
      return { valid: false, reason: 'Gas price too low' };
    }

    // Check gas limit
    if (transaction.gasLimit && transaction.gasLimit > this.config.blockGasLimit) {
      return { valid: false, reason: 'Gas limit exceeds block gas limit' };
    }

    if (transaction.gasLimit && transaction.gasLimit <= 0) {
      return { valid: false, reason: 'Gas limit must be positive' };
    }

    // Check nonce
    if (transaction.nonce < 0) {
      return { valid: false, reason: 'Invalid nonce' };
    }

    // Check value
    if (transaction.value && transaction.value < 0) {
      return { valid: false, reason: 'Invalid value' };
    }

    // Check sender
    if (!transaction.from) {
      return { valid: false, reason: 'Missing sender address' };
    }

    return { valid: true };
  }

  // Get current nonce for an account
  private getCurrentNonce(address: Address): bigint {
    const addressHex = bytesToHex(address);
    const accountTxs = this.accountTransactions.get(addressHex) || [];
    
    if (accountTxs.length === 0) {
      return 0n;
    }

    // Find the highest nonce
    let maxNonce = 0n;
    for (const tx of accountTxs) {
      if (tx.nonce > maxNonce) {
        maxNonce = tx.nonce;
      }
    }

    return maxNonce + 1n;
  }

  // Promote queued transactions to pending
  private promoteQueuedTransactions(sender: Address): void {
    const senderHex = bytesToHex(sender);
    const accountTxs = this.accountTransactions.get(senderHex) || [];
    const currentNonce = this.getCurrentNonce(sender);

    // Find queued transactions that can be promoted
    const toPromote: string[] = [];
    for (const tx of accountTxs) {
      if (this.queued.has(tx.hash) && tx.nonce === currentNonce) {
        toPromote.push(tx.hash);
      }
    }

    // Promote transactions
    for (const hash of toPromote) {
      const tx = this.queued.get(hash);
      if (tx) {
        this.queued.delete(hash);
        this.pending.set(hash, tx);
      }
    }
  }

  // Enforce pool size limit
  private enforcePoolSizeLimit(): void {
    const totalSize = this.pending.size + this.queued.size;
    
    if (totalSize <= this.config.maxPoolSize) {
      return;
    }

    // Remove lowest priority transactions
    const allTransactions = Array.from(this.pending.values()).concat(Array.from(this.queued.values()));
    allTransactions.sort((a, b) => {
      // First by gas price (lowest first)
      if (a.gasPrice !== b.gasPrice) {
        return a.gasPrice > b.gasPrice ? 1 : -1;
      }
      // Then by added time (oldest first)
      return a.addedTime > b.addedTime ? 1 : -1;
    });

    const toRemove = totalSize - this.config.maxPoolSize;
    for (let i = 0; i < toRemove; i++) {
      const tx = allTransactions[i];
      if (tx) {
        this.pending.delete(tx.hash);
        this.queued.delete(tx.hash);
        
        // Remove from account transactions
        const senderHex = bytesToHex(tx.sender);
        const accountTxs = this.accountTransactions.get(senderHex) || [];
        const index = accountTxs.findIndex(t => t.hash === tx.hash);
        if (index !== -1) {
          accountTxs.splice(index, 1);
        }
        
        if (accountTxs.length === 0) {
          this.accountTransactions.delete(senderHex);
        }
      }
    }
  }

  // Remove old transactions
  removeOldTransactions(): void {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeout = BigInt(this.config.transactionTimeout);
    const toRemove: string[] = [];

    for (const [hash, tx] of this.pending) {
      if (now - tx.addedTime > timeout) {
        toRemove.push(hash);
      }
    }

    for (const [hash, tx] of this.queued) {
      if (now - tx.addedTime > timeout) {
        toRemove.push(hash);
      }
    }

    this.removeTransactions(toRemove);
  }

  // Clear the entire pool
  clear(): void {
    this.pending.clear();
    this.queued.clear();
    this.accountTransactions.clear();
    this.nextPriority = 0;
  }

  // Get pool configuration
  getConfig(): TxPoolConfig {
    return { ...this.config };
  }

  // Update pool configuration
  updateConfig(newConfig: Partial<TxPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}