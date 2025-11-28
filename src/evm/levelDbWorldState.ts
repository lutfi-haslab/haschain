import type { Address, Account, Word, Bytes } from './types.js';
import { addressEquals, storageKeyToString, storageKeyFromString } from './utils.js';
import type { IWorldState } from './worldState.js';
import { Level } from 'level';

// LevelDB-based implementation of WorldState
// Note: This implementation uses synchronous methods to match IWorldState interface
// In production, you might want to make the interface async for better performance
export class LevelDBWorldState implements IWorldState {
  private db: Level<string, Uint8Array>;
  private snapshots: Map<number, Snapshot> = new Map();
  private nextSnapshotId: number = 1;
  private currentSnapshotId: number | null = null;
  private cache: Map<string, Account> = new Map();
  private storageCache: Map<string, Map<string, Word>> = new Map();
  private initialized: boolean = false;

  constructor(dbPath: string = './leveldb/chaindb') {
    this.db = new Level(dbPath, { 
      valueEncoding: 'binary',
      keyEncoding: 'utf8'
    });
    this.initialized = true;
  }

  // Helper function to convert address to string key
  private addressToKey(address: Address): string {
    return `account:${Array.from(address).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  // Helper function to convert storage key to string key
  private storageToKey(address: Address, key: Word): string {
    const addressKey = Array.from(address).map(b => b.toString(16).padStart(2, '0')).join('');
    const storageKey = key.toString(16).padStart(64, '0');
    return `storage:${addressKey}:${storageKey}`;
  }

  // Helper function to serialize account
  private serializeAccount(account: Account): Uint8Array {
    // Simple serialization: address + nonce + balance + codeLength + code + storageCount + storageEntries
    const storageEntries: Uint8Array[] = [];
    let storageSize = 0;
    
    for (const [storageKey, storageValue] of account.storage) {
      const keyBytes = new TextEncoder().encode(storageKey);
      const valueBytes = new Uint8Array(32);
      
      // Convert bigint to 32 bytes
      let value = storageValue;
      for (let i = 31; i >= 0; i--) {
        valueBytes[i] = Number(value & 0xffn);
        value >>= 8n;
      }
      
      const entry = new Uint8Array(1 + keyBytes.length + 32);
      entry[0] = keyBytes.length;
      entry.set(keyBytes, 1);
      entry.set(valueBytes, 1 + keyBytes.length);
      
      storageEntries.push(entry);
      storageSize += entry.length;
    }

    const totalLength = 20 + 8 + 32 + 1 + account.code.length + 4 + storageSize;
    const result = new Uint8Array(totalLength);
    let offset = 0;

    // Address (20 bytes)
    result.set(account.address, offset);
    offset += 20;
    
    // Nonce (8 bytes)
    let nonce = account.nonce;
    for (let i = 7; i >= 0; i--) {
      result[offset + i] = Number(nonce & 0xffn);
      nonce >>= 8n;
    }
    offset += 8;
    
    // Balance (32 bytes)
    let balance = account.balance;
    for (let i = 31; i >= 0; i--) {
      result[offset + i] = Number(balance & 0xffn);
      balance >>= 8n;
    }
    offset += 32;
    
    // Code length (1 byte)
    result[offset] = account.code.length;
    offset += 1;
    
    // Code
    result.set(account.code, offset);
    offset += account.code.length;
    
    // Storage count (4 bytes)
    const storageCount = account.storage.size;
    for (let i = 3; i >= 0; i--) {
      result[offset + i] = (storageCount >> (i * 8)) & 0xff;
    }
    offset += 4;
    
    // Storage entries
    for (const entry of storageEntries) {
      result.set(entry, offset);
      offset += entry.length;
    }

    return result;
  }

  // Helper function to deserialize account
  private deserializeAccount(data: Uint8Array): Account {
    let offset = 0;
    
    // Address (20 bytes)
    const address = data.slice(offset, offset + 20);
    offset += 20;
    
    // Nonce (8 bytes)
    let nonce = 0n;
    for (let i = 0; i < 8; i++) {
      nonce = (nonce << 8n) + BigInt(data[offset + i]!);
    }
    offset += 8;
    
    // Balance (32 bytes)
    let balance = 0n;
    for (let i = 0; i < 32; i++) {
      balance = (balance << 8n) + BigInt(data[offset + i]!);
    }
    offset += 32;
    
    // Code length (1 byte)
    const codeLength = data[offset]!;
    offset += 1;
    
    // Code
    const code = data.slice(offset, offset + codeLength);
    offset += codeLength;
    
    // Storage count (4 bytes)
    let storageCount = 0;
    for (let i = 0; i < 4; i++) {
      storageCount = (storageCount << 8) + data[offset + i]!;
    }
    offset += 4;
    
    // Storage
    const storage = new Map<string, Word>();
    for (let i = 0; i < storageCount; i++) {
      const keyLength = data[offset]!;
      offset += 1;
      const key = new TextDecoder().decode(data.slice(offset, offset + keyLength));
      offset += keyLength;
      
      let value = 0n;
      for (let j = 0; j < 32; j++) {
        value = (value << 8n) + BigInt(data[offset + j]!);
      }
      offset += 32;
      
      storage.set(key, value);
    }
    
    return { address, nonce, balance, code, storage };
  }

  // Synchronous wrapper for async operations
  // Note: In production, consider making the interface async
  private async getAccountAsync(address: Address): Promise<Account | undefined> {
    const key = this.addressToKey(address);
    
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    try {
      const data = await this.db.get(key);
      const account = this.deserializeAccount(data);
      this.cache.set(key, account);
      return account;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return undefined;
      }
      throw error;
    }
  }

  private async putAccountAsync(account: Account): Promise<void> {
    const key = this.addressToKey(account.address);
    const data = this.serializeAccount(account);
    
    await this.db.put(key, data);
    this.cache.set(key, account);
  }

  // Account operations (synchronous interface)
  getAccount(address: Address): Account | undefined {
    // For now, return from cache only
    // In a real implementation, you'd need to handle async operations
    const key = this.addressToKey(address);
    return this.cache.get(key);
  }

  putAccount(account: Account): void {
    const key = this.addressToKey(account.address);
    this.cache.set(key, account);
    // In a real implementation, you'd write to DB here
    // this.putAccountAsync(account);
  }

  accountExists(address: Address): boolean {
    const account = this.getAccount(address);
    return account !== undefined;
  }

  // Storage operations
  getStorage(address: Address, key: Word): Word {
    const addressKey = Array.from(address).map(b => b.toString(16).padStart(2, '0')).join('');
    const storageKey = storageKeyToString(key);
    
    // Check cache first
    if (this.storageCache.has(addressKey) && this.storageCache.get(addressKey)!.has(storageKey)) {
      return this.storageCache.get(addressKey)!.get(storageKey) || 0n;
    }
    
    return 0n; // Default to 0 for now
  }

  setStorage(address: Address, key: Word, value: Word): void {
    const addressKey = Array.from(address).map(b => b.toString(16).padStart(2, '0')).join('');
    const storageKey = storageKeyToString(key);
    
    // Update cache
    if (!this.storageCache.has(addressKey)) {
      this.storageCache.set(addressKey, new Map());
    }
    
    if (value === 0n) {
      this.storageCache.get(addressKey)!.delete(storageKey);
    } else {
      this.storageCache.get(addressKey)!.set(storageKey, value);
    }
  }

  // Balance operations
  getBalance(address: Address): bigint {
    const account = this.getAccount(address);
    return account ? account.balance : 0n;
  }

  addBalance(address: Address, amount: bigint): void {
    if (amount === 0n) return;
    
    let account = this.getAccount(address);
    if (!account) {
      account = {
        address,
        nonce: 0n,
        balance: 0n,
        code: new Uint8Array(0),
        storage: new Map()
      };
    }
    
    account.balance += amount;
    this.putAccount(account);
  }

  subBalance(address: Address, amount: bigint): void {
    if (amount === 0n) return;
    
    const account = this.getAccount(address);
    if (!account || account.balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    account.balance -= amount;
    this.putAccount(account);
  }

  // Nonce operations
  getNonce(address: Address): bigint {
    const account = this.getAccount(address);
    return account ? account.nonce : 0n;
  }

  incrementNonce(address: Address): void {
    let account = this.getAccount(address);
    if (!account) {
      account = {
        address,
        nonce: 0n,
        balance: 0n,
        code: new Uint8Array(0),
        storage: new Map()
      };
    }
    
    account.nonce++;
    this.putAccount(account);
  }

  setNonce(address: Address, nonce: bigint): void {
    let account = this.getAccount(address);
    if (!account) {
      account = {
        address,
        nonce: 0n,
        balance: 0n,
        code: new Uint8Array(0),
        storage: new Map()
      };
    }
    
    account.nonce = nonce;
    this.putAccount(account);
  }

  // Code operations
  getCode(address: Address): Bytes {
    const account = this.getAccount(address);
    return account ? account.code : new Uint8Array(0);
  }

  setCode(address: Address, code: Bytes): void {
    let account = this.getAccount(address);
    if (!account) {
      account = {
        address,
        nonce: 0n,
        balance: 0n,
        code: new Uint8Array(0),
        storage: new Map()
      };
    }
    
    account.code = code;
    this.putAccount(account);
  }

  // Snapshot operations
  snapshot(): number {
    const snapshotId = this.nextSnapshotId++;
    
    // Deep copy accounts cache
    const accountsCopy = new Map<string, Account>();
    for (const [key, account] of this.cache) {
      accountsCopy.set(key, {
        ...account,
        storage: new Map(account.storage)
      });
    }
    
    // Deep copy storage cache
    const storagesCopy = new Map<string, Map<string, Word>>();
    for (const [key, storage] of this.storageCache) {
      storagesCopy.set(key, new Map(storage));
    }
    
    this.snapshots.set(snapshotId, {
      accounts: accountsCopy,
      storages: storagesCopy,
      nextSnapshotId: this.nextSnapshotId
    });
    
    this.currentSnapshotId = snapshotId;
    return snapshotId;
  }

  revert(snapshotId: number): void {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    
    this.cache = new Map(snapshot.accounts);
    this.storageCache = new Map(snapshot.storages);
    this.nextSnapshotId = snapshot.nextSnapshotId;
    
    // Remove any snapshots that were created after this one
    for (const [id, snap] of this.snapshots) {
      if (id > snapshotId) {
        this.snapshots.delete(id);
      }
    }
    
    this.currentSnapshotId = snapshotId;
  }

  commit(snapshotId?: number): void {
    if (snapshotId !== undefined) {
      // Remove the specified snapshot and any snapshots created after it
      for (const [id, snap] of this.snapshots) {
        if (id >= snapshotId) {
          this.snapshots.delete(id);
        }
      }
    } else if (this.currentSnapshotId !== null) {
      // Remove the current snapshot
      this.snapshots.delete(this.currentSnapshotId);
      this.currentSnapshotId = null;
    }
  }

  // Close the database
  async close(): Promise<void> {
    await this.db.close();
  }

  // Flush cache to database (for persistence)
  async flush(): Promise<void> {
    for (const [key, account] of this.cache) {
      await this.db.put(key, this.serializeAccount(account));
    }
    
    for (const [addressKey, storage] of this.storageCache) {
      for (const [storageKey, value] of storage) {
        if (value !== 0n) {
          const address = new Uint8Array(20);
          for (let i = 0; i < 20; i++) {
            address[i] = parseInt(addressKey.slice(i * 2, i * 2 + 2), 16);
          }
          const key = BigInt('0x' + storageKey);
          const dbKey = this.storageToKey(address, key);
          const valueBytes = new Uint8Array(32);
          let v = value;
          for (let i = 31; i >= 0; i--) {
            valueBytes[i] = Number(v & 0xffn);
            v >>= 8n;
          }
          await this.db.put(dbKey, valueBytes);
        }
      }
    }
  }
}

// Import Snapshot interface from worldState
interface Snapshot {
  accounts: Map<string, Account>;
  storages: Map<string, Map<string, Word>>;
  nextSnapshotId: number;
}