import type { Block, BlockHeader, BlockchainConfig } from '../blockchain/types.js';
import type { Address, Hash } from '../evm/types.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { serializeBlockHeader, calculateBlockHash, addressEquals } from '../blockchain/utils.js';
import { bytesToHex } from '../evm/utils.js';

// Validator information
export interface ValidatorInfo {
  address: Address;
  isActive: boolean;
  lastBlockNumber: bigint;
  lastBlockTime: bigint;
  missedBlocks: number;
  signature?: Uint8Array;
}

// Consensus state
export interface ConsensusState {
  validators: Map<string, ValidatorInfo>;
  currentValidatorIndex: number;
  lastBlockNumber: bigint;
  lastBlockTime: bigint;
  inactivityThreshold: number;
  blockTime: number;
}

// Proof of Authority consensus engine
export class PoAConsensus {
  private state: ConsensusState;
  private config: BlockchainConfig;

  constructor(config: BlockchainConfig) {
    this.config = config;
    
    // Initialize validators
    const validators = new Map<string, ValidatorInfo>();
    config.validators.forEach((address, index) => {
      validators.set(bytesToHex(address), {
        address,
        isActive: true,
        lastBlockNumber: 0n,
        lastBlockTime: 0n,
        missedBlocks: 0
      });
    });

    this.state = {
      validators,
      currentValidatorIndex: 0,
      lastBlockNumber: 0n,
      lastBlockTime: 0n,
      inactivityThreshold: 10, // Remove validator after 10 missed blocks
      blockTime: config.blockTime
    };
  }

  // Get current consensus state
  getState(): ConsensusState {
    return { ...this.state };
  }

  // Get all validators
  getValidators(): ValidatorInfo[] {
    return Array.from(this.state.validators.values());
  }

  // Get active validators
  getActiveValidators(): ValidatorInfo[] {
    return Array.from(this.state.validators.values()).filter(v => v.isActive);
  }

  // Add a new validator
  addValidator(address: Address): void {
    const addressHex = bytesToHex(address);
    
    if (this.state.validators.has(addressHex)) {
      throw new Error('Validator already exists');
    }

    this.state.validators.set(addressHex, {
      address,
      isActive: true,
      lastBlockNumber: 0n,
      lastBlockTime: 0n,
      missedBlocks: 0
    });
  }

  // Remove a validator
  removeValidator(address: Address): void {
    const addressHex = bytesToHex(address);
    
    if (!this.state.validators.has(addressHex)) {
      throw new Error('Validator not found');
    }

    const validator = this.state.validators.get(addressHex)!;
    validator.isActive = false;
  }

  // Reactivate a validator
  reactivateValidator(address: Address): void {
    const addressHex = bytesToHex(address);
    
    if (!this.state.validators.has(addressHex)) {
      throw new Error('Validator not found');
    }

    const validator = this.state.validators.get(addressHex)!;
    validator.isActive = true;
    validator.missedBlocks = 0;
  }

  // Get the validator for the next block
  getNextValidator(): Address | null {
    const activeValidators = this.getActiveValidators();
    
    if (activeValidators.length === 0) {
      return null;
    }

    // Simple round-robin selection
    let attempts = 0;
    const maxAttempts = activeValidators.length;
    
    while (attempts < maxAttempts) {
      const validatorIndex = (this.state.currentValidatorIndex + attempts) % activeValidators.length;
      const validator = activeValidators[validatorIndex];
      
      // Check if validator is not inactive due to missed blocks
      if (validator && validator.missedBlocks < this.state.inactivityThreshold) {
        this.state.currentValidatorIndex = validatorIndex;
        return validator.address;
      }
      
      attempts++;
    }

    return null; // No active validators available
  }

