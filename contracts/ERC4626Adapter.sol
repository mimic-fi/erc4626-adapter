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
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './interfaces/IERC4626Adapter.sol';

/**
 * @title ERC4626 adapter
 * @dev Adapter used to track the accounting of investments made through ERC4626 implementations
 */
contract ERC4626Adapter is IERC4626Adapter, ERC4626, Ownable, ReentrancyGuard {
    using FixedPoint for uint256;

    // Reference to the ERC4626 contract
    IERC4626 public immutable override erc4626;

    // Fee percentage
    uint256 public override feePct;

    // Fee collector
    address public override feeCollector;

    // Total amount of assets over which the fee has already been charged
    uint256 public override previousTotalAssets;

    /**
     * @dev Creates a new ERC4626 adapter contract
     * @param _erc4626 ERC4626 contract reference
     * @param _feePct Fee percentage to be set
     * @param _feeCollector Fee collector to be set
     * @param owner Address that will own the ERC4626 adapter
     */
    constructor(IERC4626 _erc4626, uint256 _feePct, address _feeCollector, address owner)
        ERC20(IERC20Metadata(_erc4626.asset()).symbol(), IERC20Metadata(_erc4626.asset()).name())
        ERC4626(IERC20Metadata(_erc4626.asset()))
    {
        erc4626 = _erc4626;
        _setFeePct(_feePct);
        _setFeeCollector(_feeCollector);
        _transferOwnership(owner);
    }

    /**
     * @dev Tells the total amount of assets
     */
    function totalAssets() public view override(IERC4626, ERC4626) returns (uint256) {
        return erc4626.convertToAssets(erc4626.balanceOf(address(this)));
    }

    /**
     * @dev Tells the maximum amount of assets that can be withdrawn from an owner balance
     */
    function maxWithdraw(address owner) public view virtual override(IERC4626, ERC4626) returns (uint256) {
        return Math.min(super.maxWithdraw(owner), erc4626.maxWithdraw(address(this)));
    }

    /**
     * @dev Tells the maximum amount of shares that can be redeemed from an owner balance
     */
    function maxRedeem(address owner) public view virtual override(IERC4626, ERC4626) returns (uint256) {
        return _convertToShares(maxWithdraw(owner), Math.Rounding.Down);
    }

    /**
     * @dev Deposits assets
     * @param assets Amount of assets to be deposited
     * @param receiver Address that will receive the shares
     *
     * Note: overrides the standard in order to add the `nonReentrant` modifier
     */
    function deposit(uint256 assets, address receiver)
        public
        override(IERC4626, ERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.deposit(assets, receiver);
    }

    /**
     * @dev Mints shares
     * @param shares Amount of shares to be minted
     * @param receiver Address that will receive the shares
     *
     * Note: overrides the standard in order to add the `nonReentrant` modifier
     */
    function mint(uint256 shares, address receiver) public override(IERC4626, ERC4626) nonReentrant returns (uint256) {
        return super.mint(shares, receiver);
    }

    /**
     * @dev Withdraws assets
     * @param assets Amount of assets to be withdrawn
     * @param receiver Address that will receive the assets
     * @param owner Address that owns the shares
     *
     * Note: overrides the standard in order to add the `nonReentrant` modifier
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override(IERC4626, ERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, owner);
    }

    /**
     * @dev Redeems shares
     * @param shares Amount of shares to be redeemed
     * @param receiver Address that will receive the assets
     * @param owner Address that owns the shares
     *
     * Note: overrides the standard in order to add the `nonReentrant` modifier
     */
    function redeem(uint256 shares, address receiver, address owner)
        public
        override(IERC4626, ERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.redeem(shares, receiver, owner);
    }

    /**
     * @dev Tells the total amount of shares
     */
    function totalSupply() public view override(IERC20, ERC20) returns (uint256) {
        return super.totalSupply() + _pendingFeesInShareValue();
    }

    /**
     * @dev Tells the amount of shares of an account
     */
    function balanceOf(address account) public view override(IERC20, ERC20) returns (uint256) {
        return super.balanceOf(account) + (account == feeCollector ? _pendingFeesInShareValue() : 0);
    }

    /**
     * @dev Sets the fee percentage
     * @param pct Fee percentage to be set
     */
    function setFeePct(uint256 pct) external override onlyOwner {
        _settleFees();
        previousTotalAssets = totalAssets();

        _setFeePct(pct);
    }

    /**
     * @dev Sets the fee collector
     * @param collector Fee collector to be set
     */
    function setFeeCollector(address collector) external override onlyOwner {
        _settleFees();
        previousTotalAssets = totalAssets();

        _setFeeCollector(collector);
    }

    /**
     * @dev Withdraw ERC20 tokens to an external account. To be used in order to withdraw claimed protocol rewards.
     * @param token Address of the token to be withdrawn
     * @param recipient Address where the tokens will be transferred to
     * @param amount Amount of tokens to withdraw
     */
    function rescueFunds(address token, address recipient, uint256 amount) external override onlyOwner {
        if (token == address(0)) revert ERC4626AdapterTokenZero();
        if (token == address(erc4626)) revert ERC4626AdapterTokenERC4626();
        if (recipient == address(0)) revert ERC4626AdapterRecipientZero();
        if (amount == 0) revert ERC4626AdapterAmountZero();

        ERC20Helpers.transfer(token, recipient, amount);
        emit FundsRescued(token, recipient, amount);
    }

    /**
     * @dev Deposits assets into an ERC4626 through the adapter
     * @param caller Address of the caller
     * @param receiver Address that will receive the shares
     * @param assets Amount of assets to be deposited
     * @param shares Amount of shares to be minted
     */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        _settleFees();

        super._deposit(caller, receiver, assets, shares);

        IERC20(erc4626.asset()).approve(address(erc4626), assets);
        erc4626.deposit(assets, address(this));

        previousTotalAssets = totalAssets();
    }

    /**
     * @dev Withdraws assets from an ERC4626 through the adapter
     * @param caller Address of the caller
     * @param receiver Address that will receive the assets
     * @param owner Address that owns the shares
     * @param assets Amount of assets to be withdrawn
     * @param shares Amount of shares to be redeemed
     */
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        _settleFees();

        erc4626.withdraw(assets, address(this), address(this));

        super._withdraw(caller, receiver, owner, assets, shares);

        previousTotalAssets = totalAssets();
    }

    /**
     * @dev Tells the fees in share value which have not been charged yet
     */
    function _pendingFeesInShareValue() internal view returns (uint256) {
        uint256 currentTotalAssets = totalAssets();

        // Note the following contemplates the scenario where there is no gain.
        // Including the case of loss, which might be due to the underlying implementation not working as expected.
        if (currentTotalAssets <= previousTotalAssets) return 0;
        uint256 pendingFees = (currentTotalAssets - previousTotalAssets).mulDown(feePct);

        // Note the following division uses `super.totalSupply` and not `totalSupply` (the overridden implementation).
        // This means the total supply does not contemplate the `pendingFees`.
        uint256 previousShareValue = (currentTotalAssets - pendingFees).divUp(super.totalSupply());

        return pendingFees.divDown(previousShareValue);
    }

    /**
     * @dev Settles the fees which have not been charged yet
     */
    function _settleFees() internal {
        uint256 feeAmount = _pendingFeesInShareValue();
        if (feeAmount == 0) return;
        _mint(feeCollector, feeAmount);
        emit FeesSettled(feeCollector, feeAmount);
    }

    /**
     * @dev Sets the fee percentage
     * @param newFeePct Fee percentage to be set
     */
    function _setFeePct(uint256 newFeePct) internal {
        if (newFeePct == 0) revert ERC4626AdapterFeePctZero();

        if (feePct == 0) {
            if (newFeePct >= FixedPoint.ONE) revert ERC4626AdapterFeePctAboveOne();
        } else {
            if (newFeePct >= feePct) revert ERC4626AdapterFeePctAbovePrevious(newFeePct, feePct);
        }

        feePct = newFeePct;
        emit FeePctSet(newFeePct);
    }

    /**
     * @dev Sets the fee collector
     * @param newFeeCollector Fee collector to be set
     */
    function _setFeeCollector(address newFeeCollector) internal {
        if (newFeeCollector == address(0)) revert ERC4626AdapterFeeCollectorZero();
        feeCollector = newFeeCollector;
        emit FeeCollectorSet(newFeeCollector);
    }
}
