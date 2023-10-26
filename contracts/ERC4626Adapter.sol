// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './interfaces/IERC4626Adapter.sol';

contract ERC4626Adapter is IERC4626Adapter, ERC4626 {
    using FixedPoint for uint256;

    IERC4626 private immutable erc4626;
    uint256 private immutable fee; //TODO: must be posible to reduce it
    address private immutable feeCollector; //TODO: must be posible to change it
    uint256 public override totalInvested;

    constructor(IERC4626 _erc4626, uint256 _fee, address _feeCollector)
        ERC20(IERC20Metadata(_erc4626.asset()).symbol(), IERC20Metadata(_erc4626.asset()).name())
        ERC4626(IERC20Metadata(_erc4626.asset()))
    {
        erc4626 = _erc4626;
        fee = _fee;
        feeCollector = _feeCollector;
    }

    function totalAssets() public view override(IERC4626, ERC4626) returns (uint256) {
        return erc4626.totalAssets();
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        _settleFees();

        super._deposit(caller, receiver, assets, shares);

        IERC20(erc4626.asset()).approve(address(erc4626), assets);
        erc4626.deposit(assets, address(this));

        totalInvested = totalAssets();
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        _settleFees();

        erc4626.withdraw(assets, address(this), address(this));

        super._withdraw(caller, receiver, owner, assets, shares);

        totalInvested = totalAssets();
    }

    function balanceOf(address account) public view override(IERC20, ERC20) returns (uint256) {
        if (account == feeCollector) {
            return super.balanceOf(account) + _pendingSharesFeeToCharge();
        }
        return super.balanceOf(account);
    }

    function totalSupply() public view override(IERC20, ERC20) returns (uint256) {
        return super.totalSupply() + _pendingSharesFeeToCharge();
    }

    function _pendingSharesFeeToCharge() private view returns (uint256) {
        uint256 _totalAssets = totalAssets();
        if (_totalAssets == 0 || totalInvested == 0) return 0; // TODO: or _totalAssets == totalInvested instead?
        uint256 pendingAssetsFeeToCharge = (_totalAssets - totalInvested).mulUp(fee);
        uint256 prevShareValue = (_totalAssets - pendingAssetsFeeToCharge).divDown(super.totalSupply());
        return pendingAssetsFeeToCharge.divUp(prevShareValue);
    }

    function _settleFees() private {
        _mint(feeCollector, _pendingSharesFeeToCharge());
    }
}
