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

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './interfaces/IERC4626Adapter.sol';

contract ERC4626Adapter is IERC4626Adapter, ERC4626, Ownable {
    using FixedPoint for uint256;

    // Reference to the ERC4626 contract
    IERC4626 public immutable override erc4626;

    // Fee percentage
    uint256 public override feePct;

    // Fee collector
    address public override feeCollector;

    // Total invested assets. This is the total amount of assets over which the fee has already been charged.
    uint256 public override totalInvested;

    constructor(IERC4626 _erc4626, uint256 _feePct, address _feeCollector)
        ERC20(IERC20Metadata(_erc4626.asset()).symbol(), IERC20Metadata(_erc4626.asset()).name())
        ERC4626(IERC20Metadata(_erc4626.asset()))
    {
        erc4626 = _erc4626;
        _setFeePct(_feePct);
        _setFeeCollector(_feeCollector);
    }

    function totalAssets() public view override(IERC4626, ERC4626) returns (uint256) {
        return erc4626.totalAssets();
    }

    function totalSupply() public view override(IERC20, ERC20) returns (uint256) {
        return super.totalSupply() + _pendingSharesFeeToCharge();
    }

    function balanceOf(address account) public view override(IERC20, ERC20) returns (uint256) {
        return super.balanceOf(account) + (account == feeCollector ? _pendingSharesFeeToCharge() : 0);
    }

    /**
     * @dev Sets the fee percentage
     * @param pct Fee percentage to be set
     */
    function setFeePct(uint256 pct) external override onlyOwner {
        _setFeePct(pct);
    }

    /**
     * @dev Sets the fee collector
     * @param collector Fee collector to be set
     */
    function setFeeCollector(address collector) external override onlyOwner {
        _setFeeCollector(collector);
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

    function _pendingSharesFeeToCharge() private view returns (uint256) {
        uint256 _totalAssets = totalAssets();
        if (_totalAssets == totalInvested) return 0;
        uint256 pendingAssetsFeeToCharge = (_totalAssets - totalInvested).mulUp(feePct);
        uint256 prevShareValue = (_totalAssets - pendingAssetsFeeToCharge).divDown(super.totalSupply());
        return pendingAssetsFeeToCharge.divUp(prevShareValue);
    }

    function _settleFees() private {
        _mint(feeCollector, _pendingSharesFeeToCharge());
    }

    /**
     * @dev Sets the fee percentage
     * @param pct Fee percentage to be set
     */
    function _setFeePct(uint256 pct) private {
        if (pct == 0) revert FeePctZero();

        if (feePct == 0) {
            if (pct >= FixedPoint.ONE) revert FeePctAboveOne();
        } else {
            if (pct >= feePct) revert FeePctAbovePrevious(pct, feePct);
        }

        feePct = pct;
        emit FeePctSet(pct);
    }

    /**
     * @dev Sets the fee collector
     * @param collector Fee collector to be set
     */
    function _setFeeCollector(address collector) private {
        if (collector == address(0)) revert FeeCollectorZero();
        feeCollector = collector;
        emit FeeCollectorSet(collector);
    }
}
