import type { Block, BlockHeader } from './types.js';
import type { Transaction, Hash } from '../evm/types.js';
import { serializeBlock, serializeBlockHeader, calculateBlockHash } from './utils.js';
import { bytesToHex, hexToBytes } from '../evm/utils.js';
import { Level } from 'level';

// Storage configuration
export interface StorageConfig {
  dbPath: string;
  createIfMissing: boolean;
  errorIfExists: boolean;
}

// Block storage metadata
export interface BlockMetadata {
  hash: string;
  number: bigint;
  parentHash: string;
  timestamp: bigint;
  transactionCount: number;
  gasUsed: bigint;
  gasLimit: bigint;
}

// Blockchain storage using LevelDB
export class BlockchainStorage {
  private db: Level<string, string>;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.db = new Level(config.dbPath, {
      valueEncoding: 'utf8',
      keyEncoding: 'utf8',
      createIfMissing: config.createIfMissing,
      errorIfExists: config.errorIfExists
    });
  }

  // Initialize storage
  async initialize(): Promise<void> {
    try {
      await this.db.open();
    } catch (error) {
      throw new Error(`Failed to initialize blockchain storage: ${error}`);
    }
  }

  // Close storage
  async close(): Promise<void> {
    await this.db.close();
  }

  // Store a block
  async storeBlock(block: Block): Promise<void> {
    try {
      const blockHash = bytesToHex(calculateBlockHash(block));
      const blockNumber = block.header.number.toString();

      // Store block data as JSON string
      const blockJson = JSON.stringify({
        header: block.header,
        transactions: block.transactions.map(tx => ({
          from: tx.from ? Array.from(tx.from) : null,
          to: tx.to ? Array.from(tx.to) : null,
          value: tx.value?.toString() || '0',
          gasLimit: tx.gasLimit?.toString() || '0',
          gasPrice: tx.gasPrice?.toString() || '0',
          nonce: tx.nonce.toString(),
          data: tx.data ? Array.from(tx.data) : []
        }))
      });
      
      await this.db.put(`block:${blockHash}`, blockJson);
      await this.db.put(`blockByNumber:${blockNumber}`, blockHash);

      // Store block header separately for quick access
      const headerJson = JSON.stringify(block.header);
      await this.db.put(`header:${blockHash}`, headerJson);

      // Store block metadata
      const metadata: BlockMetadata = {
        hash: blockHash,
        number: block.header.number,
        parentHash: bytesToHex(block.header.parentHash),
        timestamp: block.header.timestamp,
        transactionCount: block.transactions.length,
        gasUsed: block.header.gasUsed,
        gasLimit: block.header.gasLimit
      };
      const metadataJson = JSON.stringify(metadata);
      await this.db.put(`metadata:${blockHash}`, metadataJson);

      // Update chain tip
      await this.db.put('chainTip', blockHash);
      await this.db.put('chainTipNumber', blockNumber);

      // Store transactions
      for (let i = 0; i < block.transactions.length; i++) {
        const tx = block.transactions[i];
        if (!tx) continue;
        
        const txHash = bytesToHex(this.calculateTransactionHash(tx));
        const txJson = JSON.stringify({
          from: tx.from ? Array.from(tx.from) : null,
          to: tx.to ? Array.from(tx.to) : null,
          value: tx.value?.toString() || '0',
          gasLimit: tx.gasLimit?.toString() || '0',
          gasPrice: tx.gasPrice?.toString() || '0',
          nonce: tx.nonce.toString(),
          data: tx.data ? Array.from(tx.data) : []
        });
        
        await this.db.put(`transaction:${txHash}`, txJson);
        await this.db.put(`txBlock:${txHash}`, blockHash);
        await this.db.put(`txIndex:${txHash}`, i.toString());
      }

    } catch (error) {
      throw new Error(`Failed to store block: ${error}`);
    }
  }

  // Get a block by hash
  async getBlock(hash: string): Promise<Block | null> {
    try {
      const blockJson = await this.db.get(`block:${hash}`);
      const blockData = JSON.parse(blockJson);
      
      return {
        header: blockData.header,
        transactions: blockData.transactions.map((txData: any) => ({
          from: txData.from ? new Uint8Array(txData.from) : null,
          to: txData.to ? new Uint8Array(txData.to) : null,
          value: txData.value ? BigInt(txData.value) : 0n,
          gasLimit: txData.gasLimit ? BigInt(txData.gasLimit) : 0n,
          gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : 0n,
          nonce: BigInt(txData.nonce),
          data: txData.data ? new Uint8Array(txData.data) : new Uint8Array(0)
        }))
      };
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get block: ${error}`);
    }
  }

  // Get a block by number
  async getBlockByNumber(number: bigint): Promise<Block | null> {
    try {
      const blockHash = await this.db.get(`blockByNumber:${number.toString()}`);
      return this.getBlock(blockHash);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get block by number: ${error}`);
    }
  }

  // Get block header by hash
  async getBlockHeader(hash: string): Promise<BlockHeader | null> {
    try {
      const headerJson = await this.db.get(`header:${hash}`);
      return JSON.parse(headerJson) as BlockHeader;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get block header: ${error}`);
    }
  }

  // Get block metadata
  async getBlockMetadata(hash: string): Promise<BlockMetadata | null> {
    try {
      const metadataJson = await this.db.get(`metadata:${hash}`);
      return JSON.parse(metadataJson) as BlockMetadata;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get block metadata: ${error}`);
    }
  }

  // Get chain tip (latest block)
  async getChainTip(): Promise<Block | null> {
    try {
      const tipHash = await this.db.get('chainTip');
      return this.getBlock(tipHash);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get chain tip: ${error}`);
    }
  }

  // Get chain tip hash
  async getChainTipHash(): Promise<string | null> {
    try {
      return await this.db.get('chainTip');
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get chain tip hash: ${error}`);
    }
  }

  // Get chain tip number
  async getChainTipNumber(): Promise<bigint | null> {
    try {
      const tipNumber = await this.db.get('chainTipNumber');
      return BigInt(tipNumber);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get chain tip number: ${error}`);
    }
  }

  // Get a transaction by hash
  async getTransaction(hash: string): Promise<Transaction | null> {
    try {
      const txJson = await this.db.get(`transaction:${hash}`);
      const txData = JSON.parse(txJson);
      
      return {
        from: txData.from ? new Uint8Array(txData.from) : new Uint8Array(20),
        to: txData.to ? new Uint8Array(txData.to) : new Uint8Array(20),
        value: txData.value ? BigInt(txData.value) : 0n,
        gasLimit: txData.gasLimit ? BigInt(txData.gasLimit) : 0n,
        gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : 0n,
        nonce: BigInt(txData.nonce),
        data: txData.data ? new Uint8Array(txData.data) : new Uint8Array(0)
      };
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get transaction: ${error}`);
    }
  }

  // Get block hash containing a transaction
  async getTransactionBlock(hash: string): Promise<string | null> {
    try {
      return await this.db.get(`txBlock:${hash}`);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get transaction block: ${error}`);
    }
  }

  // Get transaction index in block
  async getTransactionIndex(hash: string): Promise<number | null> {
    try {
      const index = await this.db.get(`txIndex:${hash}`);
      return parseInt(index, 10);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw new Error(`Failed to get transaction index: ${error}`);
    }
  }

  // Check if block exists
  async hasBlock(hash: string): Promise<boolean> {
    try {
      await this.db.get(`block:${hash}`);
      return true;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return false;
      }
      throw new Error(`Failed to check block existence: ${error}`);
    }
  }

  // Check if transaction exists
  async hasTransaction(hash: string): Promise<boolean> {
    try {
      await this.db.get(`transaction:${hash}`);
      return true;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return false;
      }
      throw new Error(`Failed to check transaction existence: ${error}`);
    }
  }

  // Get blocks in range
  async getBlocksInRange(fromNumber: bigint, toNumber: bigint): Promise<Block[]> {
    const blocks: Block[] = [];
    
    for (let number = fromNumber; number <= toNumber; number++) {
      const block = await this.getBlockByNumber(number);
      if (block) {
        blocks.push(block);
      }
    }
    
    return blocks;
  }

  // Get latest N blocks
  async getLatestBlocks(count: number): Promise<Block[]> {
    const tipNumber = await this.getChainTipNumber();
    if (!tipNumber) {
      return [];
    }

    const fromNumber = tipNumber > BigInt(count) ? tipNumber - BigInt(count) + 1n : 0n;
    return this.getBlocksInRange(fromNumber, tipNumber);
  }

  // Delete a block (for reorg)
  async deleteBlock(hash: string): Promise<void> {
    try {
      const block = await this.getBlock(hash);
      if (!block) {
        return;
      }

      const blockNumber = block.header.number.toString();

      // Delete block data
      await this.db.del(`block:${hash}`);
      await this.db.del(`blockByNumber:${blockNumber}`);
      await this.db.del(`header:${hash}`);
      await this.db.del(`metadata:${hash}`);

      // Delete transactions
      for (const tx of block.transactions) {
        if (!tx) continue;
        
        const txHash = bytesToHex(this.calculateTransactionHash(tx));
        await this.db.del(`transaction:${txHash}`);
        await this.db.del(`txBlock:${txHash}`);
        await this.db.del(`txIndex:${txHash}`);
      }

    } catch (error) {
      throw new Error(`Failed to delete block: ${error}`);
    }
  }

  // Get storage statistics
  async getStats(): Promise<{
    totalBlocks: number;
    totalTransactions: number;
    chainTip: string | null;
    chainTipNumber: bigint | null;
  }> {
    let totalBlocks = 0;
    let totalTransactions = 0;

    try {
      // Count blocks by iterating through blockByNumber keys
      for await (const [key, value] of this.db.iterator({ 
        gte: 'blockByNumber:', 
        lte: 'blockByNumber:~' 
      })) {
        totalBlocks++;
        
        // Get block to count transactions
        const blockHash = value;
        const metadata = await this.getBlockMetadata(blockHash);
        if (metadata) {
          totalTransactions += metadata.transactionCount;
        }
      }
    } catch (error) {
      console.warn('Error counting blocks:', error);
    }

    return {
      totalBlocks,
      totalTransactions,
      chainTip: await this.getChainTipHash(),
      chainTipNumber: await this.getChainTipNumber()
    };
  }

  // Clear all data (for testing)
  async clear(): Promise<void> {
    try {
      // Delete all keys
      for await (const [key] of this.db.iterator()) {
        await this.db.del(key);
      }
    } catch (error) {
      throw new Error(`Failed to clear storage: ${error}`);
    }
  }

  // Simple transaction hash calculation
  private calculateTransactionHash(tx: Transaction): Hash {
    const txJson = JSON.stringify({
      from: tx.from ? Array.from(tx.from) : null,
      to: tx.to ? Array.from(tx.to) : null,
      value: tx.value?.toString() || '0',
      gasLimit: tx.gasLimit?.toString() || '0',
      gasPrice: tx.gasPrice?.toString() || '0',
      nonce: tx.nonce.toString(),
      data: tx.data ? Array.from(tx.data) : []
    });
  
    const encoder = new TextEncoder();
    const data = encoder.encode(txJson);
    
    // Simple hash (in production, use keccak256)
    const hash = new Uint8Array(32);
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      if (byte !== undefined) {
        const hashIndex = i % 32;
        hash[hashIndex]! ^= byte;
      }
    }
  
    return hash;
  }
}