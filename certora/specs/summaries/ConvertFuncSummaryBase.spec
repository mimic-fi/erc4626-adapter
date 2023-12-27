import "./ConvertFuncSummary.spec";

methods {
    // Replace need for ERC4626Simple with CVL summaries
    function convertToShares(uint256 assets) external returns(uint256) => convertToShares_summary(assets, Math.Rounding.Down);
    function convertToAssets(uint256 shares) external returns(uint256) => convertToAssets_summary(shares, Math.Rounding.Down);
    
    function previewWithdraw(uint256 assets) external returns(uint256) => convertToShares_summary(assets, Math.Rounding.Up);
    function previewMint(uint256 shares) external returns(uint256) => convertToShares_summary(shares, Math.Rounding.Up);

    function previewRedeem(uint256 shares) external returns(uint256) => convertToShares_summary(shares, Math.Rounding.Up);
    function previewDeposit(uint256 assets) external returns(uint256) => convertToShares_summary(assets, Math.Rounding.Up);
}