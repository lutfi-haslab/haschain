import type { Address, Account, Word, Bytes } from './types.js';
import { addressEquals, storageKeyToString, storageKeyFromString } from './utils.js';

// Snapshot interface for state management
export interface Snapshot {
  accounts: Map<string, Account>;
  storages: Map<string, Map<string, Word>>;
  nextSnapshotId: number;
}

// WorldState interface
export interface IWorldState {
  // Account operations
  getAccount(address: Address): Account | undefined;
  putAccount(account: Account): void;
  accountExists(address: Address): boolean;
  
  // Storage operations
  getStorage(address: Address, key: Word): Word;
  setStorage(address: Address, key: Word, value: Word): void;
  
  // Balance operations
  getBalance(address: Address): bigint;
  addBalance(address: Address, amount: bigint): void;
  subBalance(address: Address, amount: bigint): void;
  
  // Nonce operations
  getNonce(address: Address): bigint;
  incrementNonce(address: Address): void;
  setNonce(address: Address, nonce: bigint): void;
  
  // Code operations
  getCode(address: Address): Bytes;
  setCode(address: Address, code: Bytes): void;
  
  // Snapshot operations
  snapshot(): number;
  revert(snapshotId: number): void;
  commit(snapshotId?: number): void;
}

// In-memory implementation of WorldState
export class InMemoryWorldState implements IWorldState {
  private accounts: Map<string, Account> = new Map();
  private storages: Map<string, Map<string, Word>> = new Map();
  private snapshots: Map<number, Snapshot> = new Map();
  private nextSnapshotId: number = 1;
  private currentSnapshotId: number | null = null;

  // Helper function to convert address to string key
  private addressToKey(address: Address): string {
    return Array.from(address).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Account operations
  getAccount(address: Address): Account | undefined {
    const key = this.addressToKey(address);
    return this.accounts.get(key);
  }

  putAccount(account: Account): void {
    const key = this.addressToKey(account.address);
    
    // Create a copy to avoid external mutations
    const accountCopy: Account = {
      ...account,
      storage: new Map(account.storage)
    };
    
    this.accounts.set(key, accountCopy);
  }

  accountExists(address: Address): boolean {
    const key = this.addressToKey(address);
    return this.accounts.has(key);
  }

  // Storage operations
  getStorage(address: Address, key: Word): Word {
    const addressKey = this.addressToKey(address);
    const storageKey = storageKeyToString(key);
    
    if (!this.storages.has(addressKey)) {
      return 0n;
    }
    
    const storage = this.storages.get(addressKey)!;
    return storage.get(storageKey) || 0n;
  }

  setStorage(address: Address, key: Word, value: Word): void {
    const addressKey = this.addressToKey(address);
    const storageKey = storageKeyToString(key);
    
    if (!this.storages.has(addressKey)) {
      this.storages.set(addressKey, new Map());
    }
    
    const storage = this.storages.get(addressKey)!;
    if (value === 0n) {
      storage.delete(storageKey);
    } else {
      storage.set(storageKey, value);
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
    
    // Deep copy accounts
    const accountsCopy = new Map<string, Account>();
    for (const [key, account] of this.accounts) {
      accountsCopy.set(key, {
        ...account,
        storage: new Map(account.storage)
      });
    }
    
    // Deep copy storages
    const storagesCopy = new Map<string, Map<string, Word>>();
    for (const [key, storage] of this.storages) {
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
    
    this.accounts = new Map(snapshot.accounts);
    this.storages = new Map(snapshot.storages);
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
}