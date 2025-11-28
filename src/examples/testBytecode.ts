

// Simple contract that stores a value
// Solidity equivalent:
// contract SimpleStorage {
//     uint256 value;
//     function setValue(uint256 _value) public {
//         value = _value;
//     }
//     function getValue() public view returns (uint256) {
//         return value;
//     }
// }

import { hexToBytes, EvmHelper, addressFromHex } from "../evm";

// Simple storage contract bytecode
// This contract has two functions:
// - setValue(uint256): selector 0x60fe47b1
// - getValue(): selector 0x6d4ce63c
const simpleStorageBytecode = hexToBytes(
  // Constructor: copy runtime code and return it
  '6036' +      // PUSH1 54 (runtime code size)
  '600c' +      // PUSH1 12 (offset where runtime starts)
  '6000' +      // PUSH1 0 (dest memory offset)
  '39' +        // CODECOPY
  '6036' +      // PUSH1 54 (size to return)
  '6000' +      // PUSH1 0 (memory offset)
  'f3' +        // RETURN
  
  // Runtime code starts here
  // Get function selector
  '600035' +    // PUSH1 0, CALLDATALOAD
  '60e01c' +    // PUSH1 224, SHR (get 4-byte selector)
  
  // Check if selector == 0x60fe47b1 (setValue)
  '80' +        // DUP1 -> [selector, selector]
  '6360fe47b1' + // PUSH4 0x60fe47b1 -> [selector, selector, 0x60fe47b1]
  '14' +        // EQ -> [selector, match?]
  '6020' +      // PUSH1 32 (0x20 - setValue JUMPDEST)
  '57' +        // JUMPI (pops dest then condition)
  
  // Check if selector == 0x6d4ce63c (getValue)
  '80' +        // DUP1 -> [selector, selector]
  '636d4ce63c' + // PUSH4 0x6d4ce63c -> [selector, selector, 0x6d4ce63c]
  '14' +        // EQ -> [selector, match?]
  '6029' +      // PUSH1 41 (0x29 - getValue JUMPDEST)
  '57' +        // JUMPI
  
  // No match - revert
  '50' +        // POP (remove selector)
  '60006000fd' + // PUSH1 0, PUSH1 0, REVERT
  
  // setValue function (offset 32 = 0x20)
  '5b' +        // JUMPDEST
  '50' +        // POP (remove selector from stack)
  '600435' +    // PUSH1 4, CALLDATALOAD
  '600055' +    // PUSH1 0, SSTORE
  '00' +        // STOP
  
  // getValue function (offset 41 = 0x29)
  '5b' +        // JUMPDEST
  '50' +        // POP (remove selector from stack)
  '600054' +    // PUSH1 0, SLOAD
  '600052' +    // PUSH1 0, MSTORE
  '60206000f3'  // PUSH1 32, PUSH1 0, RETURN
);

// Function selector for setValue(uint256)
const setValueSelector = hexToBytes('60fe47b1');

// Function selector for getValue()
const getValueSelector = hexToBytes('6d4ce63c');

// Encode a uint256 value for calldata
function encodeUint256(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return hexToBytes(hex);
}

// Main example
async function main() {
  console.log('EVM Example: Simple Storage Contract');
  console.log('=====================================');
  
  // Create EVM helper
  const evm = new EvmHelper();
  
  // Create accounts
  const deployer = addressFromHex('0x1234567890123456789012345678901234567890');
  const user = addressFromHex('0x9876543210987654321098765432109876543210');
  
  // Create accounts in the world state
  evm.createAccount(deployer, 1000000000000000000n); // 1 ETH
  evm.createAccount(user, 1000000000000000000n); // 1 ETH
  
  console.log('Deployer balance:', evm.getBalance(deployer).toString());
  console.log('User balance:', evm.getBalance(user).toString());
  
  // Deploy the contract
  console.log('\nDeploying SimpleStorage contract...');
  const deployResult = evm.deployContract(deployer, simpleStorageBytecode);
  
  if (!deployResult.result.success) {
    console.error('Contract deployment failed');
    return;
  }
  
  const contractAddress = deployResult.contractAddress;
  console.log('Contract deployed at address:', contractAddress);
  console.log('Gas used for deployment:', deployResult.result.gasUsed.toString());
  
  // Check initial state
  console.log('\nChecking initial storage value...');
  const initialValue = evm.readStorage(contractAddress, 0n);
  console.log('Initial value:', initialValue.toString());
  
  // Call setValue(uint256)
  console.log('\nCalling setValue(42)...');
  const valueToStore = 42n;
  const setValueCalldata = new Uint8Array([
    ...setValueSelector,
    ...encodeUint256(valueToStore)
  ]);
  
  const txResult = evm.sendTransaction(user, contractAddress, setValueCalldata);
  
  if (!txResult.success) {
    console.error('Transaction failed');
    console.error('Gas used:', txResult.gasUsed.toString());
    console.error('Return data:', txResult.returnData);
    return;
  }
  
  console.log('Transaction successful');
  console.log('Gas used:', txResult.gasUsed.toString());
  
  // Check updated state
  console.log('\nChecking updated storage value...');
  const updatedValue = evm.readStorage(contractAddress, 0n);
  console.log('Updated value:', updatedValue.toString());
  
  // Call getValue() view function
  console.log('\nCalling getValue() view function...');
  const getValueResult = evm.call(user, contractAddress, getValueSelector);
  
  if (!getValueResult.success) {
    console.error('View call failed');
    return;
  }
  
  // Decode the returned value (first 32 bytes)
  let returnedValue = 0n;
  if (getValueResult.returnData.length >= 32) {
    const hex = Array.from(getValueResult.returnData)
      .slice(0, 32)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    returnedValue = BigInt('0x' + hex);
  }
  
  console.log('Returned value from getValue():', returnedValue.toString());
  
  // Check final balances
  console.log('\nFinal account balances:');
  console.log('Deployer balance:', evm.getBalance(deployer).toString());
  console.log('User balance:', evm.getBalance(user).toString());
  
  console.log('\nExample completed successfully!');
}

// Run the example
main().catch(console.error);