  // Validate a block header according to PoA rules
  validateBlockHeader(header: BlockHeader, parentHeader?: BlockHeader): { valid: boolean; error?: string } {
    try {
      // Check validator
      if (!this.isValidValidator(header.validator, header.number)) {
        return { valid: false, error: 'Invalid validator for this block number' };
      }

      // Check timestamp
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (header.timestamp > now + 60n) { // Allow 1 minute future
        return { valid: false, error: 'Block timestamp too far in future' };
      }

      if (parentHeader) {
        if (header.timestamp <= parentHeader.timestamp) {
          return { valid: false, error: 'Block timestamp must be greater than parent' };
        }

        // Check minimum block time
        const timeDiff = header.timestamp - parentHeader.timestamp;
        if (timeDiff < this.state.blockTime) {
          return { valid: false, error: 'Block created too quickly' };
        }
      }

      // Validate signature
      if (!this.validateBlockSignature(header)) {
        return { valid: false, error: 'Invalid block signature' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Validation error: ${error}` };
    }
  }

  // Check if validator is authorized for the given block number
  private isValidValidator(validator: Address, blockNumber: bigint): boolean {
    const activeValidators = this.getActiveValidators();
    
    if (activeValidators.length === 0) {
      return false;
    }

    // For genesis block, any validator is valid
    if (blockNumber === 0n) {
      return true;
    }

    // Simple round-robin: validator index = block number % number of validators
    const expectedValidatorIndex = Number(blockNumber % BigInt(activeValidators.length));
    const expectedValidator = activeValidators[expectedValidatorIndex];
    
    return expectedValidator ? addressEquals(validator, expectedValidator.address) : false;
  }

  // Validate block signature
  private validateBlockSignature(header: BlockHeader): boolean {
    // For genesis block, no signature required
    if (header.number === 0n) {
      return true;
    }

    // In a real implementation, you'd verify the cryptographic signature
    // For now, we'll just check that a signature exists
    return header.signature && header.signature.length > 0;
  }

  // Sign a block header (simplified - in production you'd use proper cryptography)
  signBlockHeader(header: BlockHeader, signerAddress: Address): BlockHeader {
    if (header.number === 0n) {
      // Genesis block doesn't need signature
      return header;
    }

    // Create a simple signature (in production, use proper cryptographic signing)
    const headerBytes = serializeBlockHeader(header);
    const hash = keccak_256(headerBytes);
    
    // Create a mock signature (in production, this would be a real cryptographic signature)
    const signature = new Uint8Array(65); // Standard ECDSA signature length
    signature.set(hash, 0); // Use hash as part of signature for simplicity
    
    return {
      ...header,
      signature
    };
  }

  // Update validator state after block is processed
  updateValidatorState(block: Block): void {
    const validatorHex = bytesToHex(block.header.validator);
    const validator = this.state.validators.get(validatorHex);
    
    if (validator) {
      validator.lastBlockNumber = block.header.number;
      validator.lastBlockTime = block.header.timestamp;
      validator.missedBlocks = 0;
    }

    // Update missed blocks for other validators
    this.updateMissedBlocks(block);
    
    // Update consensus state
    this.state.lastBlockNumber = block.header.number;
    this.state.lastBlockTime = block.header.timestamp;
  }

  // Update missed blocks count for validators
  private updateMissedBlocks(block: Block): void {
    const activeValidators = this.getActiveValidators();
    
    // Find which validator should have produced this block
    if (block.header.number > 0n) {
      const expectedValidatorIndex = Number(block.header.number % BigInt(activeValidators.length));
      const expectedValidator = activeValidators[expectedValidatorIndex];
      
      if (expectedValidator) {
        const expectedValidatorHex = bytesToHex(expectedValidator.address);
        const actualValidatorHex = bytesToHex(block.header.validator);
        
        // If a different validator produced the block, increment missed blocks
        if (expectedValidatorHex !== actualValidatorHex) {
          expectedValidator.missedBlocks++;
          
          // Deactivate validator if they missed too many blocks
          if (expectedValidator.missedBlocks >= this.state.inactivityThreshold) {
            expectedValidator.isActive = false;
          }
        }
      }
    }
  }

  // Check if a reorganization is needed
  shouldReorg(newBlock: Block, currentTip: Block): { action: 'extend' | 'reorg' | 'ignore', newChain?: Block[], commonAncestor?: Block } {
    // In PoA, we generally don't want frequent reorgs
    // Only reorg if the new block is significantly better
    
    const newBlockNumber = newBlock.header.number;
    const currentTipNumber = currentTip.header.number;
    
    // Don't reorg to older blocks
    if (newBlockNumber <= currentTipNumber) {
      return { action: 'ignore' };
    }
    
    // Only reorg if the new block is more than one block ahead
    if (newBlockNumber > currentTipNumber + 1n) {
      return { action: 'reorg' };
    }
    
    return { action: 'extend' };
  }

  // Get validator statistics
  getValidatorStats(): Array<{
    address: Address;
    isActive: boolean;
    blocksProduced: number;
    missedBlocks: number;
    lastBlockNumber: bigint;
    lastBlockTime: bigint;
  }> {
    return Array.from(this.state.validators.values()).map(validator => ({
      address: validator.address,
      isActive: validator.isActive,
      blocksProduced: Number(validator.lastBlockNumber),
      missedBlocks: validator.missedBlocks,
      lastBlockNumber: validator.lastBlockNumber,
      lastBlockTime: validator.lastBlockTime
    }));
  }

  // Reset validator state (for testing)
  resetValidatorState(): void {
    for (const validator of this.state.validators.values()) {
      validator.lastBlockNumber = 0n;
      validator.lastBlockTime = 0n;
      validator.missedBlocks = 0;
      validator.isActive = true;
    }
    
    this.state.currentValidatorIndex = 0;
    this.state.lastBlockNumber = 0n;
    this.state.lastBlockTime = 0n;
  }
}