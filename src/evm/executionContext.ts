import type { Address, Word, Bytes, Env } from './types.js';
import type { IWorldState } from './worldState.js';
import { bytesToBigint, bigintToBytes, padBytes } from './utils.js';

// Execution context for EVM operations
export class ExecutionContext {
  // Code and program counter
  public code: Bytes;
  public pc: number = 0;
  
  // EVM stack (max 1024 items)
  public stack: Word[] = [];
  
  // Memory (resizable byte array)
  public memory: Bytes = new Uint8Array(0);
  
  // Gas tracking
  public gasLeft: bigint;
  
  // Return data
  public returnData: Bytes = new Uint8Array(0);
  
  // Call data
  public calldata: Bytes;
  
  // World state reference
  public world: IWorldState;
  
  // Environment context
  public env: Env;
  
  // Execution status
  public stopped: boolean = false;
  public reverted: boolean = false;
  
  // Constructor
  constructor(
    code: Bytes,
    world: IWorldState,
    env: Env,
    gasLimit: bigint,
    calldata: Bytes = new Uint8Array(0)
  ) {
    this.code = code;
    this.world = world;
    this.env = env;
    this.gasLeft = gasLimit;
    this.calldata = calldata;
  }
  
  // Stack operations
  public push(value: Word): void {
    if (this.stack.length >= 1024) {
      throw new Error('Stack overflow');
    }
    
    // Ensure value is a valid 256-bit word
    if (value < 0n || value > (1n << 256n) - 1n) {
      throw new Error('Invalid stack value');
    }
    
    this.stack.push(value);
  }
  
  public pop(): Word {
    if (this.stack.length === 0) {
      console.error(`Stack underflow! Stack length: ${this.stack.length}, PC: ${this.pc}`);
      console.error(`Code around PC:`, Array.from(this.code.slice(Math.max(0, this.pc - 5), Math.min(this.code.length, this.pc + 5))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      throw new Error('Stack underflow');
    }
    
    return this.stack.pop()!;
  }
  
  public peek(index: number = 0): Word {
    if (index >= this.stack.length) {
      throw new Error('Stack underflow');
    }
    
    return this.stack[this.stack.length - 1 - index]!;
  }
  
  public swap(index: number): void {
    if (index >= this.stack.length) {
      throw new Error('Stack underflow');
    }
    
    const top = this.stack.length - 1;
    const target = top - index - 1;
    
    const temp = this.stack[top]!;
    this.stack[top] = this.stack[target]!;
    this.stack[target] = temp;
  }
  
  public dup(index: number): void {
    if (index >= this.stack.length) {
      throw new Error('Stack underflow');
    }
    
    const value = this.stack[this.stack.length - 1 - index]!;
    this.push(value);
  }
  
  // Memory operations
  public readMemory(offset: number, size: number): Bytes {
    if (size === 0) return new Uint8Array(0);
    
    // Expand memory if necessary
    const requiredSize = offset + size;
    if (this.memory.length < requiredSize) {
      const newMemory = new Uint8Array(requiredSize);
      newMemory.set(this.memory);
      this.memory = newMemory;
    }
    
    return this.memory.slice(offset, offset + size);
  }
  
  public writeMemory(offset: number, data: Bytes): void {
    if (data.length === 0) return;
    
    // Expand memory if necessary
    const requiredSize = offset + data.length;
    if (this.memory.length < requiredSize) {
      const newMemory = new Uint8Array(requiredSize);
      newMemory.set(this.memory);
      this.memory = newMemory;
    }
    
    this.memory.set(data, offset);
  }
  
  public writeMemoryWord(offset: number, value: Word): void {
    const bytes = bigintToBytes(value, 32);
    this.writeMemory(offset, bytes);
  }
  
  // Gas operations
  public useGas(amount: bigint): void {
    if (amount < 0n) {
      throw new Error('Negative gas consumption');
    }
    
    if (this.gasLeft < amount) {
      throw new Error('Out of gas');
    }
    
    this.gasLeft -= amount;
  }
  
  // Program counter operations
  public jump(destination: number): void {
    if (destination < 0 || destination >= this.code.length) {
      throw new Error('Invalid jump destination');
    }
    
    // Check if destination is a valid JUMPDEST
    if (this.code[destination] !== 0x5b) { // JUMPDEST opcode
      throw new Error('Invalid jump destination');
    }
    
    this.pc = destination;
  }
  
  public jumpi(condition: Word): void {
    const destination = Number(this.pop());
    
    if (condition !== 0n) {
      this.jump(destination);
    }
  }
  
  // Calldata operations
  public readCalldata(offset: number, size: number): Bytes {
    if (offset >= this.calldata.length) {
      return new Uint8Array(0);
    }
    
    const end = Math.min(offset + size, this.calldata.length);
    return this.calldata.slice(offset, end);
  }
  
  // Control flow
  public stop(returnData: Bytes = new Uint8Array(0)): void {
    this.returnData = returnData;
    this.stopped = true;
  }
  
  public revert(returnData: Bytes = new Uint8Array(0)): void {
    this.returnData = returnData;
    this.reverted = true;
    this.stopped = true;
  }
  
  // Utility methods
  public getCurrentOpcode(): number {
    if (this.pc >= this.code.length) {
      return 0x00; // STOP
    }
    
    return this.code[this.pc] ?? 0x00;
  }
  
  public readBytes(count: number): Bytes {
    if (this.pc + count > this.code.length) {
      throw new Error('Code out of bounds');
    }
    
    const bytes = this.code.slice(this.pc, this.pc + count);
    this.pc += count;
    return bytes;
  }
  
  public readByte(): number {
    if (this.pc >= this.code.length) {
      throw new Error('Code out of bounds');
    }
    
    return this.code[this.pc++] ?? 0x00;
  }
  
  public readPushData(): Bytes {
    const opcode = this.getCurrentOpcode();
    
    if (opcode < 0x60 || opcode > 0x7f) {
      throw new Error('Not a PUSH instruction');
    }
    
    const pushBytes = opcode - 0x60 + 1; // PUSH1 = 0x60, PUSH32 = 0x7f
    this.pc++; // Consume the PUSH opcode
    
    return this.readBytes(pushBytes);
  }
  
  // Create a child context for CALL operations
  public createChildContext(
    code: Bytes,
    address: Address,
    value: bigint,
    gasLimit: bigint,
    calldata: Bytes
  ): ExecutionContext {
    const childEnv: Env = {
      ...this.env,
      address,
      value
    };
    
    return new ExecutionContext(code, this.world, childEnv, gasLimit, calldata);
  }
  
  // Reset the context for reuse
  public reset(): void {
    this.pc = 0;
    this.stack = [];
    this.memory = new Uint8Array(0);
    this.returnData = new Uint8Array(0);
    this.stopped = false;
    this.reverted = false;
  }
}