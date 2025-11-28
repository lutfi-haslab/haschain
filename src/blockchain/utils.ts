import type { BlockHeader, Block, TransactionReceipt, Log } from './types.js';
import type { Hash, Address, Transaction } from '../evm/types.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes, bigintToBytes, bytesToBigint } from '../evm/utils.js';

// RLP (Recursive Length Prefix) encoding utilities
export class RLP {
  // Encode a single item
  static encode(item: Uint8Array | Uint8Array[]): Uint8Array {
    if (item instanceof Uint8Array) {
      return this.encodeBytes(item);
    } else {
      return this.encodeList(item);
    }
  }

  // Encode a byte string
  static encodeBytes(bytes: Uint8Array): Uint8Array {
    if (bytes.length === 1 && bytes[0]! < 0x80) {
      return bytes;
    }
    
    const length = bytes.length;
    if (length < 56) {
      const result = new Uint8Array(1 + length);
      result[0] = 0x80 + length;
      result.set(bytes, 1);
      return result;
    } else {
      const lengthBytes = this.lengthToBytes(length);
      const result = new Uint8Array(1 + lengthBytes.length + length);
      result[0] = 0xb7 + lengthBytes.length;
      result.set(lengthBytes, 1);
      result.set(bytes, 1 + lengthBytes.length);
      return result;
    }
  }

  // Encode a list
  static encodeList(items: Uint8Array[]): Uint8Array {
    const concatenated = this.concatBytes(items);
    const length = concatenated.length;
    
    if (length < 56) {
      const result = new Uint8Array(1 + length);
      result[0] = 0xc0 + length;
      result.set(concatenated, 1);
      return result;
    } else {
      const lengthBytes = this.lengthToBytes(length);
      const result = new Uint8Array(1 + lengthBytes.length + length);
      result[0] = 0xf7 + lengthBytes.length;
      result.set(lengthBytes, 1);
      result.set(concatenated, 1 + lengthBytes.length);
      return result;
    }
  }

  // Convert length to bytes
  private static lengthToBytes(length: number): Uint8Array {
    const bytes: number[] = [];
    while (length > 0) {
      bytes.unshift(length & 0xff);
      length >>= 8;
    }
    return new Uint8Array(bytes);
  }

