import "./ZeroFees-SecurityProps.spec";
import "../summaries/ConvertFuncSummaryBase.spec";

use invariant totalAssetsZeroImpliesTotalSupplyZero;
use invariant sumOfBalancesEqualsTotalSupplyERC20;
use invariant sumOfBalancesEqualsTotalSupplyERC4626Adapter;
use invariant sumOfBalancesEqualsTotalSupplyERC4626Underlying;
use invariant singleUserBalanceSmallerThanTotalSupplyERC20;
use invariant singleUserBalanceSmallerThanTotalSupplyERC4626Adapter;
use invariant singleUserBalanceSmallerThanTotalSupplyERC4626Underlying;
use invariant mirrorIsCorrectERC20;
use invariant mirrorIsCorrectERC4626Adapter;
use invariant mirrorIsCorrectERC4626Underlying;
use invariant convertInteg1;
use invariant convertInteg2;

//redeem must decrease totalAssets
rule redeemMustDecreaseTotalAssets(uint256 shares, address receiver, address user) {
    safeAssumptions();

    uint256 totalAssetsBefore = totalAssets();
    env e;
    redeem(e, shares, receiver, user);
    uint256 totalAssetsAfter = totalAssets();
    assert totalAssetsAfter <= totalAssetsBefore, "Total assets must decrease when redeem is called."; 
}

//mint must increase totalAssets
rule mintMustIncreaseTotalAssets(uint256 shares, address user) {
    safeAssumptions();

    uint256 totalAssetsBefore = totalAssets();
    env e;
    mint(e, shares, user);
    uint256 totalAssetsAfter = totalAssets();
    assert totalAssetsAfter >= totalAssetsBefore, "Total assets must increase when mint is called."; 
}