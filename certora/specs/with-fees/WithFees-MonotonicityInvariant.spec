import "../summaries/MulDivSummary.spec";
import "../summaries/ConvertFuncSummary.spec";

using ERC20 as _ERC20;
using ERC4626Simple as ERC4626;

methods {
    function totalSupply() external returns uint256 envfree;
    function balanceOf(address) external returns uint256 envfree;
    function allowance(address, address) external returns uint256 envfree;
    function totalAssets() external returns uint256 envfree;
    function previewMint(uint256) external returns uint256 envfree;
    function previewWithdraw(uint256) external returns uint256 envfree;
    function previewDeposit(uint256) external returns uint256 envfree;
    function previewRedeem(uint256) external returns uint256 envfree;
    function pendingFeesInShareValue() external returns uint256 envfree;
    function feeCollector() external returns address envfree;
    function convertToAssets(uint256) external returns uint256 envfree;
 
    function _ERC20.totalSupply() external returns uint256 envfree;
    function _ERC20.balanceOf(address) external returns uint256 envfree;

    function _.transfer(address, uint256) external => DISPATCHER(true);

    function ERC4626.balanceOf(address) external returns uint256 envfree;
    function ERC4626.totalSupply() external returns uint256 envfree;
    function ERC4626.totalAssets() external returns uint256 envfree;
}

function safeAssumptions() {
    requireInvariant sumOfBalancesEqualsTotalSupplyERC20;
    requireInvariant sumOfBalancesEqualsTotalSupplyERC4626Adapter;
    requireInvariant sumOfBalancesEqualsTotalSupplyERC4626Underlying;
    requireInvariant singleUserBalanceSmallerThanTotalSupplyERC20;
    requireInvariant singleUserBalanceSmallerThanTotalSupplyERC4626Adapter;
    requireInvariant singleUserBalanceSmallerThanTotalSupplyERC4626Underlying;
}

function balaceMirrorsAreCorrect(address x) {
    requireInvariant mirrorIsCorrectERC20(x);
    requireInvariant mirrorIsCorrectERC4626Adapter(x);
    requireInvariant mirrorIsCorrectERC4626Underlying(x);
}

function safeAssumptionsERC20() {
    requireInvariant sumOfBalancesEqualsTotalSupplyERC20;
    requireInvariant singleUserBalanceSmallerThanTotalSupplyERC20;
}

rule assetAndShareMonotonicy() {
    safeAssumptions();
    uint256 totalAssetsBefore = totalAssets();
    uint256 totalSupplyBefore = totalSupply();

    method f;
    env e;
    uint256 amount;
    address receiver;
    address owner;
    if(f.selector == sig:mint(uint,address).selector){
        mint(e, amount, receiver);
    } else if(f.selector == sig:withdraw(uint,address,address).selector){
        withdraw(e, amount, receiver, owner);
    } else if(f.selector == sig:deposit(uint,address).selector){
        deposit(e, amount, receiver);
    } else if(f.selector == sig:redeem(uint,address,address).selector){
        redeem(e, amount, receiver, owner);
    } else {
        calldataarg args;
        f(e,args);
    }
    
    uint256 totalAssetsAfter = totalAssets();
    uint256 totalSupplyAfter = totalSupply();

    require(e.msg.sender != currentContract);
    assert totalSupplyBefore < totalSupplyAfter <=> totalAssetsBefore < totalAssetsAfter , "Strong monotonicity doesn't hold."; 
    assert (receiver != currentContract) => (totalAssetsBefore <= totalAssetsAfter <=> totalSupplyBefore <= totalSupplyAfter), "Monotonicity doesn't hold."; 
}

/**
* This invariant does not hold for OpenZeppelin. There is a public function mint that allows to increase totalSupply without increasing totalAssets! 
*/
invariant totalAssetsZeroImpliesTotalSupplyZero()
    // totalAssets() == 0 => totalSupply() == 0
    // totalAssets() >= totalSupply()
    totalAssets() >= convertToAssets(totalSupply())
{
    preserved {
        requireInvariant sumOfBalancesEqualsTotalSupplyERC20;
        requireInvariant sumOfBalancesEqualsTotalSupplyERC4626Adapter;
        requireInvariant sumOfBalancesEqualsTotalSupplyERC4626Underlying;
        requireInvariant singleUserBalanceSmallerThanTotalSupplyERC20;
        requireInvariant singleUserBalanceSmallerThanTotalSupplyERC4626Adapter;
        requireInvariant singleUserBalanceSmallerThanTotalSupplyERC4626Underlying;
    }
}

invariant sumOfBalancesEqualsTotalSupplyERC20()
    sumOfBalancesERC20 == to_mathint(_ERC20.totalSupply());

