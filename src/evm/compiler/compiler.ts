// Simple Solidity-like compiler for EVM bytecode
import { BytecodeBuilder, createDeploymentBytecode } from '../bytecodeBuilder.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

// Get function selector from signature
function getSelector(signature: string): number {
  const hash = keccak_256(new TextEncoder().encode(signature));
  return ((hash[0] ?? 0) << 24) | ((hash[1] ?? 0) << 16) | ((hash[2] ?? 0) << 8) | (hash[3] ?? 0);
}

// Contract definition types
type StorageVar = { slot: number; type: 'uint256' | 'address' | 'bool' };
type FunctionDef = {
  name: string;
  params: { name: string; type: string }[];
  returns?: string;
  view?: boolean;
  body: Statement[];
};

type Statement =
  | { type: 'assign'; target: string; value: Expression }
  | { type: 'return'; value: Expression }
  | { type: 'if'; condition: Expression; then: Statement[]; else?: Statement[] }
  | { type: 'require'; condition: Expression; message?: string };

type Expression =
  | { type: 'var'; name: string }
  | { type: 'param'; index: number }
  | { type: 'number'; value: bigint }
  | { type: 'caller' }
  | { type: 'callvalue' }
  | { type: 'add'; left: Expression; right: Expression }
  | { type: 'sub'; left: Expression; right: Expression }
  | { type: 'mul'; left: Expression; right: Expression }
  | { type: 'div'; left: Expression; right: Expression }
  | { type: 'eq'; left: Expression; right: Expression }
  | { type: 'lt'; left: Expression; right: Expression }
  | { type: 'gt'; left: Expression; right: Expression }
  | { type: 'and'; left: Expression; right: Expression }
  | { type: 'or'; left: Expression; right: Expression }
  | { type: 'not'; value: Expression };

// DSL Builder for creating contracts
export class Contract {
  private storage: Map<string, StorageVar> = new Map();
  private functions: FunctionDef[] = [];
  private nextSlot = 0;

  // Define a storage variable
  uint256(name: string): this {
    this.storage.set(name, { slot: this.nextSlot++, type: 'uint256' });
    return this;
  }

  address(name: string): this {
    this.storage.set(name, { slot: this.nextSlot++, type: 'address' });
    return this;
  }

  // Define a function
  function(
    name: string,
    params: { name: string; type: string }[] = [],
    options: { view?: boolean; returns?: string } = {}
  ): FunctionBuilder {
    const fn: FunctionDef = {
      name,
      params,
      returns: options.returns,
      view: options.view,
      body: [],
    };
    this.functions.push(fn);
    return new FunctionBuilder(fn, this.storage, this);
  }

  // Compile to bytecode
  compile(): Uint8Array {
    const b = new BytecodeBuilder();
    const functionLabels: Map<string, string> = new Map();

    // Generate function signatures and labels
    for (const fn of this.functions) {
      const paramTypes = fn.params.map((p) => p.type).join(',');
      const signature = `${fn.name}(${paramTypes})`;
      functionLabels.set(fn.name, `fn_${fn.name}`);
    }

    // Dispatcher: get selector and route to functions
    b.push1(0).calldataload().push1(0xe0).shr();

    for (const fn of this.functions) {
      const paramTypes = fn.params.map((p) => p.type).join(',');
      const signature = `${fn.name}(${paramTypes})`;
      const selector = getSelector(signature);

      b.dup1().push4(selector).eq().pushLabel(`fn_${fn.name}`).jumpi();
    }

    // No match - revert
    b.push1(0).push1(0).revert();

    // Generate function bodies
    for (const fn of this.functions) {
      b.label(`fn_${fn.name}`).jumpdest().pop();
      this.compileFunction(b, fn);
    }

    return createDeploymentBytecode(b.build());
  }

  private compileFunction(b: BytecodeBuilder, fn: FunctionDef): void {
    for (const stmt of fn.body) {
      this.compileStatement(b, stmt, fn);
    }
    // Default: stop if no return
    if (!fn.body.some((s) => s.type === 'return')) {
      b.stop();
    }
  }

