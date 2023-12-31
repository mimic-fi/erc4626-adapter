import "./ZeroFees-MonotonicityInvariant.spec";

//Had to change _ERC20 to __ERC20 as of import that already declares _ERC20. 
using ERC20 as __ERC20;

//This is counter-intuitive: why we need to import invariants that should be loaded when calling safeAssumptions()? 
use invariant totalAssetsZeroImpliesTotalSupplyZero;
use invariant sumOfBalancesEqualsTotalSupplyERC20;
use invariant sumOfBalancesEqualsTotalSupplyERC4626Underlying;
use invariant sumOfBalancesEqualsTotalSupplyERC4626Adapter;
use invariant singleUserBalanceSmallerThanTotalSupplyERC20;
use invariant singleUserBalanceSmallerThanTotalSupplyERC4626Underlying;
use invariant singleUserBalanceSmallerThanTotalSupplyERC4626Adapter;
use invariant mirrorIsCorrectERC20;
use invariant mirrorIsCorrectERC4626Underlying;
use invariant mirrorIsCorrectERC4626Adapter;

methods {
    function __ERC20.balanceOf(address) external returns uint256 envfree;
    
    function balanceOf(address) external returns uint256 envfree;
    function previewDeposit(uint256) external returns uint256 envfree;
    function previewMint(uint256) external returns uint256 envfree;
    function previewRedeem(uint256) external returns uint256 envfree;
    function previewWithdraw(uint256) external returns uint256 envfree;
    function totalSupply() external returns uint256 envfree;
    function erc4626() external returns address envfree;
}

rule depositProperties(uint256 assets, address receiver, address user) {
    safeAssumptions();
    env e;
    //Not an assumption, but just creating an alias for e.msg.sender. Tryout if uint256 owver = e.msg.sender is a better choice here?
    require(e.msg.sender == user);

    //The caller may not be the currentContract. Is that a fair assumption? 
    //Not sure if solidity allows a way to to fake e.msg.sender attribute. (Delegate call, reflection,...?)
    require(user != /*currentContract*/ erc4626());
   
    mathint ownerAssetsBefore = __ERC20.balanceOf(user);
    mathint receiverSharesBefore = balanceOf(receiver);

    mathint previewShares = previewDeposit(assets);
    mathint shares = deposit(e, assets, receiver);

    mathint ownerAssetsAfter = __ERC20.balanceOf(user);
    mathint receiverSharesAfter = balanceOf(receiver);
    
    assert ownerAssetsAfter + assets == ownerAssetsBefore;
    assert receiverSharesAfter - shares == receiverSharesBefore;
    assert shares >= previewShares;
}

rule mintProperties(uint256 shares, address receiver, address user) {
    safeAssumptions();
    env e;
    require(e.msg.sender == user);

    //The caller may not be the currentContract. Is that a fair assumption? 
    //Not sure if solidity allows a way to to fake e.msg.sender attribute. (Delegate call, reflection,...?)
    require(user != /*currentContract*/ erc4626());
   
    mathint ownerAssetsBefore = __ERC20.balanceOf(user);
    mathint receiverSharesBefore = balanceOf(receiver);

    mathint previewAssets = previewMint(shares);
    mathint assets = mint(e, shares, receiver);

    mathint ownerAssetsAfter = __ERC20.balanceOf(user);
    mathint receiverSharesAfter = balanceOf(receiver);
    
    assert ownerAssetsAfter + assets == ownerAssetsBefore;
    assert receiverSharesAfter - shares == receiverSharesBefore;
    assert assets <= previewAssets;
}

rule withdrawProperties(uint256 assets, address receiver, address user) {
    safeAssumptions();
    env e;

    //The caller may not be the currentContract. Is that a fair assumption? 
    //Not sure if solidity allows a way to to fake e.msg.sender attribute. (Delegate call, reflection,...?)
    require(e.msg.sender != currentContract);

    mathint ownerSharesBefore = balanceOf(user);
    mathint receiverAssetsBefore = __ERC20.balanceOf(receiver);

    mathint previewShares = previewWithdraw(assets);
    mathint shares = withdraw(e, assets, receiver, user);

    mathint ownerSharesAfter = balanceOf(user);
    mathint receiverAssetsAfter = __ERC20.balanceOf(receiver);

    assert ownerSharesAfter + shares == ownerSharesBefore;
    assert receiver != /*currentContract*/ erc4626() => receiverAssetsAfter - assets == receiverAssetsBefore;

    //Is this according to specifications or a bug? Couldn't find a clear answer to it. Probably yes, receiverAssets remain unchanged, at least don't increase.
    assert receiver == /*currentContract*/ erc4626() => receiverAssetsAfter == receiverAssetsBefore;

    assert shares <= previewShares;
}

rule redeemProperties(uint256 shares, address receiver, address user) {
    safeAssumptions();
    env e;

    //The caller may not be the currentContract. Is that a fair assumption? 
    //Not sure if solidity allows a way to to fake e.msg.sender attribute. (Delegate call, reflection,...?)
    require(e.msg.sender != currentContract);

    mathint ownerSharesBefore = balanceOf(user);
    mathint receiverAssetsBefore = __ERC20.balanceOf(receiver);

    mathint previewAssets = previewRedeem(shares);
    mathint assets = redeem(e, shares, receiver, user);

    mathint ownerSharesAfter = balanceOf(user);
    mathint receiverAssetsAfter = __ERC20.balanceOf(receiver);
    
    assert ownerSharesAfter + shares == ownerSharesBefore;
    assert receiver != /*currentContract*/ erc4626() => receiverAssetsAfter - assets == receiverAssetsBefore;

    //Is this according to specifications or a bug? Couldn't find a clear answer to it. Probably yes, receiverAssets remain unchanged, at least don't increase.
    assert receiver == /*currentContract*/ erc4626() => receiverAssetsAfter == receiverAssetsBefore;

    assert assets >= previewAssets;
}
