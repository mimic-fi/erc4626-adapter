methods {
    // this is for modular verification. we need to prove the pendingFeesInShares and _settleFees are correct and are called when needed
    // and then prove properties assuming settleFees has been called 
    function ERC4626Adapter.pendingFeesInShares() internal returns (uint256) => ALWAYS(0);
}
