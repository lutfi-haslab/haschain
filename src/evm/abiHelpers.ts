// ABI encoding/decoding helpers
import { keccak_256 } from '@noble/hashes/sha3.js';

// Get function selector from signature (e.g., "transfer(address,uint256)")
export function selector(signature: string): Uint8Array {
  const hash = keccak_256(new TextEncoder().encode(signature));
  return new Uint8Array(hash.slice(0, 4));
}

// Get selector as a number (for bytecode builder)
export function selectorAsNumber(signature: string): number {
  const sel = selector(signature);
  return ((sel[0] ?? 0) << 24) | ((sel[1] ?? 0) << 16) | ((sel[2] ?? 0) << 8) | (sel[3] ?? 0);
}

// Encode a uint256 value (32 bytes, big-endian)
export function encodeUint256(value: bigint | number): Uint8Array {
  const v = BigInt(value);
  const hex = v.toString(16).padStart(64, '0');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Decode a uint256 from bytes
export function decodeUint256(data: Uint8Array): bigint {
  if (data.length < 32) return 0n;
  return BigInt('0x' + Array.from(data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

// Encode an address (20 bytes, left-padded to 32 bytes)
export function encodeAddress(address: Uint8Array | string): Uint8Array {
  const bytes = new Uint8Array(32);
  if (typeof address === 'string') {
    const hex = address.startsWith('0x') ? address.slice(2) : address;
    for (let i = 0; i < 20; i++) {
      bytes[12 + i] = parseInt(hex.substr(i * 2, 2), 16);
    }
  } else {
    bytes.set(address, 12);
  }
  return bytes;
}

// Decode an address from bytes
export function decodeAddress(data: Uint8Array): Uint8Array {
  return data.slice(12, 32);
}

// Encode a boolean
export function encodeBool(value: boolean): Uint8Array {
  return encodeUint256(value ? 1n : 0n);
}

// Decode a boolean
export function decodeBool(data: Uint8Array): boolean {
  return decodeUint256(data) !== 0n;
}

// Encode function call (selector + encoded args)
export function encodeCall(signature: string, ...args: (bigint | number | Uint8Array | boolean)[]): Uint8Array {
  const sel = selector(signature);
  const encodedArgs: Uint8Array[] = args.map(arg => {
    if (typeof arg === 'boolean') return encodeBool(arg);
    if (typeof arg === 'bigint' || typeof arg === 'number') return encodeUint256(arg);
    if (arg instanceof Uint8Array) return encodeAddress(arg);
    throw new Error(`Unsupported argument type: ${typeof arg}`);
  });
  
  const totalLength = 4 + encodedArgs.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  result.set(sel, 0);
  
  let offset = 4;
  for (const encoded of encodedArgs) {
    result.set(encoded, offset);
    offset += encoded.length;
  }
  
  return result;
}
