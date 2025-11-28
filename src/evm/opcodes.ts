import type { Word, GasCosts } from './types.js';
import type { ExecutionContext } from './executionContext.js';
import { bytesToBigint, bigintToBytes } from './utils.js';

// Opcode handler function type
export type OpcodeHandler = (ctx: ExecutionContext) => void;

// Opcode definitions
export const OPCODES = {
  // Stack operations
  STOP: 0x00,
  ADD: 0x01,
  MUL: 0x02,
  SUB: 0x03,
  DIV: 0x04,
  SDIV: 0x05,
  MOD: 0x06,
  SMOD: 0x07,
  ADDMOD: 0x08,
  MULMOD: 0x09,
  EXP: 0x0a,
  SIGNEXTEND: 0x0b,
  
  // Comparison & bitwise logic
  LT: 0x10,
  GT: 0x11,
  SLT: 0x12,
  SGT: 0x13,
  EQ: 0x14,
  ISZERO: 0x15,
  AND: 0x16,
  OR: 0x17,
  XOR: 0x18,
  NOT: 0x19,
  BYTE: 0x1a,
  SHL: 0x1b,
  SHR: 0x1c,
  SAR: 0x1d,
  
  // SHA3
  KECCAK256: 0x20,
  
  // Environmental information
  ADDRESS: 0x30,
  BALANCE: 0x31,
  ORIGIN: 0x32,
  CALLER: 0x33,
  CALLVALUE: 0x34,
  CALLDATALOAD: 0x35,
  CALLDATASIZE: 0x36,
  CALLDATACOPY: 0x37,
  CODESIZE: 0x38,
  CODECOPY: 0x39,
  GASPRICE: 0x3a,
  EXTCODESIZE: 0x3b,
  EXTCODECOPY: 0x3c,
  RETURNDATASIZE: 0x3d,
  RETURNDATACOPY: 0x3e,
  
  // Block information
  BLOCKHASH: 0x40,
  COINBASE: 0x41,
  TIMESTAMP: 0x42,
  NUMBER: 0x43,
  DIFFICULTY: 0x44,
  GASLIMIT: 0x45,
  
  // Stack, Memory, Storage and Flow Operations
  POP: 0x50,
  MLOAD: 0x51,
  MSTORE: 0x52,
  MSTORE8: 0x53,
  SLOAD: 0x54,
  SSTORE: 0x55,
  JUMP: 0x56,
  JUMPI: 0x57,
  PC: 0x58,
  MSIZE: 0x59,
  GAS: 0x5a,
  JUMPDEST: 0x5b,
  
  // Push operations
  PUSH0: 0x5f,
  PUSH1: 0x60,
  PUSH2: 0x61,
  PUSH3: 0x62,
  PUSH4: 0x63,
  PUSH5: 0x64,
  PUSH6: 0x65,
  PUSH7: 0x66,
  PUSH8: 0x67,
  PUSH9: 0x68,
  PUSH10: 0x69,
  PUSH11: 0x6a,
  PUSH12: 0x6b,
  PUSH13: 0x6c,
  PUSH14: 0x6d,
  PUSH15: 0x6e,
  PUSH16: 0x6f,
  PUSH17: 0x70,
  PUSH18: 0x71,
  PUSH19: 0x72,
  PUSH20: 0x73,
  PUSH21: 0x74,
  PUSH22: 0x75,
  PUSH23: 0x76,
  PUSH24: 0x77,
  PUSH25: 0x78,
  PUSH26: 0x79,
  PUSH27: 0x7a,
  PUSH28: 0x7b,
  PUSH29: 0x7c,
  PUSH30: 0x7d,
  PUSH31: 0x7e,
  PUSH32: 0x7f,
  
  // Duplication operations
  DUP1: 0x80,
  DUP2: 0x81,
  DUP3: 0x82,
  DUP4: 0x83,
  DUP5: 0x84,
  DUP6: 0x85,
  DUP7: 0x86,
  DUP8: 0x87,
  DUP9: 0x88,
  DUP10: 0x89,
  DUP11: 0x8a,
  DUP12: 0x8b,
  DUP13: 0x8c,
  DUP14: 0x8d,
  DUP15: 0x8e,
  DUP16: 0x8f,
  
  // Swap operations
  SWAP1: 0x90,
  SWAP2: 0x91,
  SWAP3: 0x92,
  SWAP4: 0x93,
  SWAP5: 0x94,
  SWAP6: 0x95,
  SWAP7: 0x96,
  SWAP8: 0x97,
  SWAP9: 0x98,
  SWAP10: 0x99,
  SWAP11: 0x9a,
  SWAP12: 0x9b,
  SWAP13: 0x9c,
  SWAP14: 0x9d,
  SWAP15: 0x9e,
  SWAP16: 0x9f,
  
  // Logging operations
  LOG0: 0xa0,
  LOG1: 0xa1,
  LOG2: 0xa2,
  LOG3: 0xa3,
  LOG4: 0xa4,
  
  // System operations
  CREATE: 0xf0,
  CALL: 0xf1,
  CALLCODE: 0xf2,
  RETURN: 0xf3,
  DELEGATECALL: 0xf4,
  CREATE2: 0xf5,
  STATICCALL: 0xfa,
  REVERT: 0xfd,
  SELFDESTRUCT: 0xff,
} as const;

