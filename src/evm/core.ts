import type { Bytes, ExecutionResult } from './types.js';
import type { IWorldState } from './worldState.js';
import type { Env } from './types.js';
import { ExecutionContext } from './executionContext.js';
import { createOpcodeHandlers, OPCODES } from './opcodes.js';
import { bytesToBigint } from './utils.js';

// EVM execution engine
export class Evm {
  private opcodeHandlers: Map<number, (ctx: ExecutionContext) => void>;
  
  constructor() {
    this.opcodeHandlers = createOpcodeHandlers();
  }
  
  // Execute bytecode with the given environment and world state
  public execute(
    code: Bytes,
    world: IWorldState,
    env: Env,
    gasLimit: bigint,
    calldata: Bytes = new Uint8Array(0)
  ): ExecutionResult {
    // Create execution context
    const ctx = new ExecutionContext(code, world, env, gasLimit, calldata);
    
    // Track initial gas for calculating gas used
    const initialGas = gasLimit;
    
    try {
      // Main execution loop
      while (!ctx.stopped && ctx.pc < code.length) {
        // Get current opcode
        const opcode = ctx.getCurrentOpcode();
        
        // Get handler for this opcode
        const handler = this.opcodeHandlers.get(opcode);
        
        if (!handler) {
          // Invalid opcode
          ctx.revert();
          break;
        }
        
        // Execute the handler
        handler(ctx);
        
        // Increment PC if not a jump instruction or PUSH
        const isPush = opcode >= 0x60 && opcode <= 0x7f; // PUSH1 to PUSH32
        // PUSH0 (0x5f) should increment PC like other non-PUSH instructions
        if (opcode !== OPCODES.JUMP && opcode !== OPCODES.JUMPI && !isPush && !ctx.stopped) {
          ctx.pc++;
        }
      }
      
      // Calculate gas used
      const gasUsed = initialGas - ctx.gasLeft;
      
      // Return execution result
      return {
        success: !ctx.reverted,
        gasUsed,
        returnData: ctx.returnData
      };
    } catch (error) {
      // Handle any errors during execution
      const gasUsed = initialGas - ctx.gasLeft;
      
      return {
        success: false,
        gasUsed,
        returnData: new Uint8Array(0)
      };
    }
  }
  
  // Create a child context for CALL operations
  public createCallContext(
    parent: ExecutionContext,
    code: Bytes,
    address: Bytes,
    value: bigint,
    gasLimit: bigint,
    calldata: Bytes
  ): ExecutionContext {
    return parent.createChildContext(code, address, value, gasLimit, calldata);
  }
  
  // Execute a child context and return the result
  public executeChild(child: ExecutionContext): ExecutionResult {
    // Track initial gas for calculating gas used
    const initialGas = child.gasLeft;
    
    try {
      // Main execution loop
      while (!child.stopped && child.pc < child.code.length) {
        // Get current opcode
        const opcode = child.getCurrentOpcode();
        
        // Get handler for this opcode
        const handler = this.opcodeHandlers.get(opcode);
        
        if (!handler) {
          // Invalid opcode
          child.revert();
          break;
        }
        
        // Execute the handler
        handler(child);
        
        // Increment PC if not a jump instruction or PUSH
        const isPush = opcode >= 0x60 && opcode <= 0x7f; // PUSH1 to PUSH32
        if (opcode !== OPCODES.JUMP && opcode !== OPCODES.JUMPI && !isPush && !child.stopped) {
          child.pc++;
        }
      }
      
      // Calculate gas used
      const gasUsed = initialGas - child.gasLeft;
      
      // Return execution result
      return {
        success: !child.reverted,
        gasUsed,
        returnData: child.returnData
      };
    } catch (error) {
      // Handle any errors during execution
      const gasUsed = initialGas - child.gasLeft;
      
      return {
        success: false,
        gasUsed,
        returnData: new Uint8Array(0)
      };
    }
  }
}

// Create a default EVM instance
export const evm = new Evm();