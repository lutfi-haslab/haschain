### Full Blockchain Demo
```bash
lutfiikbalmajid@master haschain % bun run src/examples/full-blockchain-demo.t
s
═══════════════════════════════════════════════════════════════
                    HASCHAIN FULL DEMO
═══════════════════════════════════════════════════════════════

📦 STEP 1: Initialize Blockchain
─────────────────────────────────────────────────────────────

Blockchain initialized successfully
Genesis block: 0x10177f041dd69d7ea0f718368b9df063d9921492366865851e677e68dd9a46ea
Validators: 1
✅ Blockchain initialized!
   Chain ID: 1337
   Genesis Block: 0x10177f041dd69d7ea0f718368b9df063d9921492366865851e677e68dd9a46ea
   Validators: 1

💰 STEP 2: Initial Account Balances
─────────────────────────────────────────────────────────────

   Validator: 0x1111111111111111111111111111111111111111
   Alice:     0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
   Bob:       0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
   Charlie:   0xcccccccccccccccccccccccccccccccccccccccc

✍️  STEP 3: Message Signing
─────────────────────────────────────────────────────────────

   Message: "Hello, HasChain! This is a signed message from Alice."
   Signature: 0x80ba5ef0092006dcd3189b92cdf41d8b2d1b95ae...
   Valid: ✅ Yes

💸 STEP 4: Transfer Transactions
─────────────────────────────────────────────────────────────

   TX 1: Alice → Bob (5 ETH)
   Added to pool: ✅ 
   TX 2: Bob → Charlie (2 ETH)
   Added to pool: ✅ 
Block created: 0x8a6442d599752fd4e338fa79e3f6ee69939934a4572a7ee6840466b95690105a

   Block created: ✅ 

📜 STEP 5: Deploy Smart Contracts
─────────────────────────────────────────────────────────────

   Counter Contract Deployment
   Added to pool: ✅ 
   Bytecode size: 78 bytes

   Storage Contract Deployment
   Added to pool: ✅ 
   Bytecode size: 56 bytes
Transaction failed: Invalid nonce
Block created: 0x0d29ba030918e43eff2da0f294f4c4048990044e7b6fe3d81d05bd68d23dcdb2

   Block created: ✅ 

🔧 STEP 6: Contract Interactions
─────────────────────────────────────────────────────────────

   Contract Addresses (simulated):
   ├─ Counter: 0xc0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0
   └─ Storage: 0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0

   Function Selectors:
   ├─ increment(): 0xd09de08a
   ├─ setValue(42): 0x5524107700000000...
   ├─ getValue(): 0x20965255
   └─ getCount(): 0xa87d942c

   Submitting Contract Transactions:
   ├─ increment() → ✅ 
   └─ setValue(42) → ✅ 
Transaction failed: Invalid nonce
Block created: 0x0498b34b56ee47332b64ba383ef3c6eb0b2592261f864293a8dc078ff258da6a

   Block created: ✅ 

📊 STEP 7: Blockchain History
─────────────────────────────────────────────────────────────

   Total Blocks Retrieved: 4

   Block #0
   ├─ Timestamp: 2025-11-28T04:20:09.000Z
   ├─ Transactions: 0
   ├─ Gas Used: 0
   └─ Validator: 0x1111111111111111111111111111111111111111

   Block #1
   ├─ Timestamp: 2025-11-28T04:20:10.000Z
   ├─ Transactions: 2
   ├─ Gas Used: 21000
   └─ Validator: 0x1111111111111111111111111111111111111111
       Transactions:
       ├─ [0] Transfer
       │  From: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
       │  To: 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
       │  Value: 5.0000 ETH
       ├─ [1] Transfer
       │  From: 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
       │  To: 0xcccccccccccccccccccccccccccccccccccccccc
       │  Value: 2.0000 ETH

   Block #2
   ├─ Timestamp: 2025-11-28T04:20:10.000Z
   ├─ Transactions: 2
   ├─ Gas Used: 250000
   └─ Validator: 0x1111111111111111111111111111111111111111
       Transactions:
       ├─ [0] Contract Deploy
       │  From: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
       │  To: New Contract
       ├─ [1] Contract Deploy
       │  From: 0xcccccccccccccccccccccccccccccccccccccccc
       │  To: New Contract

   Block #3
   ├─ Timestamp: 2025-11-28T04:20:10.000Z
   ├─ Transactions: 1
   ├─ Gas Used: 0
   └─ Validator: 0x1111111111111111111111111111111111111111
       Transactions:
       ├─ [0] Contract Call
       │  From: 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
       │  To: 0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0

🔍 Query Specific Block by Number
─────────────────────────────────────────────────────────────

   Block #1 Details:
   ├─ Parent Hash: 0x10177f041dd69d7e...
   ├─ State Root: 0x0101010101010101...
   ├─ Tx Root: 0x54b9d7f058cf236b...
   ├─ Gas Limit: 30000000
   └─ Gas Used: 21000

🔄 STEP 8: Transaction Pool Status
─────────────────────────────────────────────────────────────

   Pending Transactions: 0
   Pool Stats:
   ├─ Pending: 0
   ├─ Queued: 1
   └─ Total: 1

👥 STEP 9: Validator Information
─────────────────────────────────────────────────────────────

   Validator: 0x1111111111111111111111111111111111111111
   ├─ Active: ✅
   ├─ Blocks Produced: 3
   └─ Missed Blocks: 0

📈 STEP 10: Final Statistics
─────────────────────────────────────────────────────────────

   Total Blocks: 4
   Total Transactions: 5
   Chain Tip: 0x0498b34b56ee47332b64ba383ef3c6eb0b2592261f864293a8dc078ff258da6a
   Latest Block Number: 3

═══════════════════════════════════════════════════════════════
                    DEMO COMPLETED SUCCESSFULLY
═══════════════════════════════════════════════════════════════
```

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