// Simplified gas costs (not accurate to real EVM)
export const GAS_COSTS: GasCosts = {
  // Stack operations
  [OPCODES.STOP]: 0n,
  [OPCODES.ADD]: 3n,
  [OPCODES.MUL]: 5n,
  [OPCODES.SUB]: 3n,
  [OPCODES.DIV]: 5n,
  [OPCODES.SDIV]: 5n,
  [OPCODES.MOD]: 5n,
  [OPCODES.SMOD]: 5n,
  [OPCODES.ADDMOD]: 8n,
  [OPCODES.MULMOD]: 8n,
  [OPCODES.EXP]: 10n,
  [OPCODES.SIGNEXTEND]: 5n,
  
  // Comparison & bitwise logic
  [OPCODES.LT]: 3n,
  [OPCODES.GT]: 3n,
  [OPCODES.SLT]: 3n,
  [OPCODES.SGT]: 3n,
  [OPCODES.EQ]: 3n,
  [OPCODES.ISZERO]: 3n,
  [OPCODES.AND]: 3n,
  [OPCODES.OR]: 3n,
  [OPCODES.XOR]: 3n,
  [OPCODES.NOT]: 3n,
  [OPCODES.BYTE]: 3n,
  [OPCODES.SHL]: 3n,
  [OPCODES.SHR]: 3n,
  [OPCODES.SAR]: 3n,
  
  // SHA3
  [OPCODES.KECCAK256]: 30n,
  
  // Environmental information
  [OPCODES.ADDRESS]: 2n,
  [OPCODES.BALANCE]: 20n,
  [OPCODES.ORIGIN]: 2n,
  [OPCODES.CALLER]: 2n,
  [OPCODES.CALLVALUE]: 2n,
  [OPCODES.CALLDATALOAD]: 3n,
  [OPCODES.CALLDATASIZE]: 2n,
  [OPCODES.CALLDATACOPY]: 3n,
  [OPCODES.CODESIZE]: 2n,
  [OPCODES.CODECOPY]: 3n,
  [OPCODES.GASPRICE]: 2n,
  [OPCODES.EXTCODESIZE]: 20n,
  [OPCODES.EXTCODECOPY]: 20n,
  [OPCODES.RETURNDATASIZE]: 2n,
  [OPCODES.RETURNDATACOPY]: 3n,
  
  // Block information
  [OPCODES.BLOCKHASH]: 20n,
  [OPCODES.COINBASE]: 2n,
  [OPCODES.TIMESTAMP]: 2n,
  [OPCODES.NUMBER]: 2n,
  [OPCODES.DIFFICULTY]: 2n,
  [OPCODES.GASLIMIT]: 2n,
  
  // Stack, Memory, Storage and Flow Operations
  [OPCODES.POP]: 2n,
  [OPCODES.MLOAD]: 3n,
  [OPCODES.MSTORE]: 3n,
  [OPCODES.MSTORE8]: 3n,
  [OPCODES.SLOAD]: 50n,
  [OPCODES.SSTORE]: 0n, // Dynamic cost
  [OPCODES.JUMP]: 8n,
  [OPCODES.JUMPI]: 10n,
  [OPCODES.PC]: 2n,
  [OPCODES.MSIZE]: 2n,
  [OPCODES.GAS]: 2n,
  [OPCODES.JUMPDEST]: 1n,
  
  // Push operations
  [OPCODES.PUSH0]: 2n,
  [OPCODES.PUSH1]: 3n,
  [OPCODES.PUSH2]: 3n,
  [OPCODES.PUSH3]: 3n,
  [OPCODES.PUSH4]: 3n,
  [OPCODES.PUSH5]: 3n,
  [OPCODES.PUSH6]: 3n,
  [OPCODES.PUSH7]: 3n,
  [OPCODES.PUSH8]: 3n,
  [OPCODES.PUSH9]: 3n,
  [OPCODES.PUSH10]: 3n,
  [OPCODES.PUSH11]: 3n,
  [OPCODES.PUSH12]: 3n,
  [OPCODES.PUSH13]: 3n,
  [OPCODES.PUSH14]: 3n,
  [OPCODES.PUSH15]: 3n,
  [OPCODES.PUSH16]: 3n,
  [OPCODES.PUSH17]: 3n,
  [OPCODES.PUSH18]: 3n,
  [OPCODES.PUSH19]: 3n,
  [OPCODES.PUSH20]: 3n,
  [OPCODES.PUSH21]: 3n,
  [OPCODES.PUSH22]: 3n,
  [OPCODES.PUSH23]: 3n,
  [OPCODES.PUSH24]: 3n,
  [OPCODES.PUSH25]: 3n,
  [OPCODES.PUSH26]: 3n,
  [OPCODES.PUSH27]: 3n,
  [OPCODES.PUSH28]: 3n,
  [OPCODES.PUSH29]: 3n,
  [OPCODES.PUSH30]: 3n,
  [OPCODES.PUSH31]: 3n,
  [OPCODES.PUSH32]: 3n,
  
  // Duplication operations
  [OPCODES.DUP1]: 3n,
  [OPCODES.DUP2]: 3n,
  [OPCODES.DUP3]: 3n,
  [OPCODES.DUP4]: 3n,
  [OPCODES.DUP5]: 3n,
  [OPCODES.DUP6]: 3n,
  [OPCODES.DUP7]: 3n,
  [OPCODES.DUP8]: 3n,
  [OPCODES.DUP9]: 3n,
  [OPCODES.DUP10]: 3n,
  [OPCODES.DUP11]: 3n,
  [OPCODES.DUP12]: 3n,
  [OPCODES.DUP13]: 3n,
  [OPCODES.DUP14]: 3n,
  [OPCODES.DUP15]: 3n,
  [OPCODES.DUP16]: 3n,
  
  // Swap operations
  [OPCODES.SWAP1]: 3n,
  [OPCODES.SWAP2]: 3n,
  [OPCODES.SWAP3]: 3n,
  [OPCODES.SWAP4]: 3n,
  [OPCODES.SWAP5]: 3n,
  [OPCODES.SWAP6]: 3n,
  [OPCODES.SWAP7]: 3n,
  [OPCODES.SWAP8]: 3n,
  [OPCODES.SWAP9]: 3n,
  [OPCODES.SWAP10]: 3n,
  [OPCODES.SWAP11]: 3n,
  [OPCODES.SWAP12]: 3n,
  [OPCODES.SWAP13]: 3n,
  [OPCODES.SWAP14]: 3n,
  [OPCODES.SWAP15]: 3n,
  [OPCODES.SWAP16]: 3n,
  
  // Logging operations
  [OPCODES.LOG0]: 375n,
  [OPCODES.LOG1]: 750n,
  [OPCODES.LOG2]: 1125n,
  [OPCODES.LOG3]: 1500n,
  [OPCODES.LOG4]: 1875n,
  
  // System operations
  [OPCODES.CREATE]: 32000n,
  [OPCODES.CALL]: 40n,
  [OPCODES.CALLCODE]: 40n,
  [OPCODES.RETURN]: 0n,
  [OPCODES.DELEGATECALL]: 40n,
  [OPCODES.CREATE2]: 32000n,
  [OPCODES.STATICCALL]: 40n,
  [OPCODES.REVERT]: 0n,
  [OPCODES.SELFDESTRUCT]: 0n,
};

