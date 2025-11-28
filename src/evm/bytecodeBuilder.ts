// Human-readable bytecode builder for EVM contracts
import { OPCODES } from './opcodes.js';

export class BytecodeBuilder {
  private code: number[] = [];
  private labels: Map<string, number> = new Map();
  private labelRefs: { position: number; label: string; size: number }[] = [];

  // Add raw bytes
  raw(...bytes: number[]): this {
    this.code.push(...bytes);
    return this;
  }

  // Define a label at current position
  label(name: string): this {
    this.labels.set(name, this.code.length);
    return this;
  }

  // Stack operations
  stop(): this { return this.raw(OPCODES.STOP); }
  add(): this { return this.raw(OPCODES.ADD); }
  mul(): this { return this.raw(OPCODES.MUL); }
  sub(): this { return this.raw(OPCODES.SUB); }
  div(): this { return this.raw(OPCODES.DIV); }
  mod(): this { return this.raw(OPCODES.MOD); }
  exp(): this { return this.raw(OPCODES.EXP); }

  // Comparison
  lt(): this { return this.raw(OPCODES.LT); }
  gt(): this { return this.raw(OPCODES.GT); }
  eq(): this { return this.raw(OPCODES.EQ); }
  iszero(): this { return this.raw(OPCODES.ISZERO); }

  // Bitwise
  and(): this { return this.raw(OPCODES.AND); }
  or(): this { return this.raw(OPCODES.OR); }
  xor(): this { return this.raw(OPCODES.XOR); }
  not(): this { return this.raw(OPCODES.NOT); }
  shl(): this { return this.raw(OPCODES.SHL); }
  shr(): this { return this.raw(OPCODES.SHR); }

  // Environment
  address(): this { return this.raw(OPCODES.ADDRESS); }
  caller(): this { return this.raw(OPCODES.CALLER); }
  callvalue(): this { return this.raw(OPCODES.CALLVALUE); }
  calldataload(): this { return this.raw(OPCODES.CALLDATALOAD); }
  calldatasize(): this { return this.raw(OPCODES.CALLDATASIZE); }
  calldatacopy(): this { return this.raw(OPCODES.CALLDATACOPY); }
  codesize(): this { return this.raw(OPCODES.CODESIZE); }
  codecopy(): this { return this.raw(OPCODES.CODECOPY); }

  // Memory/Storage
  pop(): this { return this.raw(OPCODES.POP); }
  mload(): this { return this.raw(OPCODES.MLOAD); }
  mstore(): this { return this.raw(OPCODES.MSTORE); }
  mstore8(): this { return this.raw(OPCODES.MSTORE8); }
  sload(): this { return this.raw(OPCODES.SLOAD); }
  sstore(): this { return this.raw(OPCODES.SSTORE); }

  // Flow control
  jump(): this { return this.raw(OPCODES.JUMP); }
  jumpi(): this { return this.raw(OPCODES.JUMPI); }
  jumpdest(): this { return this.raw(OPCODES.JUMPDEST); }
  pc(): this { return this.raw(OPCODES.PC); }
  gas(): this { return this.raw(OPCODES.GAS); }

  // Push operations
  push0(): this { return this.raw(OPCODES.PUSH0); }

  push1(value: number): this {
    return this.raw(OPCODES.PUSH1, value & 0xff);
  }

  push2(value: number): this {
    return this.raw(OPCODES.PUSH2, (value >> 8) & 0xff, value & 0xff);
  }

  push4(value: number): this {
    return this.raw(
      OPCODES.PUSH4,
      (value >> 24) & 0xff,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff
    );
  }

  push32(value: bigint): this {
    const bytes: number[] = [OPCODES.PUSH32];
    for (let i = 31; i >= 0; i--) {
      bytes.push(Number((value >> BigInt(i * 8)) & 0xffn));
    }
    return this.raw(...bytes);
  }

  // Push with automatic size selection
  pushValue(value: number | bigint): this {
    const v = BigInt(value);
    if (v === 0n) return this.push0();
    if (v <= 0xffn) return this.push1(Number(v));
    if (v <= 0xffffn) return this.push2(Number(v));
    if (v <= 0xffffffffn) return this.push4(Number(v));
    return this.push32(v);
  }

  // Push a label reference (resolved at build time)
  pushLabel(label: string): this {
    this.labelRefs.push({ position: this.code.length + 1, label, size: 1 });
    return this.raw(OPCODES.PUSH1, 0x00); // Placeholder
  }

  // Dup operations
  dup1(): this { return this.raw(OPCODES.DUP1); }
  dup2(): this { return this.raw(OPCODES.DUP2); }
  dup3(): this { return this.raw(OPCODES.DUP3); }
  dup4(): this { return this.raw(OPCODES.DUP4); }

  // Swap operations
  swap1(): this { return this.raw(OPCODES.SWAP1); }
  swap2(): this { return this.raw(OPCODES.SWAP2); }
  swap3(): this { return this.raw(OPCODES.SWAP3); }

  // System operations
  return_(): this { return this.raw(OPCODES.RETURN); }
  revert(): this { return this.raw(OPCODES.REVERT); }

  // Build the final bytecode
  build(): Uint8Array {
    // Resolve label references
    for (const ref of this.labelRefs) {
      const labelPos = this.labels.get(ref.label);
      if (labelPos === undefined) {
        throw new Error(`Undefined label: ${ref.label}`);
      }
      this.code[ref.position] = labelPos & 0xff;
    }
    return new Uint8Array(this.code);
  }

  // Get current code length
  get length(): number {
    return this.code.length;
  }
}

// Helper to create a constructor that deploys runtime code
export function createDeploymentBytecode(runtimeCode: Uint8Array): Uint8Array {
  const builder = new BytecodeBuilder();
  const runtimeSize = runtimeCode.length;

  // Constructor: copy runtime code to memory and return it
  builder
    .push1(runtimeSize)      // Push runtime code size
    .push1(12)               // Push offset where runtime starts (after constructor)
    .push1(0)                // Push destination memory offset
    .codecopy()              // Copy runtime code to memory
    .push1(runtimeSize)      // Push size to return
    .push1(0)                // Push memory offset
    .return_();              // Return the runtime code

  const constructor = builder.build();
  const result = new Uint8Array(constructor.length + runtimeCode.length);
  result.set(constructor);
  result.set(runtimeCode, constructor.length);
  return result;
}

// Function selector helper
export function selector(signature: string): number {
  // Simple hash for demo - in real EVM this would be keccak256
  const selectors: Record<string, number> = {
    'setValue(uint256)': 0x60fe47b1,
    'getValue()': 0x6d4ce63c,
    'increment()': 0xd09de08a,
    'decrement()': 0x2baeceb7,
    'getCount()': 0xa87d942c,
    'deposit()': 0xd0e30db0,
    'withdraw(uint256)': 0x2e1a7d4d,
    'balanceOf(address)': 0x70a08231,
    'transfer(address,uint256)': 0xa9059cbb,
    'owner()': 0x8da5cb5b,
    'add(uint256,uint256)': 0x771602f7,
    'multiply(uint256,uint256)': 0x165c4a16,
  };
  return selectors[signature] || 0;
}
