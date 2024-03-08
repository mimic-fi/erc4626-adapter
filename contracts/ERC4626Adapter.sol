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

    // ERC20 name prefix
    string private constant NAME_PREFIX = 'ERC4626 Adapter';

    // ERC20 symbol prefix
    string private constant SYMBOL_PREFIX = 'erc4626adapter';

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
        ERC20(
            string.concat(NAME_PREFIX, IERC20Metadata(_erc4626.asset()).name()),
            string.concat(SYMBOL_PREFIX, IERC20Metadata(_erc4626.asset()).symbol())
        )
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
     * @dev Tells the total amount of shares
     */
    function totalSupply() public view override(IERC20, ERC20) returns (uint256) {
        return super.totalSupply() + pendingFeesInShares();
    }

    /**
     * @dev Tells the amount of shares of an account
     */
    function balanceOf(address account) public view override(IERC20, ERC20) returns (uint256) {
        return super.balanceOf(account) + (account == feeCollector ? pendingFeesInShares() : 0);
    }

    /**
     * @dev Tells the maximum amount of assets that can be withdrawn from an account balance
     */
    function maxWithdraw(address account) public view virtual override(IERC4626, ERC4626) returns (uint256) {
        return Math.min(super.maxWithdraw(account), erc4626.maxWithdraw(address(this)));
    }

    /**
     * @dev Tells the maximum amount of shares that can be redeemed from an account balance
     */
    function maxRedeem(address account) public view virtual override(IERC4626, ERC4626) returns (uint256) {
        return _convertToShares(maxWithdraw(account), Math.Rounding.Down);
    }

    /**
     * @dev Tells the fees in share value which have not been charged yet
     *
     * Explanation of how the fees are calculated:
     *
     * We will call the adapter total supply `S` and the underlying total assets `A`. If the assets increase by some
     * amount `D`, the contract then collects a fee as a factor `f` of this increment. For example, if the are 200 new
     * assets and the fee is 30%, then `D = 200`, `f = 0.3`, and the fee collector should own `D * f = 60`
     * assets, regardless of the initial adapter supply `S` or amount of assets `A`.
     *
     * Notably, the fee collector is not sent these assets, but rather new adapter tokens `M` are minted for them,
     * dilluting the value of all other adapter tokens. After minting, the adapter supply will be `S + M`, with `M / (S + M)`
     * being the share of the underlying assets that corresponds to the newly minted tokens for the fee collector.
     *
     * Accordingly, we've stablished that the fee collector is also due `D * f` assets, with `D * f / (A + D)`
     * being the share these represent of the total underlying assets.
     *
     * Therefore: `M / (S + M) = D * f / (A + D)`
     * Solving for `M`: `M = (S * D * f / (A + D)) / (1 - D * f / (A + D))`
     *
     * The code uses slightly different variables, with `currentTotalAssets = A + D`, `previousTotalAssets = A`, `feePct = f`,
     * `super.totalSupply = S`, and the return value being `M`. Therefore, `pendingFees = D * f`. Using these replacements,
     * the calculation found in the implementation can be written as: `M = (D * f) / ((A + D - D * f) / S)`.
     * This expression is equivalent to the one derived above.
     *
     * In a numerical example, consider the initial adapter supply `S = 100`, the initial total assets `A = 500`, and
     * the delta and fees previously mentioned of `D = 200` and `f = 0.3`. The fee collector is therefore due 60
     * assets, or ~8.57% of the total 700 assets. So, 9.375 adapter tokens will be minted for them, and the ownership
     * percentage of the adapter is then 9.375 / 109.375, which yields the correct value of ~8.57%.
     */
    function pendingFeesInShares() public view returns (uint256) {
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
     * @param account Address of the account that owns the shares
     *
     * Note: overrides the standard in order to add the `nonReentrant` modifier
     */
    function withdraw(uint256 assets, address receiver, address account)
        public
        override(IERC4626, ERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, account);
    }

    /**
     * @dev Redeems shares
     * @param shares Amount of shares to be redeemed
     * @param receiver Address that will receive the assets
     * @param account Address of the account that owns the shares
     *
     * Note: overrides the standard in order to add the `nonReentrant` modifier
     */
    function redeem(uint256 shares, address receiver, address account)
        public
        override(IERC4626, ERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.redeem(shares, receiver, account);
    }

    /**
     * @dev Sets the fee percentage. Note it cannot be increased.
     * @param pct Fee percentage to be set
     *
     * Note setting `previousTotalAssets` to `totalAssets()` is not done immediately after calling `_settleFees()`.
     * However, this is still safe due to the usage of the `nonReentrant` modifier.
     */
    function setFeePct(uint256 pct) external override onlyOwner nonReentrant {
        _settleFees();
        _setFeePct(pct);
        previousTotalAssets = totalAssets();
    }

    /**
     * @dev Sets the fee collector
     * @param collector Fee collector to be set
     *
     * Note setting `previousTotalAssets` to `totalAssets()` is not done immediately after calling `_settleFees()`.
     * However, this is still safe due to the usage of the `nonReentrant` modifier.
     */
    function setFeeCollector(address collector) external override onlyOwner nonReentrant {
        _settleFees();
        _setFeeCollector(collector);
        previousTotalAssets = totalAssets();
    }

    /**
     * @dev Withdraws ERC20 or native tokens to an external account. To be used in order to withdraw claimed protocol rewards.
     * @param token Address of the token to be withdrawn
     * @param recipient Address where the tokens will be transferred to
     * @param amount Amount of tokens to withdraw
     */
    function rescueFunds(address token, address recipient, uint256 amount) external override onlyOwner nonReentrant {
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
     *
     * WARNING: FUNCTIONS CALLING `_deposit` MUST USE THE `nonReentrant` MODIFIER
     *
     * Note setting `previousTotalAssets` to `totalAssets()` is not done immediately after calling `_settleFees()` because `erc4626.deposit()`
     * should be called first as it affects `totalAssets()` return value. However, not doing this two-step process atomically
     * is still safe due to the usage of the `nonReentrant` modifier in the calling functions (`deposit` and `mint`).
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
     * @param account Address of the account that owns the shares
     * @param assets Amount of assets to be withdrawn
     * @param shares Amount of shares to be redeemed
     *
     * WARNING: FUNCTIONS CALLING `_withdraw` MUST USE THE `nonReentrant` MODIFIER
     *
     * Note setting `previousTotalAssets` to `totalAssets()` is not done immediately after calling `_settleFees()` because `erc4626.withdraw()`
     * should be called first as it affects `totalAssets()` return value. However, not doing this two-step process atomically
     * is still safe due to the usage of the `nonReentrant` modifier in the calling functions (`withdraw` and `redeem`).
     */
    function _withdraw(address caller, address receiver, address account, uint256 assets, uint256 shares)
        internal
        override
    {
        _settleFees();

        erc4626.withdraw(assets, address(this), address(this));
        super._withdraw(caller, receiver, account, assets, shares);

        previousTotalAssets = totalAssets();
    }

    /**
     * @dev Settles the fees which have not been charged yet.
     *
     * WARNING: AFTER CALLING THIS FUNCTION `previousTotalAssets` MUST BE SET TO `totalAssets()`. IDEALLY, IN THE FOLLOWING LINE.
     * NOTE IT MIGHT BE UNSAFE TO PERFORM THIS TWO-STEP PROCESS NON-ATOMICALLY.
     */
    function _settleFees() internal {
        uint256 feeAmount = pendingFeesInShares();
        if (feeAmount == 0) return;
        _mint(feeCollector, feeAmount);
        emit FeesSettled(feeCollector, feeAmount);
    }

    /**
     * @dev Sets the fee percentage. Note it cannot be increased.
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
