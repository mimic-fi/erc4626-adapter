// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.17;

import '../../contracts/ERC4626Adapter.sol';

contract ERC4626AdapterHarness is ERC4626Adapter {
    constructor(IERC4626 _erc4626, uint256 _feePct, address _feeCollector, address owner)
        ERC4626Adapter(_erc4626, _feePct, _feeCollector, owner)
    {}

    function pendingFeesInShareValue() external view returns (uint256) {
        return _pendingFeesInShareValue();
    }
}
