import "../summaries/MulDivSummary.spec";
import "../summaries/ZeroFeesSummary.spec";

using ERC20 as _ERC20;
using ERC4626 as _ERC4626;

methods {
    function allowance(address, address) external returns uint256 envfree;
    function balanceOf(address) external returns uint256 envfree;
    function previewWithdraw(uint256) external returns uint256 envfree;
    function previewRedeem(uint256) external returns uint256 envfree;
    function totalAssets() external returns uint256 envfree;

    function _ERC20.balanceOf(address) external returns uint256 envfree;

    function _ERC4626.convertToAssets(uint256) external returns uint256 envfree;
    function _ERC4626.balanceOf(address) external returns uint256 envfree;
}

/**
* Special case for when e.msg.sender == user.
* 1. Third party `withdraw()` calls must update the msg.sender's allowance
* 2. withdraw() must allow proxies to withdraw tokens on behalf of the user using share token approvals
* 3. Check that is doesn't revert. 
*/
rule ownerWithdrawal(uint256 assets, address receiver, address user) {
    env e; 
    require(e.msg.sender == user);

    uint256 allowanceBefore = allowance(user, e.msg.sender);
    withdraw@withrevert(e, assets, receiver, user);
    uint256 allowanceAfter = allowance(user, e.msg.sender);
    assert allowanceAfter == allowanceBefore;
    assert lastReverted == false;
}


//Third party `withdraw()` calls must update the msg.sender's allowance
//withdraw() must allow proxies to withdraw tokens on behalf of the user using share token approvals
rule thirdPartyWithdrawal(uint256 assets, address receiver, address user) {
    env e; 
    require(e.msg.sender != user);

    uint256 allowanceBefore = allowance(user, e.msg.sender);
    uint256 shares = previewWithdraw(assets);

    withdraw(e, assets, receiver, user);

    uint256 allowanceAfter = allowance(user, e.msg.sender);
    assert allowanceAfter <= allowanceBefore;
    assert shares <= allowanceBefore;
}

//Third parties must not be able to withdraw() tokens on an user's behalf without a token approval
rule thirdPartyWithdrawalRevertCase(uint256 assets, address receiver, address user) {
    env e; 
    uint256 allowanceBefore = allowance(user, e.msg.sender);
    uint256 shares = previewWithdraw(assets);
    
    require shares > allowanceBefore;
    //If e.msg.sender is the user, no allowance is required, see rule ownerWithdrawal
    require e.msg.sender != user;
        
    withdraw@withrevert(e, assets, receiver, user);
        
    bool withdrawReverted = lastReverted;

    assert withdrawReverted, "withdraw does not revert when no allowance provided.";
}

/**
* Special case for when e.msg.sender == user.
* 1. Third party `redeem()` calls must update the msg.sender's allowance
* 2. redeem() must allow proxies to redeem shares on behalf of the user using share token approvals
* 3. Check that is doesn't revert. 
*/
rule ownerRedeem(uint256 shares, address receiver, address user) {
    env e; 
    require(e.msg.sender == user);

    uint256 allowanceBefore = allowance(user, e.msg.sender);
    redeem@withrevert(e, shares, receiver, user);
    uint256 allowanceAfter = allowance(user, e.msg.sender);
    assert allowanceAfter == allowanceBefore;
    assert lastReverted == false;
}

//Third party `redeem()` calls must update the msg.sender's allowance
//redeem() must allow proxies to withdraw tokens on behalf of the user using share token approvals
rule thirdPartyRedeem(uint256 shares, address receiver, address user) {
    env e; 
    require(e.msg.sender != user);

    uint256 allowanceBefore = allowance(user, e.msg.sender);
    uint256 assets = previewRedeem(shares);

    redeem(e, shares, receiver, user);

    uint256 allowanceAfter = allowance(user, e.msg.sender);
    assert allowanceAfter <= allowanceBefore;
    assert shares <= allowanceBefore;
}

//Third parties must not be able to redeem() tokens on an user's behalf without a token approval
rule thirdPartyRedeemRevertCase(uint256 shares, address receiver, address user) {
    env e; 
    uint256 allowanceBefore = allowance(user, e.msg.sender);
    uint256 assets = previewRedeem(shares);
    
    require shares > allowanceBefore;
    //If e.msg.sender is the user, no allowance is required, see rule ownerWithdrawal
    require e.msg.sender != user;
        
    redeem@withrevert(e, shares, receiver, user);
        
    bool redeemReverted = lastReverted;

    assert redeemReverted, "redeem does not revert when no allowance provided.";
}

invariant balanceOfERC20EqualToTotalAsset()
    totalAssets() == _ERC4626.convertToAssets(_ERC4626.balanceOf(currentContract));