ghost mathint sumOfBalancesERC20 {
    init_state axiom sumOfBalancesERC20 == 0;
}

hook Sstore _ERC20._balances[KEY address user] uint256 newValue (uint256 oldValue) STORAGE {
    sumOfBalancesERC20 = sumOfBalancesERC20 + newValue - oldValue;
    userBalanceERC20 = newValue;
    balanceOfMirroredERC20[user] = newValue;
}

hook Sload uint256 value _ERC20._balances[KEY address user] STORAGE {
    //This line makes the proof work. But is this actually safe to assume? With every load in the programm, we assume the invariant to already hold.
    require to_mathint(value) <= sumOfBalancesERC20;
    require value == balanceOfMirroredERC20[user];
}

invariant sumOfBalancesEqualsTotalSupplyERC4626Adapter()
    sumOfBalancesERC4626Adapter == totalSupply() - pendingFeesInShareValue();

ghost mathint sumOfBalancesERC4626Adapter {
    init_state axiom sumOfBalancesERC4626Adapter == 0;
}

hook Sstore currentContract._balances[KEY address user] uint256 newValue (uint256 oldValue) STORAGE {
    sumOfBalancesERC4626Adapter = sumOfBalancesERC4626Adapter + newValue - oldValue;
    userBalanceERC4626Adapter = newValue;
    balanceOfMirroredERC4626Adapter[user] = newValue;
}

hook Sload uint256 value currentContract._balances[KEY address user] STORAGE {
    //This line makes the proof work. But is this actually safe to assume? With every load in the programm, we assume the invariant to hold.
    require to_mathint(value) <= sumOfBalancesERC4626Adapter;
    require value == balanceOfMirroredERC4626Adapter[user];
}

// We have to do the same for the underlying ERC4626 contract
invariant sumOfBalancesEqualsTotalSupplyERC4626Underlying()
    sumOfBalancesERC4626Underlying == to_mathint(ERC4626.totalSupply());

ghost mathint sumOfBalancesERC4626Underlying {
    init_state axiom sumOfBalancesERC4626Underlying == 0;
}

hook Sstore ERC4626._balances[KEY address user] uint256 newValue (uint256 oldValue) STORAGE {
    sumOfBalancesERC4626Underlying = sumOfBalancesERC4626Underlying + newValue - oldValue;
    userBalanceERC4626Underlying = newValue;
    balanceOfMirroredERC4626Underlying[user] = newValue;
}

hook Sload uint256 value ERC4626._balances[KEY address user] STORAGE {
    //This line makes the proof work. But is this actually safe to assume? With every load in the programm, we assume the invariant to hold.
    require to_mathint(value) <= sumOfBalancesERC4626Underlying;
    require value == balanceOfMirroredERC4626Underlying[user];
}

invariant singleUserBalanceSmallerThanTotalSupplyERC20()
    userBalanceERC20 <= sumOfBalancesERC20;

ghost mathint userBalanceERC20 {
    init_state axiom userBalanceERC20 == 0;
}

invariant singleUserBalanceSmallerThanTotalSupplyERC4626Adapter()
    userBalanceERC4626Adapter <= sumOfBalancesERC4626Adapter;

ghost mathint userBalanceERC4626Adapter {
    init_state axiom userBalanceERC4626Adapter == 0;
}

invariant singleUserBalanceSmallerThanTotalSupplyERC4626Underlying()
    userBalanceERC4626Underlying <= sumOfBalancesERC4626Underlying;

ghost mathint userBalanceERC4626Underlying {
    init_state axiom userBalanceERC4626Underlying == 0;
}

ghost mapping(address => uint256) balanceOfMirroredERC20 {
    init_state axiom forall address a. (balanceOfMirroredERC20[a] == 0);
}

ghost mapping(address => uint256) balanceOfMirroredERC4626Adapter {
    init_state axiom forall address a. (balanceOfMirroredERC4626Adapter[a] == 0);
}

ghost mapping(address => uint256) balanceOfMirroredERC4626Underlying {
    init_state axiom forall address a. (balanceOfMirroredERC4626Underlying[a] == 0);
}

invariant mirrorIsCorrectERC20(address x)
    balanceOfMirroredERC20[x] == _ERC20.balanceOf(x);


invariant mirrorIsCorrectERC4626Adapter(address x)
    to_mathint(balanceOfMirroredERC4626Adapter[x]) == balanceOf(x) - (x == feeCollector() ? pendingFeesInShareValue() : 0);

invariant mirrorIsCorrectERC4626Underlying(address x)
    balanceOfMirroredERC4626Underlying[x] == ERC4626.balanceOf(x);
