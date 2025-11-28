// Simple Storage Contract - The Classic Example
//
// Equivalent Solidity:
// ```solidity
// contract SimpleStorage {
//     uint256 value;
//     
//     function setValue(uint256 _value) public {
//         value = _value;
//     }
//     
//     function getValue() public view returns (uint256) {
//         return value;
//     }
// }
// ```

import { Contract, $, EvmHelper, addressFromHex, selector, encodeCall, decodeUint256 } from '../evm';

// Define the contract - clean and readable!
const storage = new Contract()
  .uint256('value')

  .function('setValue', [{ name: '_value', type: 'uint256' }])
    .set('value', $.param(0))

  .function('getValue', [], { view: true, returns: 'uint256' })
    .returns($.var('value'));

async function main() {
  console.log('Simple Storage Contract');
  console.log('=======================\n');

  const evm = new EvmHelper();
  const user = addressFromHex('0x3333333333333333333333333333333333333333');
  evm.createAccount(user, 10n ** 18n);

  // Deploy
  const bytecode = storage.compile();
  console.log('Bytecode size:', bytecode.length, 'bytes');

  const { contractAddress } = evm.deployContract(user, bytecode);
  console.log('Contract deployed!\n');

  // Get initial value
  let result = evm.call(user, contractAddress, selector('getValue()'));
  console.log('Initial value:', decodeUint256(result.returnData).toString());

  // Set value to 42
  console.log('\nSetting value to 42...');
  evm.sendTransaction(user, contractAddress, encodeCall('setValue(uint256)', 42n));

  result = evm.call(user, contractAddress, selector('getValue()'));
  console.log('Value after set:', decodeUint256(result.returnData).toString());

  // Set to a larger value
  console.log('\nSetting value to 1000000...');
  evm.sendTransaction(user, contractAddress, encodeCall('setValue(uint256)', 1000000n));

  result = evm.call(user, contractAddress, selector('getValue()'));
  console.log('Final value:', decodeUint256(result.returnData).toString());
}

main().catch(console.error);