// Helper function to pad bytes to a specific length
function padBytes(bytes: Uint8Array, length: number): Uint8Array {
  if (bytes.length >= length) return bytes;
  
  const result = new Uint8Array(length);
  result.set(bytes, length - bytes.length);
  return result;
}

// Create opcode handler map
export function createOpcodeHandlers(): Map<number, OpcodeHandler> {
  const handlers = new Map<number, OpcodeHandler>();
  
  // Stack operations
  handlers.set(OPCODES.STOP, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.STOP]!);
    ctx.stop();
  });
  
  handlers.set(OPCODES.ADD, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.ADD]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push((a + b) & ((1n << 256n) - 1n));
  });
  
  handlers.set(OPCODES.MUL, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.MUL]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push((a * b) & ((1n << 256n) - 1n));
  });
  
  handlers.set(OPCODES.SUB, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.SUB]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push((a - b) & ((1n << 256n) - 1n));
  });
  
  handlers.set(OPCODES.DIV, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.DIV]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(b === 0n ? 0n : a / b);
  });
  
  handlers.set(OPCODES.MOD, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.MOD]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(b === 0n ? 0n : a % b);
  });
  
  handlers.set(OPCODES.EXP, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.EXP]!);
    const base = ctx.pop();
    const exponent = ctx.pop();
    ctx.push(expmod(base, exponent, 1n << 256n));
  });
  
  // Comparison & bitwise logic
  handlers.set(OPCODES.LT, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.LT]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(a < b ? 1n : 0n);
  });
  
  handlers.set(OPCODES.GT, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.GT]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(a > b ? 1n : 0n);
  });
  
  handlers.set(OPCODES.EQ, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.EQ]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(a === b ? 1n : 0n);
  });
  
  handlers.set(OPCODES.ISZERO, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.ISZERO]!);
    const value = ctx.pop();
    ctx.push(value === 0n ? 1n : 0n);
  });
  
  handlers.set(OPCODES.AND, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.AND]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(a & b);
  });
  
  handlers.set(OPCODES.OR, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.OR]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(a | b);
  });
  
  handlers.set(OPCODES.XOR, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.XOR]!);
    const a = ctx.pop();
    const b = ctx.pop();
    ctx.push(a ^ b);
  });
  
  handlers.set(OPCODES.NOT, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.NOT]!);
    const value = ctx.pop();
    ctx.push(~value & ((1n << 256n) - 1n));
  });
  
  handlers.set(OPCODES.SHL, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.SHL]!);
    const shift = ctx.pop();
    const value = ctx.pop();
    if (shift >= 256n) {
      ctx.push(0n);
    } else {
      ctx.push((value << shift) & ((1n << 256n) - 1n));
    }
  });
  
  handlers.set(OPCODES.SHR, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.SHR]!);
    const shift = ctx.pop();
    const value = ctx.pop();
    if (shift >= 256n) {
      ctx.push(0n);
    } else {
      ctx.push(value >> shift);
    }
  });
  
  handlers.set(OPCODES.SAR, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.SAR]!);
    const shift = ctx.pop();
    const value = ctx.pop();
    // Arithmetic right shift (sign-extending)
    const isNegative = value >= (1n << 255n);
    if (shift >= 256n) {
      ctx.push(isNegative ? ((1n << 256n) - 1n) : 0n);
    } else {
      let result = value >> shift;
      if (isNegative) {
        // Fill with 1s from the left
        const mask = ((1n << shift) - 1n) << (256n - shift);
        result |= mask;
      }
      ctx.push(result & ((1n << 256n) - 1n));
    }
  });
  
  // Environmental information
  handlers.set(OPCODES.ADDRESS, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.ADDRESS]!);
    ctx.push(bytesToBigint(ctx.env.address));
  });
  
  handlers.set(OPCODES.CALLER, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.CALLER]!);
    ctx.push(bytesToBigint(ctx.env.caller));
  });
  
  handlers.set(OPCODES.CALLVALUE, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.CALLVALUE]!);
    ctx.push(ctx.env.value);
  });
  
  handlers.set(OPCODES.CALLDATALOAD, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.CALLDATALOAD]!);
    const offset = Number(ctx.pop());
    const data = ctx.readCalldata(offset, 32);
    // Pad on the RIGHT (zeros at the end) for calldata
    const padded = new Uint8Array(32);
    padded.set(data, 0);  // Put data at the START, zeros fill the rest
    ctx.push(bytesToBigint(padded));
  });
  
  handlers.set(OPCODES.CALLDATASIZE, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.CALLDATASIZE]!);
    ctx.push(BigInt(ctx.calldata.length));
  });
  
  handlers.set(OPCODES.CALLDATACOPY, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.CALLDATACOPY]!);
    const destOffset = Number(ctx.pop());
    const offset = Number(ctx.pop());
    const size = Number(ctx.pop());
    
    const data = ctx.readCalldata(offset, size);
    ctx.writeMemory(destOffset, data);
  });
  
  handlers.set(OPCODES.CODESIZE, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.CODESIZE]!);
    ctx.push(BigInt(ctx.code.length));
  });
  
  handlers.set(OPCODES.CODECOPY, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.CODECOPY]!);
    const destOffset = Number(ctx.pop());
    const offset = Number(ctx.pop());
    const size = Number(ctx.pop());
    
    // Copy code to memory
    const end = Math.min(offset + size, ctx.code.length);
    const actualSize = Math.max(0, end - offset);
    const data = ctx.code.slice(offset, end);
    
    // Pad with zeros if needed
    if (actualSize < size) {
      const padded = new Uint8Array(size);
      padded.set(data);
      ctx.writeMemory(destOffset, padded);
    } else {
      ctx.writeMemory(destOffset, data);
    }
  });
  
  // Stack, Memory, Storage and Flow Operations
  handlers.set(OPCODES.POP, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.POP]!);
    ctx.pop();
  });
  
  handlers.set(OPCODES.MLOAD, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.MLOAD]!);
    const offset = Number(ctx.pop());
    const data = ctx.readMemory(offset, 32);
    ctx.push(bytesToBigint(padBytes(data, 32)));
  });
  
  handlers.set(OPCODES.MSTORE, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.MSTORE]!);
    const offset = Number(ctx.pop());
    const value = ctx.pop();
    ctx.writeMemoryWord(offset, value);
  });
  
  handlers.set(OPCODES.MSTORE8, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.MSTORE8]!);
    const offset = Number(ctx.pop());
    const value = ctx.pop();
    const byte = Number(value & 0xffn);
    const data = new Uint8Array([byte]);
    ctx.writeMemory(offset, data);
  });
  
  handlers.set(OPCODES.SLOAD, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.SLOAD]!);
    const key = ctx.pop();
    const value = ctx.world.getStorage(ctx.env.address, key);
    ctx.push(value);
  });
  
  handlers.set(OPCODES.SSTORE, (ctx) => {
    // Simplified gas cost for SSTORE
    ctx.useGas(20000n); // Fixed cost for simplicity
    const key = ctx.pop();
    const value = ctx.pop();
    ctx.world.setStorage(ctx.env.address, key, value);
  });
  
  handlers.set(OPCODES.JUMP, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.JUMP]!);
    const destination = Number(ctx.pop());
    ctx.jump(destination);
    // Note: jump() sets PC directly, so no increment needed
  });
  
  handlers.set(OPCODES.JUMPI, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.JUMPI]!);
    const destination = Number(ctx.pop());
    const condition = ctx.pop();
    
    if (condition !== 0n) {
      ctx.jump(destination);
    } else {
      // If not jumping, increment PC to continue execution
      ctx.pc++;
    }
  });
  
  handlers.set(OPCODES.PC, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.PC]!);
    ctx.push(BigInt(ctx.pc));
  });
  
  handlers.set(OPCODES.MSIZE, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.MSIZE]!);
    ctx.push(BigInt(ctx.memory.length));
  });
  
  handlers.set(OPCODES.GAS, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.GAS]!);
    ctx.push(ctx.gasLeft);
  });
  
  handlers.set(OPCODES.JUMPDEST, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.JUMPDEST]!);
    // No operation, just a marker
  });
  
  // PUSH0 - pushes 0 onto the stack
  handlers.set(OPCODES.PUSH0, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.PUSH0]!);
    ctx.push(0n);
  });
  
  // Push operations (set last to avoid overwriting)
  for (let i = 0; i <= 31; i++) {
    const opcode = OPCODES.PUSH1 + i;
    handlers.set(opcode, (ctx) => {
      ctx.useGas(GAS_COSTS[opcode]!);
      const data = ctx.readPushData();
      const value = bytesToBigint(padBytes(data, 32));
      ctx.push(value);
    });
  }
  
  // Duplication operations
  for (let i = 0; i <= 15; i++) {
    const opcode = OPCODES.DUP1 + i;
    handlers.set(opcode, (ctx) => {
      ctx.useGas(GAS_COSTS[opcode]!);
      ctx.dup(i);
    });
  }
  
  // Swap operations
  for (let i = 0; i <= 15; i++) {
    const opcode = OPCODES.SWAP1 + i;
    handlers.set(opcode, (ctx) => {
      ctx.useGas(GAS_COSTS[opcode]!);
      ctx.swap(i);
    });
  }
  
  // System operations
  handlers.set(OPCODES.RETURN, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.RETURN]!);
    const offset = Number(ctx.pop());
    const size = Number(ctx.pop());
    const data = ctx.readMemory(offset, size);
    ctx.stop(data);
  });
  
  handlers.set(OPCODES.REVERT, (ctx) => {
    ctx.useGas(GAS_COSTS[OPCODES.REVERT]!);
    const offset = Number(ctx.pop());
    const size = Number(ctx.pop());
    const data = ctx.readMemory(offset, size);
    ctx.revert(data);
  });
  
  return handlers;
}

// Helper function for modular exponentiation
function expmod(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n;
  
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  
  while (e > 0) {
    if (e % 2n === 1n) {
      result = (result * b) % modulus;
    }
    e >>= 1n;
    b = (b * b) % modulus;
  }
  
  return result;
}