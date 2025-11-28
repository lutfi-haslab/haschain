/**
 * HasChain REST API Server
 * 
 * Local blockchain development server (like Ganache)
 * Auto-initializes with 5 pre-funded accounts
 */

import { Elysia } from 'elysia';
import { BlockchainManager } from '../blockchain/manager.js';
import { createCustomGenesisConfig } from '../blockchain/genesis.js';
import { addressFromHex, bytesToHex, hexToBytes } from '../evm/utils.js';
import { encodeCall } from '../evm/abiHelpers.js';
import { calculateTransactionHash } from '../blockchain/utils.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import type { Address, Transaction } from '../evm/types.js';

// ============================================
// Pre-seeded Accounts (like Ganache)
// ============================================

const ACCOUNTS = [
  {
    address: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
    privateKey: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    balance: '100000000000000000000000' // 100,000 ETH
  },
  {
    address: '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0',
    privateKey: '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1',
    balance: '100000000000000000000000'
  },
  {
    address: '0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b',
    privateKey: '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c',
    balance: '100000000000000000000000'
  },
  {
    address: '0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d',
    privateKey: '0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913',
    balance: '100000000000000000000000'
  },
  {
    address: '0xd03ea8624C8C5987235048901fB614fDcA89b117',
    privateKey: '0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743',
    balance: '100000000000000000000000'
  }
];

// ============================================
// Helper Functions
// ============================================

