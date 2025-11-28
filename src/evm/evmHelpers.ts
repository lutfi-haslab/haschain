import type { Address, Bytes, ExecutionResult } from './types.js';
import type { IWorldState } from './worldState.js';
import { InMemoryWorldState } from './worldState.js';
import { txExecutor } from './transaction.js';
import { hexToBytes, bytesToHex, addressEquals, generateContractAddress } from './utils.js';
import { zeroAddress } from './utils.js';

// High-level EVM helper class
export class EvmHelper {
  private world: IWorldState;
  private block: {
    number: bigint;
    timestamp: bigint;
    coinbase: Address;
    gasLimit: bigint;
  };
  private chainId: bigint;
  
  constructor(
    world: IWorldState = new InMemoryWorldState(),
    block?: {
      number?: bigint;
      timestamp?: bigint;
      coinbase?: Address;
      gasLimit?: bigint;
    },
    chainId: bigint = 1n
  ) {
    this.world = world;
    this.block = {
      number: block?.number ?? 1n,
      timestamp: block?.timestamp ?? BigInt(Date.now()) * 1000n, // Convert to milliseconds
      coinbase: block?.coinbase ?? zeroAddress(),
      gasLimit: block?.gasLimit ?? 30000000n
    };
    this.chainId = chainId;
  }
  
  // Get the world state
  public getWorldState(): IWorldState {
    return this.world;
  }
  
  // Fund accounts with ether
  public fundAccounts(accounts: { address: Address; balance: bigint }[]): void {
    for (const { address, balance } of accounts) {
      this.world.addBalance(address, balance);
    }
  }
  
  // Deploy a contract
  public deployContract(
    from: Address,
    initCode: string | Bytes,
    value: bigint = 0n,
    gasLimit: bigint = 5000000n
  ): { contractAddress: Address; result: ExecutionResult } {
    const tx = txExecutor.createTransaction(
      from,
      null, // null for contract creation
      value,
      typeof initCode === 'string' ? hexToBytes(initCode) : initCode,
      gasLimit
    );
    
    // Get the sender's current nonce
    const sender = this.world.getAccount(from);
    if (!sender) {
      throw new Error('Sender account does not exist');
    }
    
    // Set the correct nonce
    tx.nonce = sender.nonce;
    
    // Calculate the contract address BEFORE execution (using current nonce)
    // The transaction executor will use nonce-1 after incrementing
    const contractAddress = generateContractAddress(from, sender.nonce);
    
    // Execute the transaction
    const result = txExecutor.executeTransaction(tx, this.world, this.block, this.chainId);
    
    return {
      contractAddress,
      result
    };
  }
  
  // Send a transaction to a contract
  public sendTransaction(
    from: Address,
    to: Address,
    data: string | Bytes = new Uint8Array(0),
    value: bigint = 0n,
    gasLimit: bigint = 1000000n
  ): ExecutionResult {
    const tx = txExecutor.createTransaction(
      from,
      to,
      value,
      typeof data === 'string' ? hexToBytes(data) : data,
      gasLimit
    );
    
    // Get the sender's current nonce
    const sender = this.world.getAccount(from);
    if (!sender) {
      throw new Error('Sender account does not exist');
    }
    
    // Set the correct nonce
    tx.nonce = sender.nonce;
    
    // Execute the transaction
    return txExecutor.executeTransaction(tx, this.world, this.block, this.chainId);
  }
  
  // Call a contract function without modifying state (eth_call equivalent)
  public call(
    from: Address,
    to: Address,
    data: string | Bytes = new Uint8Array(0),
    value: bigint = 0n,
    gasLimit: bigint = 1000000n
  ): ExecutionResult {
    const tx = txExecutor.createTransaction(
      from,
      to,
      value,
      typeof data === 'string' ? hexToBytes(data) : data,
      gasLimit
    );
    
    // Get the sender's current nonce
    const sender = this.world.getAccount(from);
    if (!sender) {
      throw new Error('Sender account does not exist');
    }
    
    // Set the correct nonce
    tx.nonce = sender.nonce;
    
    // Create a snapshot before execution
    const snapshotId = this.world.snapshot();
    
    try {
      // Execute the transaction
      const result = txExecutor.executeTransaction(tx, this.world, this.block, this.chainId);
      
      // Revert the state changes (view calls should not modify state)
      this.world.revert(snapshotId);
      
      return result;
    } catch (error) {
      // Revert the state changes on error
      this.world.revert(snapshotId);
      
      throw error;
    }
  }
  
  // Read storage directly
  public readStorage(contractAddress: Address, key: bigint): bigint {
    return this.world.getStorage(contractAddress, key);
  }
  
  // Write storage directly (for testing)
  public writeStorage(contractAddress: Address, key: bigint, value: bigint): void {
    this.world.setStorage(contractAddress, key, value);
  }
  
  // Get account balance
  public getBalance(address: Address): bigint {
    return this.world.getBalance(address);
  }
  
  // Get account nonce
  public getNonce(address: Address): bigint {
    return this.world.getNonce(address);
  }
  
  // Get contract code
  public getCode(address: Address): Bytes {
    return this.world.getCode(address);
  }
  
  // Create a new account
  public createAccount(address: Address, balance: bigint = 0n): void {
    this.world.putAccount({
      address,
      nonce: 0n,
      balance,
      code: new Uint8Array(0),
      storage: new Map()
    });
  }
  
  // Check if an account exists
  public accountExists(address: Address): boolean {
    return this.world.accountExists(address);
  }
  
  // Update block information
  public updateBlock(block: {
    number?: bigint;
    timestamp?: bigint;
    coinbase?: Address;
    gasLimit?: bigint;
  }): void {
    if (block.number !== undefined) this.block.number = block.number;
    if (block.timestamp !== undefined) this.block.timestamp = block.timestamp;
    if (block.coinbase !== undefined) this.block.coinbase = block.coinbase;
    if (block.gasLimit !== undefined) this.block.gasLimit = block.gasLimit;
  }
  
  // Get current block information
  public getBlock() {
    return { ...this.block };
  }
}

// Helper functions for common operations

// Create a simple address from a hex string
export function addressFromHex(hex: string): Address {
  const bytes = hexToBytes(hex);
  
  // Pad or truncate to 20 bytes
  const address = new Uint8Array(20);
  const start = Math.max(0, bytes.length - 20);
  const copyLength = Math.min(20, bytes.length);
  
  for (let i = 0; i < copyLength; i++) {
    address[19 - i] = bytes[bytes.length - 1 - i] ?? 0;
  }
  
  return address;
}

// Convert address to hex string
export function addressToHex(address: Address): string {
  return bytesToHex(address);
}

// Create a random address (for testing)
export function createRandomAddress(): Address {
  const address = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    address[i] = Math.floor(Math.random() * 256);
  }
  return address;
}

// Create a default EVM helper instance
export const evmHelper = new EvmHelper();