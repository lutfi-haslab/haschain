import type { Address, Hash, Word, Bytes } from './types.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

// Convert a hex string to Uint8Array
export function hexToBytes(hex: string): Bytes {
  // Remove 0x prefix if present
  hex = hex.startsWith('0x') ? hex.slice(2) : hex;
  
  // Remove whitespace and newlines
  hex = hex.replace(/\s+/g, '');
  
  // Ensure even length
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const hexByte = hex.slice(i, i + 2);
    const parsedByte = parseInt(hexByte, 16);
    if (isNaN(parsedByte)) {
      throw new Error(`Invalid hex string at position ${i}: "${hexByte}"`);
    }
    bytes[i / 2] = parsedByte;
  }
  
  return bytes;
}

// Convert Uint8Array to hex string
export function bytesToHex(bytes: Bytes): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert a bigint to a 32-byte word
export function bigintToWord(value: bigint): Word {
  return value;
}

// Convert a 32-byte word to bigint
export function wordToBigint(word: Word): bigint {
  return word;
}

// Convert a bigint to 32 bytes
export function bigintToBytes(value: bigint, length: number = 32): Bytes {
  const hex = value.toString(16).padStart(length * 2, '0');
  return hexToBytes(hex);
}

// Convert bytes to bigint
export function bytesToBigint(bytes: Bytes): bigint {
  return BigInt('0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(''));
}

// Create an address from a public key or hash
export function addressFromHash(hash: Hash): Address {
  // Take the last 20 bytes of the hash
  return hash.slice(-20);
}

// Create an address from a hex string
export function addressFromHex(hex: string): Address {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 20) {
    throw new Error('Invalid address length: expected 20 bytes');
  }
  return bytes;
}

// Generate a contract address from sender and nonce
export function generateContractAddress(sender: Address, nonce: bigint): Address {
  // Create the RLP encoded data (simplified version)
  const rlpPrefix = new Uint8Array([0xc6]); // RLP prefix for list with 2 items
  const senderLength = new Uint8Array([sender.length]);
  const nonceLength = new Uint8Array([1]);
  
  // For simplicity, we'll just concatenate and hash
  const combined = new Uint8Array([
    ...senderLength,
    ...sender,
    ...nonceLength,
    Number(nonce)
  ]);
  
  const hash = keccak_256(combined);
  return addressFromHash(new Uint8Array(hash));
}

// Compare two addresses for equality
export function addressEquals(a: Address, b: Address): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Create a zero address
export function zeroAddress(): Address {
  return new Uint8Array(20);
}

// Create a zero hash
export function zeroHash(): Hash {
  return new Uint8Array(32);
}

// Convert storage key to string representation
export function storageKeyToString(key: Word): string {
  return key.toString(16).padStart(64, '0');
}

// Parse storage key from string
export function storageKeyFromString(str: string): Word {
  return BigInt('0x' + str);
}

// Pad bytes to a specific length
export function padBytes(bytes: Bytes, length: number): Bytes {
  if (bytes.length >= length) return bytes;
  const result = new Uint8Array(length);
  result.set(bytes, length - bytes.length);
  return result;
}

// Truncate or pad bytes to exactly 32 bytes
export function toWord(bytes: Bytes): Bytes {
  return padBytes(bytes, 32);
}