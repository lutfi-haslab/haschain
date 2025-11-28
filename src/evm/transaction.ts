import type { Address, Transaction, ExecutionResult, Env } from './types.js';
import type { IWorldState } from './worldState.js';
import { evm } from './core.js';
import { generateContractAddress, bytesToBigint, bigintToBytes } from './utils.js';
import { hexToBytes } from './utils.js';

// Transaction executor
export class TransactionExecutor {
  // Execute a transaction
  public executeTransaction(
    tx: Transaction,
    world: IWorldState,
    block: {
      number: bigint;
      timestamp: bigint;
      coinbase: Address;
      gasLimit: bigint;
    },
    chainId: bigint = 1n
  ): ExecutionResult {
    // Create a snapshot before execution
    const snapshotId = world.snapshot();
    
    try {
      // Validate transaction
      this.validateTransaction(tx, world);
      
      // Deduct gas cost from sender
      const gasCost = tx.gasLimit * tx.gasPrice;
      world.subBalance(tx.from, gasCost);
      
      // Transfer value if not a contract creation
      if (tx.to !== null && tx.value > 0n) {
        world.subBalance(tx.from, tx.value);
        world.addBalance(tx.to, tx.value);
      }
      
      // Increment sender nonce
      world.incrementNonce(tx.from);
      
      // Create execution environment
      const env: Env = {
        address: tx.to || new Uint8Array(20), // Contract address or zero address for CREATE
        caller: tx.from,
        origin: tx.from,
        value: tx.value,
        gasPrice: tx.gasPrice,
        block,
        chainId
      };
      
      let result: ExecutionResult;
      
      if (tx.to === null) {
        // Contract creation
        result = this.executeCreate(tx, world, env);
      } else {
        // Contract call
        result = this.executeCall(tx, world, env);
      }
      
      // Refund unused gas
      const gasUsed = result.gasUsed;
      const gasRefund = (tx.gasLimit - gasUsed) * tx.gasPrice;
      world.addBalance(tx.from, gasRefund);
      
      // Commit the state changes if successful
      if (result.success) {
        world.commit(snapshotId);
      } else {
        world.revert(snapshotId);
      }
      
      return result;
    } catch (error) {
      // Revert state on error
      world.revert(snapshotId);
      
      return {
        success: false,
        gasUsed: tx.gasLimit, // Use all gas on error
        returnData: new Uint8Array(0)
      };
    }
  }
  
  // Validate transaction
  private validateTransaction(tx: Transaction, world: IWorldState): void {
    // Check sender account exists
    const sender = world.getAccount(tx.from);
    if (!sender) {
      throw new Error('Sender account does not exist');
    }
    
    // Check nonce
    if (tx.nonce !== sender.nonce) {
      throw new Error('Invalid nonce');
    }
    
    // Check balance
    const cost = tx.value + tx.gasLimit * tx.gasPrice;
    if (sender.balance < cost) {
      throw new Error('Insufficient balance');
    }
    
    // Check gas limit
    if (tx.gasLimit <= 0) {
      throw new Error('Gas limit must be positive');
    }
  }
  
  // Execute contract creation
  private executeCreate(
    tx: Transaction,
    world: IWorldState,
    env: Env
  ): ExecutionResult {
    // Generate contract address
    const sender = world.getAccount(tx.from)!;
    const contractAddress = generateContractAddress(tx.from, sender.nonce - 1n);
    
    // Check if contract already exists
    if (world.accountExists(contractAddress)) {
      throw new Error('Contract address already exists');
    }
    
    // Create new account with empty storage
    world.putAccount({
      address: contractAddress,
      nonce: 1n, // New contracts start with nonce 1
      balance: 0n,
      code: new Uint8Array(0),
      storage: new Map()
    });
    
    // Transfer value to contract
    if (tx.value > 0n) {
      world.addBalance(contractAddress, tx.value);
    }
    
    // Update environment for contract creation
    env.address = contractAddress;
    
    // Execute init code
    const result = evm.execute(tx.data, world, env, tx.gasLimit);
    
    if (result.success) {
      // Set contract code to the returned data
      world.setCode(contractAddress, result.returnData);
    } else {
      // If creation fails, remove the contract
      world.subBalance(contractAddress, world.getBalance(contractAddress));
      // Note: In a real implementation, the account would be deleted or marked as non-existent
    }
    
    return result;
  }
  
  // Execute contract call
  private executeCall(
    tx: Transaction,
    world: IWorldState,
    env: Env,
    debug: boolean = false
  ): ExecutionResult {
    // Get contract code
    const code = world.getCode(tx.to!);
    
    // If no code, just return success
    if (code.length === 0) {
      return {
        success: true,
        gasUsed: 0n,
        returnData: new Uint8Array(0)
      };
    }
    
    // Execute contract code
    return evm.execute(code, world, env, tx.gasLimit, tx.data);
  }
  
  // Create a simple transaction
  public createTransaction(
    from: Address,
    to: Address | null,
    value: bigint | string | number = 0n,
    data: string | Uint8Array = new Uint8Array(0),
    gasLimit: bigint | string | number = 1000000n,
    gasPrice: bigint | string | number = 1n,
    nonce?: bigint
  ): Transaction {
    // Convert values to bigint
    const valueBig = typeof value === 'bigint' ? value : BigInt(value);
    const gasLimitBig = typeof gasLimit === 'bigint' ? gasLimit : BigInt(gasLimit);
    const gasPriceBig = typeof gasPrice === 'bigint' ? gasPrice : BigInt(gasPrice);
    
    // Convert data to bytes
    const dataBytes = typeof data === 'string' ? hexToBytes(data) : data;
    
    return {
      from,
      to,
      value: valueBig,
      gasLimit: gasLimitBig,
      gasPrice: gasPriceBig,
      nonce: nonce || 0n,
      data: dataBytes
    };
  }
}

// Create a default transaction executor
export const txExecutor = new TransactionExecutor();