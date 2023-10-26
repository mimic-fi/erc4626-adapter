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

import '@openzeppelin/contracts/interfaces/IERC4626.sol';

interface IERC4626Adapter is IERC4626 {
    /**
     * @dev The requested percentage to be set is zero
     */
    error FeePctZero();

    /**
     * @dev The requested collector to be set is zero
     */
    error FeeCollectorZero();

    /**
     * @dev The requested percentage to be set is above one
     */
    error FeePctAboveOne();

    /**
     * @dev The requested percentage to be set is above the previous percentage set
     */
    error FeePctAbovePrevious(uint256 requestedPct, uint256 previousPct);

    /**
     * @dev Emitted every time the fee percentage is set
     */
    event FeePctSet(uint256 pct);

    /**
     * @dev Emitted every time the fee collector is set
     */
    event FeeCollectorSet(address collector);

    /**
     * @dev Tells the reference to the ERC4626 contract
     */
    function erc4626() external view returns (IERC4626);

    /**
     * @dev Tells the fee percentage
     */
    function feePct() external view returns (uint256);

    /**
     * @dev Tells the fee collector
     */
    function feeCollector() external view returns (address);

    /**
     * @dev Tells the total invested assets. This is the total amount of assets over which the fee has already been charged.
     */
    function totalInvested() external view returns (uint256);

    /**
     * @dev Sets the fee percentage
     * @param pct Fee percentage to be set
     */
    function setFeePct(uint256 pct) external;

    /**
     * @dev Sets the fee collector
     * @param collector Fee collector to be set
     */
    function setFeeCollector(address collector) external;
}
