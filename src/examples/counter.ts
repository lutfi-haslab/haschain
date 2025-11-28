// Counter Contract Example - Human Readable DSL
// 
// This is equivalent to:
// ```solidity
// contract Counter {
//     uint256 count;
//     
//     function increment() public {
//         count = count + 1;
//     }
//     
//     function decrement() public {
//         count = count - 1;
//     }
//     
//     function getCount() public view returns (uint256) {
//         return count;
//     }
// }
// ```

import { Contract, $, EvmHelper, addressFromHex, selector, decodeUint256 } from '../evm';

// Define the Counter contract using our DSL
const counter = new Contract()
  .uint256('count')  // Storage variable

  .function('increment')
    .set('count', $.add($.var('count'), $.num(1)))

  .function('decrement')
    .set('count', $.sub($.var('count'), $.num(1)))

  .function('getCount', [], { view: true, returns: 'uint256' })
    .returns($.var('count'));

// Compile and deploy
async function main() {
  console.log('Counter Contract Example');
  console.log('========================\n');

  const evm = new EvmHelper();
  const deployer = addressFromHex('0x1111111111111111111111111111111111111111');
  evm.createAccount(deployer, 10n ** 18n);

  // Compile and deploy
  const bytecode = counter.compile();
  console.log('Bytecode size:', bytecode.length, 'bytes');

  const { contractAddress, result } = evm.deployContract(deployer, bytecode);
  console.log('Deployed at:', Array.from(contractAddress).map(b => b.toString(16).padStart(2, '0')).join(''));
  console.log('Deploy gas:', result.gasUsed.toString());

  // Test the contract
  const incrementSel = selector('increment()');
  const decrementSel = selector('decrement()');
  const getCountSel = selector('getCount()');

  // Get initial count
  let countResult = evm.call(deployer, contractAddress, getCountSel);
  console.log('\nInitial count:', decodeUint256(countResult.returnData));

  // Increment 3 times
  console.log('\nIncrementing 3 times...');
  evm.sendTransaction(deployer, contractAddress, incrementSel);
  evm.sendTransaction(deployer, contractAddress, incrementSel);
  evm.sendTransaction(deployer, contractAddress, incrementSel);

  countResult = evm.call(deployer, contractAddress, getCountSel);
  console.log('Count after increments:', decodeUint256(countResult.returnData));

  // Decrement once
  console.log('\nDecrementing once...');
  evm.sendTransaction(deployer, contractAddress, decrementSel);

  countResult = evm.call(deployer, contractAddress, getCountSel);
  console.log('Final count:', decodeUint256(countResult.returnData));
}

main().catch(console.error);
