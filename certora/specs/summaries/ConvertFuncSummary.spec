methods {
    function totalSupply() external returns (uint256) envfree; 

    function ERC4626._convertToShares(uint256 assets, Math.Rounding rounding ) internal returns (uint256) => convertToShares_summary(assets, rounding);
    function ERC4626._convertToAssets(uint256 shares, Math.Rounding rounding ) internal returns (uint256) => convertToAssets_summary(shares, rounding);
}

/**
assuming a fix ratio of totalSupply to totalAssets (3 : 5) 
This is a simplification but capture the essense of shares to assets:
* rounding 
* zero handling   
*/

function convertToShares_summary(uint256 assets, Math.Rounding rounding) returns uint256 {
    if (totalSupply() == 0) {
        return 0;
    }
    // todo - need to handle zero case, maybe also changing ratio ? 
    if (rounding == Math.Rounding.Down) {
        return  require_uint256(assets * 3 / 5);
    } else if (rounding == Math.Rounding.Up) {
        return  require_uint256(((assets * 3) + 5 - 1) / 5);
    } else {
        assert false;
        return 0;
    }
}

function convertToAssets_summary(uint256 shares, Math.Rounding rounding) returns uint256 {
    if (totalSupply() == 0) {
        return 0;
    }
    if (rounding == Math.Rounding.Down) {
        return  require_uint256(shares * 5 / 3);
    } else if (rounding == Math.Rounding.Up) {
        return require_uint256(((shares * 5) + 3 - 1 ) / 3);
    } else {
        assert false;
        return 0;
    }
}
