import { BlockchainManager } from '../blockchain/manager.js';
import { addressFromHex } from '../evm/utils.js';
import { createDevGenesisConfig } from '../blockchain/genesis.js';

// Simple blockchain demonstration
async function runBlockchainDemo(): Promise<void> {
  console.log('🚀 Starting HasChain Blockchain Demo');
  
  try {
    // Create blockchain manager
    const manager = new BlockchainManager({
      storage: {
        dbPath: './demo-chaindb',
        createIfMissing: true,
        errorIfExists: false
      },
      blockchain: {
        chainId: 1337n,
        blockTime: 15, // 15 seconds per block
        gasLimit: 30000000n, // 30 million gas
        difficulty: 1n, // Not used in PoA
        validators: [], // Will be set by genesis config
        reward: 0n // No block reward for demo
      },
      txPool: {
        maxPoolSize: 1000,
        maxAccountTransactions: 10,
        minGasPrice: 1000n, // 1000 wei minimum gas price
        blockGasLimit: 30000000n,
        transactionTimeout: 300 // 5 minutes
      },
      processing: {
        maxTransactions: 100,
        gasLimit: 30000000n,
        blockTime: 15,
        reward: 0n
      }
    });

    // Initialize blockchain with development genesis config
    await manager.initialize(createDevGenesisConfig());

    // Get blockchain info
    const info = await manager.getBlockchainInfo();
    console.log('📊 Blockchain Info:');
    console.log(`  Block Number: ${info.blockNumber}`);
    console.log(`  Block Hash: ${info.blockHash}`);
    console.log(`  Validators: ${info.validators.length}`);
    console.log(`  Pending Transactions: ${info.txPoolStats.pending}`);

    // Create a few test transactions
    const sender1 = addressFromHex('0x1111111111111111111111111111111111111111111111111111111');
    const sender2 = addressFromHex('0x2222222222222222222222222222222222222222222222222222222');
    const receiver = addressFromHex('0x3333333333333333333333333333333333333333333333333333333');

    // Add transactions to pool
    console.log('📝 Adding test transactions...');
    
    const tx1 = {
      from: sender1,
      to: receiver,
      value: 1000000000000000000n, // 1 ETH
      gasLimit: 21000n,
      gasPrice: 1000n,
      nonce: 0n,
      data: new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x72, 0x61, 0x79, 0x6e, 0x73, 0x73, 0x65]) // "Transfer 1 ETH"
    };

    const tx2 = {
      from: sender2,
      to: receiver,
      value: 500000000000000000n, // 0.5 ETH
      gasLimit: 21000n,
      gasPrice: 1000n,
      nonce: 0n,
      data: new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x72, 0x61, 0x79, 0x6e, 0x73, 0x73, 0x65]) // "Transfer 0.5 ETH"
    };

    const result1 = manager.addTransaction(tx1);
    const result2 = manager.addTransaction(tx2);

    console.log(`  Transaction 1 added: ${result1.added ? '✅' : '❌'} ${result1.reason || ''}`);
    console.log(`  Transaction 2 added: ${result2.added ? '✅' : '❌'} ${result2.reason || ''}`);

    // Create some blocks
    console.log('⛏ Creating blocks...');
    
    for (let i = 0; i < 3; i++) {
      const blockResult = await manager.createBlock();
      if (blockResult.success) {
        console.log(`  Block ${i + 1} created: ✅`);
      } else {
        console.log(`  Block creation failed: ❌ ${blockResult.error}`);
        break;
      }
    }

    // Get final blockchain state
    const finalInfo = await manager.getBlockchainInfo();
    console.log('📊 Final Blockchain Info:');
    console.log(`  Total Blocks: ${finalInfo.storageStats.totalBlocks}`);
    console.log(`  Total Transactions: ${finalInfo.storageStats.totalTransactions}`);
    console.log(`  Latest Block: ${finalInfo.blockNumber}`);
    console.log(`  Latest Block Hash: ${finalInfo.blockHash}`);

    // Get some blocks
    const latestBlocks = await manager.getLatestBlocks(3);
    console.log('📚 Latest 3 Blocks:');
    for (let i = 0; i < latestBlocks.length; i++) {
      const block = latestBlocks[i];
      if (block) {
        console.log(`  Block ${block.header.number}: calculated`);
      }
    }

    // Get validator info
    const validatorInfo = manager.getValidatorInfo();
    console.log('👥 Validator Information:');
    validatorInfo.forEach((validator, index) => {
      console.log(`  Validator ${index + 1}:`);
      console.log(`    Address: ${Array.from(validator.address).map((b: unknown) => (b as number).toString(16).padStart(2, '0')).join('')}`);
      console.log(`    Active: ${validator.isActive ? '✅' : '❌'}`);
      console.log(`    Blocks Produced: ${validator.blocksProduced}`);
      console.log(`    Missed Blocks: ${validator.missedBlocks}`);
    });

    // Test adding/removing validators
    console.log('🔧 Testing validator management...');
    
    const newValidator = addressFromHex('0x4444444444444444444444444444444444444444444444444444444444444444444');
    
    try {
      manager.addValidator(newValidator);
      console.log('  ✅ Added validator: 0x4444...');
      
      const updatedValidatorInfo = manager.getValidatorInfo();
      console.log(`  Total validators: ${updatedValidatorInfo.length}`);
      
      manager.removeValidator(newValidator);
      console.log('  ✅ Removed validator: 0x4444...');
      
      const finalValidatorInfo = manager.getValidatorInfo();
      console.log(`  Final validators: ${finalValidatorInfo.length}`);
      
    } catch (error) {
      console.error('  ❌ Validator management error:', error);
    }

    // Close blockchain
    await manager.close();
    console.log('🔚 Blockchain demo completed');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBlockchainDemo().catch(console.error);
}