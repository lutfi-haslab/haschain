### Test with Bytecode Contract
```bash
lutfiikbalmajid@master haschain % bun run src/examples/testBytecode.ts
EVM Example: Simple Storage Contract
=====================================
Deployer balance: 1000000000000000000
User balance: 1000000000000000000

Deploying SimpleStorage contract...
Contract deployed at address: Uint8Array(20) [ 89, 109, 196, 224, 215, 167, 42, 205, 61, 22, 6, 227, 158, 229, 225, 176, 255, 203, 164, 207 ]
Gas used for deployment: 18

Checking initial storage value...
Initial value: 0

Calling setValue(42)...
Transaction successful
Gas used: 20046

Checking updated storage value...
Updated value: 42

Calling getValue() view function...
Returned value from getValue(): 42

Final account balances:
Deployer balance: 999999999999999982
User balance: 999999999999979954

Example completed successfully!
```

### Calculator
```bash
lutfiikbalmajid@master haschain % bun run src/examples/calculator.ts  
Calculator Contract Example
===========================

Bytecode size: 104 bytes
Deployed!

add(5, 3) = 8
multiply(7, 6) = 42
square(9) = 81

Big number test:
add(123456789012345678901234567890, 987654321098765432109876543210)
= 1111111110111111111011111111100
```

### Counter
```bash
lutfiikbalmajid@master haschain % bun run src/examples/counter.ts   
Counter Contract Example
========================

Bytecode size: 91 bytes
Deployed at: d5d3f4e32243c7721042fc883d5a4f181b04058b
Deploy gas: 18

Initial count: 0n

Incrementing 3 times...
Count after increments: 3n

Decrementing once...
Final count: 2n 
```

### Storage
```bash
lutfiikbalmajid@master haschain % bun run src/examples/storage.ts
Simple Storage Contract
=======================

Bytecode size: 65 bytes
Contract deployed!

Initial value: 0

Setting value to 42...
Value after set: 42

Setting value to 1000000...
Final value: 1000000
```