function formatAddress(address: Address): string {
  return '0x' + Array.from(address).map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatHash(hash: Uint8Array): string {
  return '0x' + Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseAddress(hex: string): Address {
  return addressFromHex(hex);
}

function signMessage(message: string, privateKeyHex: string): string {
  const privateKey = hexToBytes(privateKeyHex);
  const messageHash = keccak_256(new TextEncoder().encode(message));
  const signature = new Uint8Array(65);
  
  for (let i = 0; i < 32; i++) {
    signature[i] = messageHash[i]! ^ privateKey[i % privateKey.length]!;
  }
  for (let i = 32; i < 64; i++) {
    signature[i] = messageHash[i - 32]! ^ privateKey[(i + 1) % privateKey.length]!;
  }
  signature[64] = 27;
  
  return bytesToHex(signature);
}

function formatEther(wei: string): string {
  const value = BigInt(wei);
  const ether = Number(value / 1000000000000000000n);
  return ether.toLocaleString() + ' ETH';
}

// ============================================
// Blockchain Manager Instance
// ============================================

let manager: BlockchainManager | null = null;
let isInitialized = false;

async function initializeBlockchain(): Promise<void> {
  // Use first account as validator
  const validatorAddress = ACCOUNTS[0]!.address;

  const genesisConfig = createCustomGenesisConfig(
    [validatorAddress],
    ACCOUNTS.map(acc => ({
      address: acc.address,
      balance: BigInt(acc.balance)
    })),
    1, // 1 second block time for fast development
    30000000n
  );

  manager = new BlockchainManager({
    storage: {
      dbPath: './leveldb/haschain',
      createIfMissing: true,
      errorIfExists: false
    },
    blockchain: {
      chainId: 1337n,
      blockTime: 1,
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
      blockTime: 1,
      reward: 0n
    }
  });

  await manager.initialize(genesisConfig);
  isInitialized = true;
}

function getManager(): BlockchainManager {
  if (!manager || !isInitialized) {
    throw new Error('Blockchain not initialized');
  }
  return manager;
}

// ============================================
// API Server
// ============================================

const app = new Elysia()
  .onError(({ error }) => {
    const err = error as Error;
    return {
      success: false,
      error: err.message || 'Unknown error'
    };
  })

  // ========================================
  // Health & Info
  // ========================================
  .get('/', () => ({
    name: 'HasChain',
    version: '1.0.0',
    chainId: 1337,
    status: 'running'
  }))

  .get('/api/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }))

  .get('/api/accounts', () => ({
    accounts: ACCOUNTS.map((acc, index) => ({
      index,
      address: acc.address,
      privateKey: acc.privateKey,
      balance: formatEther(acc.balance)
    }))
  }))

  // ========================================
  // Blockchain Info
  // ========================================
  .get('/api/chain', async () => {
    const mgr = getManager();
    const info = await mgr.getBlockchainInfo();
    const stats = await mgr.getStats();

    return {
      chainId: 1337,
      blockNumber: info.blockNumber.toString(),
      blockHash: info.blockHash,
      validators: info.validators.map(v => formatAddress(v)),
      totalBlocks: stats.totalBlocks,
      totalTransactions: stats.totalTransactions
    };
  })

  .get('/api/validators', async () => {
    const mgr = getManager();
    const validators = mgr.getValidatorInfo();

    return {
      validators: validators.map(v => ({
        address: formatAddress(v.address),
        isActive: v.isActive,
        blocksProduced: v.blocksProduced,
        missedBlocks: v.missedBlocks
      }))
    };
  })

  // ========================================
  // Account Operations
  // ========================================
  .get('/api/balance/:address', ({ params }) => {
    const account = ACCOUNTS.find(
      a => a.address.toLowerCase() === params.address.toLowerCase()
    );
    
    return {
      address: params.address,
      balance: account ? account.balance : '0',
      balanceEth: account ? formatEther(account.balance) : '0 ETH'
    };
  })

  // ========================================
  // Transaction Operations
  // ========================================
  .post('/api/tx/send', async ({ body }) => {
    const mgr = getManager();
    const { from, to, value, gasLimit, gasPrice, nonce, data } = body as {
      from: string;
      to?: string;
      value?: string;
      gasLimit?: string;
      gasPrice?: string;
      nonce?: string;
      data?: string;
    };

    const tx: Transaction = {
      from: parseAddress(from),
      to: to ? parseAddress(to) : null,
      value: BigInt(value || '0'),
      gasLimit: BigInt(gasLimit || '21000'),
      gasPrice: BigInt(gasPrice || '1000000000'),
      nonce: BigInt(nonce || '0'),
      data: data ? hexToBytes(data) : new Uint8Array(0)
    };

    const result = mgr.addTransaction(tx);
    const txHash = formatHash(calculateTransactionHash(tx));

    return {
      success: result.added,
      txHash: result.added ? txHash : null,
      reason: result.reason
    };
  })

  .get('/api/tx/:hash', async ({ params }) => {
    const mgr = getManager();
    const tx = await mgr.getTransaction(params.hash);

    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    return {
      success: true,
      transaction: {
        from: formatAddress(tx.from),
        to: tx.to ? formatAddress(tx.to) : null,
        value: tx.value.toString(),
        gasLimit: tx.gasLimit?.toString(),
        gasPrice: tx.gasPrice?.toString(),
        nonce: tx.nonce.toString(),
        data: tx.data ? bytesToHex(tx.data) : '0x'
      }
    };
  })

  .get('/api/tx/pending', async () => {
    const mgr = getManager();
    const pending = mgr.getPendingTransactions();

    return {
      count: pending.length,
      transactions: pending.map(p => ({
        hash: p.hash,
        from: formatAddress(p.sender),
        gasPrice: p.gasPrice.toString(),
        nonce: p.nonce.toString()
      }))
    };
  })

  // ========================================
  // Block Operations
  // ========================================
  .post('/api/block/create', async () => {
    const mgr = getManager();
    const result = await mgr.createBlock();

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      block: {
        number: result.block?.header.number.toString(),
        timestamp: result.block?.header.timestamp.toString(),
        transactions: result.block?.transactions.length,
        gasUsed: result.block?.header.gasUsed.toString()
      }
    };
  })

  .get('/api/block/latest', async () => {
    const mgr = getManager();
    const blocks = await mgr.getLatestBlocks(1);

    if (blocks.length === 0) {
      return { success: false, error: 'No blocks found' };
    }

    const block = blocks[0]!;
    return {
      success: true,
      block: {
        number: block.header.number.toString(),
        timestamp: block.header.timestamp.toString(),
        validator: formatAddress(block.header.validator),
        gasLimit: block.header.gasLimit.toString(),
        gasUsed: block.header.gasUsed.toString(),
        transactionCount: block.transactions.length,
        parentHash: formatHash(block.header.parentHash),
        stateRoot: formatHash(block.header.stateRoot)
      }
    };
  })

  .get('/api/block/number/:number', async ({ params }) => {
    const mgr = getManager();
    const block = await mgr.getBlockByNumber(BigInt(params.number));

    if (!block) {
      return { success: false, error: 'Block not found' };
    }

    return {
      success: true,
      block: {
        number: block.header.number.toString(),
        timestamp: block.header.timestamp.toString(),
        validator: formatAddress(block.header.validator),
        gasLimit: block.header.gasLimit.toString(),
        gasUsed: block.header.gasUsed.toString(),
        transactionCount: block.transactions.length,
        parentHash: formatHash(block.header.parentHash),
        stateRoot: formatHash(block.header.stateRoot),
        transactions: block.transactions.map(tx => ({
          from: formatAddress(tx.from),
          to: tx.to ? formatAddress(tx.to) : null,
          value: tx.value.toString(),
          type: tx.to === null ? 'deploy' : (tx.data && tx.data.length > 0 ? 'call' : 'transfer')
        }))
      }
    };
  })

  .get('/api/block/hash/:hash', async ({ params }) => {
    const mgr = getManager();
    const block = await mgr.getBlock(params.hash);

    if (!block) {
      return { success: false, error: 'Block not found' };
    }

    return {
      success: true,
      block: {
        number: block.header.number.toString(),
        timestamp: block.header.timestamp.toString(),
        validator: formatAddress(block.header.validator),
        gasLimit: block.header.gasLimit.toString(),
        gasUsed: block.header.gasUsed.toString(),
        transactionCount: block.transactions.length
      }
    };
  })

  .get('/api/blocks', async ({ query }) => {
    const mgr = getManager();
    const count = parseInt(query.count as string) || 10;
    const blocks = await mgr.getLatestBlocks(count);

    return {
      count: blocks.length,
      blocks: blocks.map(block => ({
        number: block.header.number.toString(),
        timestamp: block.header.timestamp.toString(),
        validator: formatAddress(block.header.validator),
        transactionCount: block.transactions.length,
        gasUsed: block.header.gasUsed.toString()
      }))
    };
  })

  // ========================================
  // Contract Operations
  // ========================================
  .post('/api/contract/deploy', async ({ body }) => {
    const mgr = getManager();
    const { from, bytecode, gasLimit, gasPrice, nonce, value } = body as {
      from: string;
      bytecode: string;
      gasLimit?: string;
      gasPrice?: string;
      nonce?: string;
      value?: string;
    };

    const tx: Transaction = {
      from: parseAddress(from),
      to: null,
      value: BigInt(value || '0'),
      gasLimit: BigInt(gasLimit || '500000'),
      gasPrice: BigInt(gasPrice || '1000000000'),
      nonce: BigInt(nonce || '0'),
      data: hexToBytes(bytecode)
    };

    const result = mgr.addTransaction(tx);
    const txHash = formatHash(calculateTransactionHash(tx));

    return {
      success: result.added,
      txHash: result.added ? txHash : null,
      reason: result.reason
    };
  })

  .post('/api/contract/call', async ({ body }) => {
    const mgr = getManager();
    const { from, to, method, args, data, gasLimit, gasPrice, nonce, value } = body as {
      from: string;
      to: string;
      method?: string;
      args?: string[];
      data?: string;
      gasLimit?: string;
      gasPrice?: string;
      nonce?: string;
      value?: string;
    };

    let calldata: Uint8Array;
    if (method) {
      const argsArray = args || [];
      calldata = encodeCall(method, ...argsArray.map(a => BigInt(a)));
    } else {
      calldata = hexToBytes(data || '0x');
    }

    const tx: Transaction = {
      from: parseAddress(from),
      to: parseAddress(to),
      value: BigInt(value || '0'),
      gasLimit: BigInt(gasLimit || '100000'),
      gasPrice: BigInt(gasPrice || '1000000000'),
      nonce: BigInt(nonce || '0'),
      data: calldata
    };

    const result = mgr.addTransaction(tx);
    const txHash = formatHash(calculateTransactionHash(tx));

    return {
      success: result.added,
      txHash: result.added ? txHash : null,
      calldata: bytesToHex(calldata),
      reason: result.reason
    };
  })

  // ========================================
  // Signing Operations
  // ========================================
  .post('/api/sign/message', async ({ body }) => {
    const { message, privateKey } = body as { message: string; privateKey: string };

    if (!message || !privateKey) {
      return { success: false, error: 'Message and privateKey required' };
    }

    const signature = signMessage(message, privateKey);
    const messageHash = bytesToHex(keccak_256(new TextEncoder().encode(message)));

    return {
      success: true,
      message,
      messageHash,
      signature
    };
  })

  .post('/api/sign/transaction', async ({ body }) => {
    const { from, to, value, gasLimit, gasPrice, nonce, data, privateKey } = body as {
      from: string;
      to?: string;
      value?: string;
      gasLimit?: string;
      gasPrice?: string;
      nonce?: string;
      data?: string;
      privateKey: string;
    };

    const tx: Transaction = {
      from: parseAddress(from),
      to: to ? parseAddress(to) : null,
      value: BigInt(value || '0'),
      gasLimit: BigInt(gasLimit || '21000'),
      gasPrice: BigInt(gasPrice || '1000000000'),
      nonce: BigInt(nonce || '0'),
      data: data ? hexToBytes(data) : new Uint8Array(0)
    };

    const txHash = formatHash(calculateTransactionHash(tx));
    const signature = signMessage(txHash, privateKey);

    return {
      success: true,
      txHash,
      signature
    };
  })

  // ========================================
  // Utility Endpoints
  // ========================================
  .post('/api/encode/call', async ({ body }) => {
    const { method, args } = body as { method: string; args?: string[] };

    if (!method) {
      return { success: false, error: 'Method signature required' };
    }

    const argsArray = args || [];
    const calldata = encodeCall(method, ...argsArray.map(a => BigInt(a)));

    return {
      success: true,
      method,
      args: argsArray,
      calldata: bytesToHex(calldata)
    };
  })

  .get('/api/selector/:signature', ({ params }) => {
    const signature = decodeURIComponent(params.signature);
    const hash = keccak_256(new TextEncoder().encode(signature));
    const selector = bytesToHex(new Uint8Array(hash.slice(0, 4)));

    return { signature, selector };
  });

// ============================================
// Start Server
// ============================================

async function startServer() {
  // Initialize blockchain first
  await initializeBlockchain();

  // Start the server
  app.listen(3000);

  // Display startup info
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              HASCHAIN                                         ║
║                     Local Blockchain Development Server                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  RPC Server:     http://localhost:3000                                        ║
║  Chain ID:       1337                                                         ║
║  Gas Price:      1 gwei                                                       ║
║  Gas Limit:      30,000,000                                                   ║
║  Block Time:     1 second                                                     ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                            Available Accounts                                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣`);

  ACCOUNTS.forEach((acc, i) => {
    console.log(`║  (${i}) ${acc.address}  (${formatEther(acc.balance).padEnd(15)})`);
  });

  console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣
║                              Private Keys                                     ║
╠═══════════════════════════════════════════════════════════════════════════════╣`);

  ACCOUNTS.forEach((acc, i) => {
    console.log(`║  (${i}) ${acc.privateKey}`);
  });

  console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣
║                               API Endpoints                                   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  GET  /api/accounts            - List all accounts with keys                  ║
║  GET  /api/chain               - Chain info                                   ║
║  GET  /api/balance/:address    - Get account balance                          ║
║  POST /api/tx/send             - Send transaction                             ║
║  GET  /api/tx/:hash            - Get transaction by hash                      ║
║  POST /api/block/create        - Mine a new block                             ║
║  GET  /api/block/number/:num   - Get block by number                          ║
║  GET  /api/blocks?count=N      - Get latest N blocks                          ║
║  POST /api/contract/deploy     - Deploy contract                              ║
║  POST /api/contract/call       - Call contract method                         ║
║  POST /api/sign/message        - Sign a message                               ║
║  POST /api/sign/transaction    - Sign a transaction                           ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Blockchain initialized and ready for transactions!
`);
}

startServer().catch(console.error);

export { app, ACCOUNTS };