  // Concatenate multiple byte arrays
  private static concatBytes(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}

// Serialize block header
export function serializeBlockHeader(header: BlockHeader): Uint8Array {
  const fields = [
    header.parentHash,
    bigintToBytes(header.number, 32),
    bigintToBytes(header.timestamp, 32),
    header.stateRoot,
    header.transactionsRoot,
    header.receiptsRoot,
    header.validator,
    header.signature,
    bigintToBytes(header.gasLimit, 32),
    bigintToBytes(header.gasUsed, 32),
    header.extraData
  ];

  return RLP.encode(fields);
}

// Deserialize block header
export function deserializeBlockHeader(data: Uint8Array): BlockHeader {
  // This is a simplified implementation
  // In a production blockchain, you'd want a full RLP decoder
  const fields = decodeRLPList(data);
  
  return {
    parentHash: fields[0] as Hash,
    number: bytesToBigint(fields[1] as Uint8Array),
    timestamp: bytesToBigint(fields[2] as Uint8Array),
    stateRoot: fields[3] as Hash,
    transactionsRoot: fields[4] as Hash,
    receiptsRoot: fields[5] as Hash,
    validator: fields[6] as Address,
    signature: fields[7] as Uint8Array,
    gasLimit: bytesToBigint(fields[8] as Uint8Array),
    gasUsed: bytesToBigint(fields[9] as Uint8Array),
    extraData: fields[10] as Uint8Array
  };
}

// Serialize block
export function serializeBlock(block: Block): Uint8Array {
  const headerBytes = serializeBlockHeader(block.header);
  const transactionBytes = block.transactions.map(tx => serializeTransaction(tx));
  const list = [headerBytes, ...transactionBytes];
  return RLP.encode(list);
}

// Serialize transaction (simplified)
export function serializeTransaction(tx: Transaction): Uint8Array {
  const fields = [
    tx.from || new Uint8Array(20),
    tx.to || new Uint8Array(20),
    bigintToBytes(tx.value, 32),
    bigintToBytes(tx.gasLimit || 0n, 32),
    bigintToBytes(tx.gasPrice || 0n, 32),
    bigintToBytes(tx.nonce, 32),
    tx.data || new Uint8Array(0)
  ];

  return RLP.encode(fields);
}

// Calculate block hash
export function calculateBlockHash(block: Block): Hash {
  const headerBytes = serializeBlockHeader(block.header);
  return new Uint8Array(keccak_256(headerBytes));
}

// Calculate transaction hash
export function calculateTransactionHash(tx: Transaction): Hash {
  const txBytes = serializeTransaction(tx);
  return new Uint8Array(keccak_256(txBytes));
}

// Calculate receipts root (simplified Merkle tree)
export function calculateReceiptsRoot(receipts: TransactionReceipt[]): Hash {
  if (receipts.length === 0) {
    return new Uint8Array(32); // Empty hash
  }

  // For simplicity, just hash all receipts together
  // In a real implementation, you'd build a proper Merkle tree
  const concatenated = receipts.reduce((acc, receipt) => {
    const receiptBytes = serializeReceipt(receipt);
    return new Uint8Array([...acc, ...receiptBytes]);
  }, new Uint8Array(0));

  return new Uint8Array(keccak_256(concatenated));
}

// Calculate transactions root (simplified Merkle tree)
export function calculateTransactionsRoot(transactions: Transaction[]): Hash {
  if (transactions.length === 0) {
    return new Uint8Array(32); // Empty hash
  }

  // For simplicity, just hash all transactions together
  // In a real implementation, you'd build a proper Merkle tree
  const concatenated = transactions.reduce((acc, tx) => {
    const txBytes = serializeTransaction(tx);
    return new Uint8Array([...acc, ...txBytes]);
  }, new Uint8Array(0));

  return new Uint8Array(keccak_256(concatenated));
}

// Serialize transaction receipt
export function serializeReceipt(receipt: TransactionReceipt): Uint8Array {
  const fields = [
    receipt.transactionHash,
    bigintToBytes(receipt.blockNumber, 32),
    receipt.blockHash,
    bigintToBytes(BigInt(receipt.transactionIndex), 4),
    bigintToBytes(receipt.gasUsed, 32),
    bigintToBytes(receipt.cumulativeGasUsed, 32),
    receipt.contractAddress || new Uint8Array(20),
    serializeLogs(receipt.logs),
    bigintToBytes(BigInt(receipt.status), 1)
  ];

  return RLP.encode(fields);
}

// Serialize logs
export function serializeLogs(logs: Log[]): Uint8Array {
  const logBytes = logs.map(log => {
    const fields = [
      log.address,
      ...log.topics,
      log.data
    ];
    return RLP.encode(fields);
  });

  return RLP.encode(logBytes);
}

// Simple RLP decoder (very basic implementation)
function decodeRLPList(data: Uint8Array): Uint8Array[] {
  // This is a very simplified RLP decoder
  // In production, you'd want a full RLP decoder
  if (data[0]! >= 0xc0) {
    // List
    const length = data[0]! - 0xc0;
    const listData = data.slice(1, 1 + length);
    
    // For simplicity, assume each field is 32 bytes except the last one
    const fields: Uint8Array[] = [];
    let offset = 0;
    
    // Extract known fields (this is a simplified approach)
    const fieldSizes = [32, 32, 32, 32, 32, 32, 20, 65, 32, 32]; // Expected field sizes
    
    for (let i = 0; i < fieldSizes.length - 1; i++) {
      fields.push(listData.slice(offset, offset + fieldSizes[i]!));
      offset += fieldSizes[i]!;
    }
    
    // Last field (extraData) takes the rest
    fields.push(listData.slice(offset));
    
    return fields;
  }
  
  throw new Error('Expected RLP list');
}

// Create genesis block hash
export function createGenesisHash(): Hash {
  return new Uint8Array(32).fill(0);
}

// Validate address format
export function isValidAddress(address: Address): boolean {
  return address.length === 20;
}

// Validate hash format
export function isValidHash(hash: Hash): boolean {
  return hash.length === 32;
}

// Compare hashes
export function hashEquals(a: Hash, b: Hash): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Compare addresses
export function addressEquals(a: Address, b: Address): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}