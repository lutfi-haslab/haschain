// Calculator Contract Example - Pure Functions
//
// Equivalent Solidity:
// ```solidity
// contract Calculator {
//     function add(uint256 a, uint256 b) public pure returns (uint256) {
//         return a + b;
//     }
//     
//     function multiply(uint256 a, uint256 b) public pure returns (uint256) {
//         return a * b;
//     }
//     
//     function square(uint256 x) public pure returns (uint256) {
//         return x * x;
//     }
// }
// ```

import { Contract, $, EvmHelper, addressFromHex, encodeCall, decodeUint256 } from '../evm';

// Define Calculator contract
const calculator = new Contract()
  .function('add', [{ name: 'a', type: 'uint256' }, { name: 'b', type: 'uint256' }], { returns: 'uint256' })
    .returns($.add($.param(0), $.param(1)))

  .function('multiply', [{ name: 'a', type: 'uint256' }, { name: 'b', type: 'uint256' }], { returns: 'uint256' })
    .returns($.mul($.param(0), $.param(1)))

  .function('square', [{ name: 'x', type: 'uint256' }], { returns: 'uint256' })
    .returns($.mul($.param(0), $.param(0)));

async function main() {
  console.log('Calculator Contract Example');
  console.log('===========================\n');

  const evm = new EvmHelper();
  const user = addressFromHex('0x2222222222222222222222222222222222222222');
  evm.createAccount(user, 10n ** 18n);

  // Deploy
  const bytecode = calculator.compile();
  console.log('Bytecode size:', bytecode.length, 'bytes');

  const { contractAddress } = evm.deployContract(user, bytecode);
  console.log('Deployed!\n');

  // Test add(5, 3) - using encodeCall helper
  let result = evm.call(user, contractAddress, encodeCall('add(uint256,uint256)', 5n, 3n));
  console.log('add(5, 3) =', decodeUint256(result.returnData).toString());

  // Test multiply(7, 6)
  result = evm.call(user, contractAddress, encodeCall('multiply(uint256,uint256)', 7n, 6n));
  console.log('multiply(7, 6) =', decodeUint256(result.returnData).toString());

  // Test square(9)
  result = evm.call(user, contractAddress, encodeCall('square(uint256)', 9n));
  console.log('square(9) =', decodeUint256(result.returnData).toString());

  // Test with big numbers
  console.log('\nBig number test:');
  const bigA = 123456789012345678901234567890n;
  const bigB = 987654321098765432109876543210n;
  result = evm.call(user, contractAddress, encodeCall('add(uint256,uint256)', bigA, bigB));
  console.log(`add(${bigA}, ${bigB})`);
  console.log('=', decodeUint256(result.returnData).toString());
}

main().catch(console.error);