  private compileStatement(b: BytecodeBuilder, stmt: Statement, fn: FunctionDef): void {
    switch (stmt.type) {
      case 'assign': {
        const storageVar = this.storage.get(stmt.target);
        if (storageVar) {
          this.compileExpression(b, stmt.value, fn);
          b.push1(storageVar.slot).sstore();
        }
        break;
      }
      case 'return': {
        this.compileExpression(b, stmt.value, fn);
        b.push1(0).mstore().push1(32).push1(0).return_();
        break;
      }
      case 'require': {
        this.compileExpression(b, stmt.condition, fn);
        b.pushLabel('require_ok').jumpi();
        b.push1(0).push1(0).revert();
        b.label('require_ok').jumpdest();
        break;
      }
    }
  }

  private compileExpression(b: BytecodeBuilder, expr: Expression, fn: FunctionDef): void {
    switch (expr.type) {
      case 'number':
        b.pushValue(expr.value);
        break;
      case 'var': {
        const storageVar = this.storage.get(expr.name);
        if (storageVar) {
          b.push1(storageVar.slot).sload();
        }
        break;
      }
      case 'param': {
        const offset = 4 + expr.index * 32;
        b.push1(offset).calldataload();
        break;
      }
      case 'caller':
        b.caller();
        break;
      case 'callvalue':
        b.callvalue();
        break;
      case 'add':
        this.compileExpression(b, expr.left, fn);
        this.compileExpression(b, expr.right, fn);
        b.add();
        break;
      case 'sub':
        this.compileExpression(b, expr.left, fn);
        this.compileExpression(b, expr.right, fn);
        b.swap1().sub();
        break;
      case 'mul':
        this.compileExpression(b, expr.left, fn);
        this.compileExpression(b, expr.right, fn);
        b.mul();
        break;
      case 'div':
        this.compileExpression(b, expr.left, fn);
        this.compileExpression(b, expr.right, fn);
        b.swap1().div();
        break;
      case 'eq':
        this.compileExpression(b, expr.left, fn);
        this.compileExpression(b, expr.right, fn);
        b.eq();
        break;
      case 'lt':
        this.compileExpression(b, expr.left, fn);
        this.compileExpression(b, expr.right, fn);
        b.swap1().lt();
        break;
      case 'gt':
        this.compileExpression(b, expr.left, fn);
        this.compileExpression(b, expr.right, fn);
        b.swap1().gt();
        break;
      case 'not':
        this.compileExpression(b, expr.value, fn);
        b.iszero();
        break;
    }
  }
}

// Fluent builder for function bodies
class FunctionBuilder {
  constructor(
    private fn: FunctionDef,
    private storage: Map<string, StorageVar>,
    private contract: Contract
  ) {}

  // Assign to storage variable
  set(varName: string, value: Expression): Contract {
    this.fn.body.push({ type: 'assign', target: varName, value });
    return this.contract;
  }

  // Return a value
  returns(value: Expression): Contract {
    this.fn.body.push({ type: 'return', value });
    return this.contract;
  }

  // Require condition
  require(condition: Expression): Contract {
    this.fn.body.push({ type: 'require', condition });
    return this.contract;
  }
}

// Expression helpers
export const $ = {
  var: (name: string): Expression => ({ type: 'var', name }),
  param: (index: number): Expression => ({ type: 'param', index }),
  num: (value: number | bigint): Expression => ({ type: 'number', value: BigInt(value) }),
  caller: (): Expression => ({ type: 'caller' }),
  callvalue: (): Expression => ({ type: 'callvalue' }),
  add: (left: Expression, right: Expression): Expression => ({ type: 'add', left, right }),
  sub: (left: Expression, right: Expression): Expression => ({ type: 'sub', left, right }),
  mul: (left: Expression, right: Expression): Expression => ({ type: 'mul', left, right }),
  div: (left: Expression, right: Expression): Expression => ({ type: 'div', left, right }),
  eq: (left: Expression, right: Expression): Expression => ({ type: 'eq', left, right }),
  lt: (left: Expression, right: Expression): Expression => ({ type: 'lt', left, right }),
  gt: (left: Expression, right: Expression): Expression => ({ type: 'gt', left, right }),
  not: (value: Expression): Expression => ({ type: 'not', value }),
};
