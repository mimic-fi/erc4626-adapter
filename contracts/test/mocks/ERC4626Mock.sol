// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

contract ERC4626Mock is ERC4626 {
    using FixedPoint for uint256;

    // Used to simulate the total supply is not fully available
    uint256 public immutable factor;

    constructor(address underlying, uint256 _factor)
        ERC20('ERC4626Mock', 'E4626M')
        ERC4626(IERC20Metadata(underlying))
    {
        factor = _factor;
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return super.maxWithdraw(owner).mulDown(factor);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
