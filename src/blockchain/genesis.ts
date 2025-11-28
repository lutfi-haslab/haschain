import type { GenesisConfig, BlockchainConfig } from './types.js';
import type { Address } from '../evm/types.js';
import { addressFromHex } from '../evm/utils.js';

// Default blockchain configuration
export const DEFAULT_CONFIG: BlockchainConfig = {
  chainId: 1337n, // Local development chain ID
  blockTime: 15, // 15 seconds per block
  gasLimit: 30000000n, // 30 million gas per block
  difficulty: 1n, // Not used in PoA
  validators: [], // Will be set during initialization
  reward: 0n // No block reward for now
};

// Create a default genesis configuration
export function createDefaultGenesisConfig(validators: string[]): GenesisConfig {
  const validatorAddresses = validators.map(addr => addressFromHex(addr));
  
  const alloc = new Map<Address, { balance: bigint; nonce?: bigint; code?: Uint8Array; storage?: Map<string, bigint> }>();
  
  // Allocate initial balances to validators
  validatorAddresses.forEach(address => {
    alloc.set(address, {
      balance: 1000000000000000000n, // 1 ETH each
      nonce: 0n
    });
  });

  return {
    alloc,
    config: {
      ...DEFAULT_CONFIG,
      validators: validatorAddresses
    },
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    extraData: new Uint8Array(0)
  };
}

// Create a test genesis configuration with pre-funded accounts
export function createTestGenesisConfig(): GenesisConfig {
  const alloc = new Map<Address, { balance: bigint; nonce?: bigint; code?: Uint8Array; storage?: Map<string, bigint> }>();
  
  // Test accounts (20 bytes = 40 hex chars)
  const testAccounts = [
    '0x2c5367a7a2558c48f8fc7a7c6c8a7a7a7a7a7a7a',
    '0x5a4a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a',
    '0x7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b',
    '0x8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c',
    '0x9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d'
  ];

  // Fund test accounts
  testAccounts.forEach(address => {
    alloc.set(addressFromHex(address), {
      balance: 10000000000000000000n, // 10 ETH each
      nonce: 0n
    });
  });

  // Add validator accounts
  const validators = [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333'
  ];

  validators.forEach(address => {
    alloc.set(addressFromHex(address), {
      balance: 1000000000000000000n, // 1 ETH each
      nonce: 0n
    });
  });

  return {
    alloc,
    config: {
      ...DEFAULT_CONFIG,
      validators: validators.map(addr => addressFromHex(addr))
    },
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    extraData: new Uint8Array([0x48, 0x61, 0x73, 0x43, 0x68, 0x61, 0x69, 0x6e]) // "HasChain"
  };
}

// Create a development genesis configuration with single validator
export function createDevGenesisConfig(validatorAddress?: string): GenesisConfig {
  const validator = validatorAddress 
    ? addressFromHex(validatorAddress)
    : addressFromHex('0x1111111111111111111111111111111111111111'); // Default dev validator

  const alloc = new Map<Address, { balance: bigint; nonce?: bigint; code?: Uint8Array; storage?: Map<string, bigint> }>();
  
  // Fund the validator
  alloc.set(validator, {
    balance: 100000000000000000000n, // 100 ETH
    nonce: 0n
  });

  // Add some test accounts (20 bytes = 40 hex chars)
  const testAccounts = [
    '0x2c5367a7a2558c48f8fc7a7c6c8a7a7a7a7a7a7a',
    '0x5a4a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a'
  ];

  testAccounts.forEach(address => {
    alloc.set(addressFromHex(address), {
      balance: 50000000000000000000n, // 50 ETH each
      nonce: 0n
    });
  });

  return {
    alloc,
    config: {
      ...DEFAULT_CONFIG,
      blockTime: 5, // 5 seconds for faster development
      validators: [validator]
    },
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    extraData: new Uint8Array([0x44, 0x65, 0x76]) // "Dev"
  };
}

// Genesis block template for custom configurations
export function createCustomGenesisConfig(
  validators: string[],
  preAllocations: { address: string; balance: bigint; nonce?: bigint; code?: Uint8Array; storage?: Map<string, bigint> }[],
  blockTime?: number,
  gasLimit?: bigint,
  extraData?: Uint8Array
): GenesisConfig {
  const validatorAddresses = validators.map(addr => addressFromHex(addr));
  
  const alloc = new Map<Address, { balance: bigint; nonce?: bigint; code?: Uint8Array; storage?: Map<string, bigint> }>();
  
  // Add pre-allocations
  preAllocations.forEach(allocation => {
    alloc.set(addressFromHex(allocation.address), {
      balance: allocation.balance,
      nonce: allocation.nonce || 0n,
      code: allocation.code,
      storage: allocation.storage
    });
  });

  // Ensure validators have accounts
  validatorAddresses.forEach(address => {
    if (!alloc.has(address)) {
      alloc.set(address, {
        balance: 1000000000000000000n, // 1 ETH default
        nonce: 0n
      });
    }
  });

  return {
    alloc,
    config: {
      ...DEFAULT_CONFIG,
      validators: validatorAddresses,
      blockTime: blockTime || DEFAULT_CONFIG.blockTime,
      gasLimit: gasLimit || DEFAULT_CONFIG.gasLimit
    },
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    extraData: extraData || new Uint8Array(0)
  };
}

// Validate genesis configuration
export function validateGenesisConfig(config: GenesisConfig): { valid: boolean; error?: string } {
  // Check validators
  if (config.config.validators.length === 0) {
    return { valid: false, error: 'At least one validator is required' };
  }

  // Check block time
  if (config.config.blockTime <= 0) {
    return { valid: false, error: 'Block time must be positive' };
  }

  // Check gas limit
  if (config.config.gasLimit <= 0) {
    return { valid: false, error: 'Gas limit must be positive' };
  }

  // Check timestamp
  if (config.timestamp && config.timestamp <= 0) {
    return { valid: false, error: 'Timestamp must be positive' };
  }

  // Check allocations
  for (const [address, accountData] of config.alloc) {
    if (accountData.balance < 0) {
      return { valid: false, error: 'Account balance cannot be negative' };
    }

    if (accountData.nonce && accountData.nonce < 0) {
      return { valid: false, error: 'Account nonce cannot be negative' };
    }
  }

  return { valid: true };
}

// Export commonly used genesis configurations
export const GENESIS_PRESETS = {
  TEST: createTestGenesisConfig,
  DEV: createDevGenesisConfig,
  DEFAULT: createDefaultGenesisConfig,
  CUSTOM: createCustomGenesisConfig
} as const;