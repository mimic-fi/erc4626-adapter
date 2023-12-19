## Content

The rules in this directory are divided into `zero-fees` and `with-fees`.

### Zero fees

The rules inside this folder were created from the ones in [this repository](https://github.com/johspaeth/tutorials-code/tree/johannes/erc4626-specs/lesson4_reading/erc4626), which is still in progress.

The idea is to prove that <i>if no fees are charged, then the adapter works as the standard ERC4626</i>. In other words, all rules that verify for the ERC4626 (in the repo mentioned above) should also verify for the ERC4626Adapter (in this repo).

To do so, we tried to make as few changes as possible to the base rules while requiring `pendingFeesInShareValue()` to be 0. These changes are mainly related to the fact that there are two different ERC4626 contracts in the scene.

There are only two rules that produce a different output than the ones in the base repository. These are `mintMustIncreaseTotalAssets` and `redeemMustDecreaseTotalAssets` in `ZeroFees-SecurityProps.spec` which timeout due to high complexity of `converToAssets()` and `convertToShares()` functions.

### With fees

The rules inside this folder were also created from the ones in [this repository](https://github.com/johspaeth/tutorials-code/tree/johannes/erc4626-specs/lesson4_reading/erc4626), which is still in progress.

Here, there are no restrictions on the value of `pendingFeesInShareValue()`.

Note we had to use a simplified version of the ERC4626 implementation and summaries for `converToAssets()` and `convertToShares()` because running the specs using the ones implemented in the contract resulted in timeouts. However, the aim is to remove the summaries in order to produce more general rules.
