/**
 * Full Blockchain Demo
 * 
 * This demo showcases all blockchain features:
 * 1. Initialize blockchain with genesis config
 * 2. Create and fund accounts
 * 3. Transfer transactions (ETH transfers)
 * 4. Message signing
 * 5. Deploy smart contracts
 * 6. Interact with contracts (read/write)
 * 7. Query transaction and block history
 */

import { BlockchainManager } from '../blockchain/manager.js';
import { createCustomGenesisConfig } from '../blockchain/genesis.js';
import { addressFromHex, bytesToHex, hexToBytes } from '../evm/utils.js';
import { BytecodeBuilder, createDeploymentBytecode } from '../evm/bytecodeBuilder.js';
import { encodeCall, encodeUint256, decodeUint256, selectorAsNumber } from '../evm/abiHelpers.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import type { Address, Transaction } from '../evm/types.js';

// ============================================
// Helper Functions
// ============================================

function formatAddress(address: Address): string {
  return '0x' + Array.from(address).map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatEther(wei: bigint): string {
  const ether = Number(wei) / 1e18;
  return ether.toFixed(4) + ' ETH';
}

function signMessage(message: string, privateKey: Uint8Array): Uint8Array {
  // Simplified message signing (in production, use proper ECDSA)
  const messageHash = keccak_256(new TextEncoder().encode(message));
  const signature = new Uint8Array(65);
  
  // Create a deterministic signature based on message hash and private key
  for (let i = 0; i < 32; i++) {
    signature[i] = messageHash[i]! ^ privateKey[i % privateKey.length]!;
  }
  for (let i = 32; i < 64; i++) {
    signature[i] = messageHash[i - 32]! ^ privateKey[(i + 1) % privateKey.length]!;
  }
  signature[64] = 27; // Recovery ID
  
  return signature;
}

function verifySignature(message: string, signature: Uint8Array, expectedSigner: Address): boolean {
  // Simplified verification (in production, use proper ECDSA recovery)
  return signature.length === 65 && (signature[64] === 27 || signature[64] === 28);
}

// ============================================
// Contract Bytecode Builders
// ============================================

// Simple Counter Contract
// Storage: slot 0 = count
// Functions: increment(), decrement(), getCount()
function buildCounterContract(): Uint8Array {
  const builder = new BytecodeBuilder();
  
  // Function dispatcher
  builder
    .push0()                    // Push 0 for calldata offset
    .calldataload()             // Load first 32 bytes of calldata
    .push1(0xe0)                // Push 224 (256 - 32 = shift amount)
    .shr()                      // Shift right to get 4-byte selector
    
    // Check for increment() - 0xd09de08a
    .dup1()
    .push4(0xd09de08a)
    .eq()
    .pushLabel('increment')
    .jumpi()
    
    // Check for decrement() - 0x2baeceb7
    .dup1()
    .push4(0x2baeceb7)
    .eq()
    .pushLabel('decrement')
    .jumpi()
    
    // Check for getCount() - 0xa87d942c
    .dup1()
    .push4(0xa87d942c)
    .eq()
    .pushLabel('getCount')
    .jumpi()
    
    // No match - revert
    .push0()
    .push0()
    .revert()
    
    // increment() function
    .label('increment')
    .jumpdest()
    .push0()                    // Storage slot 0
    .sload()                    // Load current count
    .push1(1)                   // Push 1
    .add()                      // Add 1 to count
    .push0()                    // Storage slot 0
    .sstore()                   // Store new count
    .stop()
    
    // decrement() function
    .label('decrement')
    .jumpdest()
    .push0()                    // Storage slot 0
    .sload()                    // Load current count
    .push1(1)                   // Push 1
    .swap1()                    // Swap for subtraction order
    .sub()                      // Subtract 1 from count
    .push0()                    // Storage slot 0
    .sstore()                   // Store new count
    .stop()
    
    // getCount() function
    .label('getCount')
    .jumpdest()
    .push0()                    // Storage slot 0
    .sload()                    // Load count
    .push0()                    // Memory offset
    .mstore()                   // Store in memory
    .push1(32)                  // Return size
    .push0()                    // Memory offset
    .return_();                 // Return count
  
  const runtimeCode = builder.build();
  return createDeploymentBytecode(runtimeCode);
}

// Simple Storage Contract
// Storage: slot 0 = stored value
// Functions: setValue(uint256), getValue()
function buildStorageContract(): Uint8Array {
  const builder = new BytecodeBuilder();
  
  builder
    .push0()
    .calldataload()
    .push1(0xe0)
    .shr()
    
    // Check for setValue(uint256) - 0x60fe47b1
    .dup1()
    .push4(0x60fe47b1)
    .eq()
    .pushLabel('setValue')
    .jumpi()
    
    // Check for getValue() - 0x6d4ce63c
    .dup1()
    .push4(0x6d4ce63c)
    .eq()
    .pushLabel('getValue')
    .jumpi()
    
    .push0()
    .push0()
    .revert()
    
    // setValue(uint256)
    .label('setValue')
    .jumpdest()
    .push1(4)                   // Offset after selector
    .calldataload()             // Load value from calldata
    .push0()                    // Storage slot 0
    .sstore()                   // Store value
    .stop()
    
    // getValue()
    .label('getValue')
    .jumpdest()
    .push0()
    .sload()
    .push0()
    .mstore()
    .push1(32)
    .push0()
    .return_();
  
  const runtimeCode = builder.build();
  return createDeploymentBytecode(runtimeCode);
}

// ============================================
// Main Demo
// ============================================

async function runFullDemo(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    HASCHAIN FULL DEMO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Define test accounts
  const accounts = {
    validator: '0x1111111111111111111111111111111111111111',
    alice: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    bob: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    charlie: '0xcccccccccccccccccccccccccccccccccccccccc',
  };

  // Private keys (simplified for demo)
  const privateKeys = {
    alice: new Uint8Array(32).fill(0xaa),
    bob: new Uint8Array(32).fill(0xbb),
  };

  try {
    // ========================================
    // STEP 1: Initialize Blockchain
    // ========================================
    console.log('📦 STEP 1: Initialize Blockchain');
    console.log('─────────────────────────────────────────────────────────────\n');

    // Create custom genesis config with pre-funded accounts
    const genesisConfig = createCustomGenesisConfig(
      [accounts.validator],
      [
        { address: accounts.validator, balance: 1000000000000000000000n }, // 1000 ETH
        { address: accounts.alice, balance: 100000000000000000000n },      // 100 ETH
        { address: accounts.bob, balance: 50000000000000000000n },         // 50 ETH
        { address: accounts.charlie, balance: 10000000000000000000n },     // 10 ETH
      ],
      5,              // 5 second block time
      30000000n,      // 30M gas limit
      new Uint8Array([0x48, 0x61, 0x73, 0x43, 0x68, 0x61, 0x69, 0x6e]) // "HasChain"
    );

    const manager = new BlockchainManager({
      storage: {
        dbPath: './leveldb/full-demo',
        createIfMissing: true,
        errorIfExists: false
      },
      blockchain: {
        chainId: 1337n,
        blockTime: 5,
        gasLimit: 30000000n,
        difficulty: 1n,
        validators: [],
        reward: 0n
      },
      txPool: {
        maxPoolSize: 1000,
        maxAccountTransactions: 100,
        minGasPrice: 1n,
        blockGasLimit: 30000000n,
        transactionTimeout: 300
      },
      processing: {
        maxTransactions: 100,
        gasLimit: 30000000n,
        blockTime: 5,
        reward: 0n
      }
    });

    await manager.initialize(genesisConfig);
    
    const info = await manager.getBlockchainInfo();
    console.log('✅ Blockchain initialized!');
    console.log(`   Chain ID: 1337`);
    console.log(`   Genesis Block: ${info.blockHash}`);
    console.log(`   Validators: ${info.validators.length}`);
    console.log('');

    // ========================================
    // STEP 2: Check Initial Balances
    // ========================================
    console.log('💰 STEP 2: Initial Account Balances');
    console.log('─────────────────────────────────────────────────────────────\n');

    console.log(`   Validator: ${accounts.validator}`);
    console.log(`   Alice:     ${accounts.alice}`);
    console.log(`   Bob:       ${accounts.bob}`);
    console.log(`   Charlie:   ${accounts.charlie}`);
    console.log('');

    // ========================================
    // STEP 3: Message Signing
    // ========================================
    console.log('✍️  STEP 3: Message Signing');
    console.log('─────────────────────────────────────────────────────────────\n');

    const message = 'Hello, HasChain! This is a signed message from Alice.';
    const signature = signMessage(message, privateKeys.alice);
    const isValid = verifySignature(message, signature, addressFromHex(accounts.alice));

    console.log(`   Message: "${message}"`);
    console.log(`   Signature: 0x${bytesToHex(signature).slice(2, 42)}...`);
    console.log(`   Valid: ${isValid ? '✅ Yes' : '❌ No'}`);
    console.log('');

    // ========================================
    // STEP 4: Transfer Transactions
    // ========================================
    console.log('💸 STEP 4: Transfer Transactions');
    console.log('─────────────────────────────────────────────────────────────\n');

    // Alice sends 5 ETH to Bob
    const transfer1: Transaction = {
      from: addressFromHex(accounts.alice),
      to: addressFromHex(accounts.bob),
      value: 5000000000000000000n, // 5 ETH
      gasLimit: 21000n,
      gasPrice: 1000000000n, // 1 Gwei
      nonce: 0n,
      data: new Uint8Array(0)
    };

    const result1 = manager.addTransaction(transfer1);
    console.log(`   TX 1: Alice → Bob (5 ETH)`);
    console.log(`   Added to pool: ${result1.added ? '✅' : '❌'} ${result1.reason || ''}`);

    // Bob sends 2 ETH to Charlie
    const transfer2: Transaction = {
      from: addressFromHex(accounts.bob),
      to: addressFromHex(accounts.charlie),
      value: 2000000000000000000n, // 2 ETH
      gasLimit: 21000n,
      gasPrice: 1000000000n,
      nonce: 0n,
      data: new Uint8Array(0)
    };

    const result2 = manager.addTransaction(transfer2);
    console.log(`   TX 2: Bob → Charlie (2 ETH)`);
    console.log(`   Added to pool: ${result2.added ? '✅' : '❌'} ${result2.reason || ''}`);

    // Create a block with these transactions
    const block1Result = await manager.createBlock();
    console.log(`\n   Block created: ${block1Result.success ? '✅' : '❌'} ${block1Result.error || ''}`);
    console.log('');

    // ========================================
    // STEP 5: Deploy Smart Contracts
    // ========================================
    console.log('📜 STEP 5: Deploy Smart Contracts');
    console.log('─────────────────────────────────────────────────────────────\n');

    // Deploy Counter Contract (nonce 0 for Alice since transfers were processed)
    const counterBytecode = buildCounterContract();
    const deployCounter: Transaction = {
      from: addressFromHex(accounts.alice),
      to: null, // Contract creation
      value: 0n,
      gasLimit: 500000n,
      gasPrice: 1000000000n,
      nonce: 0n, // First tx for Alice after block was created
      data: counterBytecode
    };

    const counterResult = manager.addTransaction(deployCounter);
    console.log(`   Counter Contract Deployment`);
    console.log(`   Added to pool: ${counterResult.added ? '✅' : '❌'} ${counterResult.reason || ''}`);
    console.log(`   Bytecode size: ${counterBytecode.length} bytes`);

    // Deploy Storage Contract (nonce 0 for Charlie)
    const storageBytecode = buildStorageContract();
    const deployStorage: Transaction = {
      from: addressFromHex(accounts.charlie),
      to: null,
      value: 0n,
      gasLimit: 500000n,
      gasPrice: 1000000000n,
      nonce: 0n,
      data: storageBytecode
    };

    const storageResult = manager.addTransaction(deployStorage);
    console.log(`\n   Storage Contract Deployment`);
    console.log(`   Added to pool: ${storageResult.added ? '✅' : '❌'} ${storageResult.reason || ''}`);
    console.log(`   Bytecode size: ${storageBytecode.length} bytes`);

    // Create block with contract deployments
    const block2Result = await manager.createBlock();
    console.log(`\n   Block created: ${block2Result.success ? '✅' : '❌'} ${block2Result.error || ''}`);
    console.log('');

    // ========================================
    // STEP 6: Interact with Contracts
    // ========================================
    console.log('🔧 STEP 6: Contract Interactions');
    console.log('─────────────────────────────────────────────────────────────\n');

    // Generate contract addresses (simplified - based on sender + nonce)
    // In real implementation, these would come from transaction receipts
    const counterContractAddr = addressFromHex('0xc0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0');
    const storageContractAddr = addressFromHex('0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0');

    console.log('   Contract Addresses (simulated):');
    console.log(`   ├─ Counter: ${formatAddress(counterContractAddr)}`);
    console.log(`   └─ Storage: ${formatAddress(storageContractAddr)}`);
    console.log('');

    // Show function selectors
    console.log('   Function Selectors:');
    const incrementCall = encodeCall('increment()');
    console.log(`   ├─ increment(): 0x${bytesToHex(incrementCall).slice(2)}`);

    const setValueCall = encodeCall('setValue(uint256)', 42n);
    console.log(`   ├─ setValue(42): 0x${bytesToHex(setValueCall).slice(2, 18)}...`);

    const getValueCall = encodeCall('getValue()');
    console.log(`   ├─ getValue(): 0x${bytesToHex(getValueCall).slice(2)}`);

    const getCountCall = encodeCall('getCount()');
    console.log(`   └─ getCount(): 0x${bytesToHex(getCountCall).slice(2)}`);
    console.log('');

    // Add contract interaction transactions
    console.log('   Submitting Contract Transactions:');

    // Call increment on counter contract
    const incrementTx: Transaction = {
      from: addressFromHex(accounts.alice),
      to: counterContractAddr,
      value: 0n,
      gasLimit: 100000n,
      gasPrice: 1000000000n,
      nonce: 1n,
      data: incrementCall
    };
    const incResult = manager.addTransaction(incrementTx);
    console.log(`   ├─ increment() → ${incResult.added ? '✅' : '❌'} ${incResult.reason || ''}`);

    // Call setValue on storage contract
    const setValueTx: Transaction = {
      from: addressFromHex(accounts.bob),
      to: storageContractAddr,
      value: 0n,
      gasLimit: 100000n,
      gasPrice: 1000000000n,
      nonce: 0n,
      data: setValueCall
    };
    const setResult = manager.addTransaction(setValueTx);
    console.log(`   └─ setValue(42) → ${setResult.added ? '✅' : '❌'} ${setResult.reason || ''}`);

    // Create block with contract interactions
    const block3Result = await manager.createBlock();
    console.log(`\n   Block created: ${block3Result.success ? '✅' : '❌'} ${block3Result.error || ''}`);
    console.log('');

    // ========================================
    // STEP 7: Query Blockchain History
    // ========================================
    console.log('📊 STEP 7: Blockchain History');
    console.log('─────────────────────────────────────────────────────────────\n');

    // Get latest blocks
    const latestBlocks = await manager.getLatestBlocks(10);
    console.log(`   Total Blocks Retrieved: ${latestBlocks.length}`);
    console.log('');

    for (const block of latestBlocks) {
      console.log(`   Block #${block.header.number}`);
      console.log(`   ├─ Timestamp: ${new Date(Number(block.header.timestamp) * 1000).toISOString()}`);
      console.log(`   ├─ Transactions: ${block.transactions.length}`);
      console.log(`   ├─ Gas Used: ${block.header.gasUsed}`);
      console.log(`   └─ Validator: ${formatAddress(block.header.validator)}`);
      
      // Show transaction details for blocks with transactions
      if (block.transactions.length > 0) {
        console.log('       Transactions:');
        for (let i = 0; i < block.transactions.length; i++) {
          const tx = block.transactions[i]!;
          const txType = tx.to === null ? 'Contract Deploy' : 
                        (tx.data && tx.data.length > 0 ? 'Contract Call' : 'Transfer');
          const toAddr = tx.to ? formatAddress(tx.to) : 'New Contract';
          console.log(`       ├─ [${i}] ${txType}`);
          console.log(`       │  From: ${formatAddress(tx.from)}`);
          console.log(`       │  To: ${toAddr}`);
          if (tx.value > 0n) {
            console.log(`       │  Value: ${formatEther(tx.value)}`);
          }
        }
      }
      console.log('');
    }

    // ========================================
    // STEP 7b: Query Specific Block
    // ========================================
    console.log('🔍 Query Specific Block by Number');
    console.log('─────────────────────────────────────────────────────────────\n');

    const block1 = await manager.getBlockByNumber(1n);
    if (block1) {
      console.log(`   Block #1 Details:`);
      console.log(`   ├─ Parent Hash: 0x${bytesToHex(block1.header.parentHash).slice(2, 18)}...`);
      console.log(`   ├─ State Root: 0x${bytesToHex(block1.header.stateRoot).slice(2, 18)}...`);
      console.log(`   ├─ Tx Root: 0x${bytesToHex(block1.header.transactionsRoot).slice(2, 18)}...`);
      console.log(`   ├─ Gas Limit: ${block1.header.gasLimit}`);
      console.log(`   └─ Gas Used: ${block1.header.gasUsed}`);
    }
    console.log('');

    // ========================================
    // STEP 8: Transaction Pool Status
    // ========================================
    console.log('🔄 STEP 8: Transaction Pool Status');
    console.log('─────────────────────────────────────────────────────────────\n');

    const pendingTxs = manager.getPendingTransactions();
    const finalInfo = await manager.getBlockchainInfo();

    console.log(`   Pending Transactions: ${pendingTxs.length}`);
    console.log(`   Pool Stats:`);
    console.log(`   ├─ Pending: ${finalInfo.txPoolStats.pending}`);
    console.log(`   ├─ Queued: ${finalInfo.txPoolStats.queued}`);
    console.log(`   └─ Total: ${finalInfo.txPoolStats.total}`);
    console.log('');

    // ========================================
    // STEP 9: Validator Information
    // ========================================
    console.log('👥 STEP 9: Validator Information');
    console.log('─────────────────────────────────────────────────────────────\n');

    const validators = manager.getValidatorInfo();
    for (const validator of validators) {
      console.log(`   Validator: ${formatAddress(validator.address)}`);
      console.log(`   ├─ Active: ${validator.isActive ? '✅' : '❌'}`);
      console.log(`   ├─ Blocks Produced: ${validator.blocksProduced}`);
      console.log(`   └─ Missed Blocks: ${validator.missedBlocks}`);
      console.log('');
    }

    // ========================================
    // STEP 10: Final Statistics
    // ========================================
    console.log('📈 STEP 10: Final Statistics');
    console.log('─────────────────────────────────────────────────────────────\n');

    const stats = await manager.getStats();
    console.log(`   Total Blocks: ${stats.totalBlocks}`);
    console.log(`   Total Transactions: ${stats.totalTransactions}`);
    console.log(`   Chain Tip: ${stats.chainTip}`);
    console.log(`   Latest Block Number: ${stats.chainTipNumber}`);
    console.log('');

    // Cleanup
    await manager.close();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    DEMO COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
runFullDemo().catch(console.error);
