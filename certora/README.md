## Content

The rules inside this directory were created from the ones in [this repository](https://github.com/johspaeth/tutorials-code/tree/johannes/erc4626-specs/lesson4_reading/erc4626), which is still in progress. Find below the corresponding runs:

1. [FunctionalAccountingProps](https://prover.certora.com/output/30349/7e652d4dd78542ed8778e9c896a550ee/?anonymousKey=94383a4f97bf562c64032f731fbd4a1392c4a841)
2. [MonotonicityInvariant](https://prover.certora.com/output/30349/7ff50dbca0ab4d118bfa8173fad3c12f/?anonymousKey=70b9c505554552ea1e3493615337fd1ded12658b)
3. [MustNotRevertProps](https://prover.certora.com/output/30349/dfa34c35500841c5b4d6fb9d7234b9c1/?anonymousKey=44c856786a44a0078380ceac152f37057548b20f)
4. [RedeemUsingApprovalProps](https://prover.certora.com/output/30349/d0026b798a55490fa9bc4fef1790d8bf/?anonymousKey=153527da4eee0353256f4f601aa094da98680ef1)
5. [RoundingProps](https://prover.certora.com/output/30349/d183a8ebf57f46339a87c5decc649427/?anonymousKey=8ba4738a387cd345ff2d8a1c1c67df54b848f1a9)
6. [SecurityProps](https://prover.certora.com/output/30349/c8a1bf79ae3c4bc38cb21fd1d3f53fb4/?anonymousKey=444d2d568fbe044b2c7939dc3164090cbb1e1a81)

The modified rules for the ERC4626Adapter inside this directory are divided into `zero-fees` and `with-fees`.

### Zero fees

The idea is to prove that <i>if no fees are charged, then the adapter works as the standard ERC4626</i>. In other words, all rules that verify for the ERC4626 (in the repo mentioned above) should also verify for the ERC4626Adapter (in this repo).

To do so, we tried to make as few changes as possible to the base rules while requiring `pendingFeesInShareValue()` to be 0. These changes are mainly related to the fact that there are two different ERC4626 contracts in the scene.

There are only two rules that produce a different output than the ones in the base repository. These are `mintMustIncreaseTotalAssets` and `redeemMustDecreaseTotalAssets` in `ZeroFees-SecurityProps.spec` which timeout due to high complexity of `converToAssets()` and `convertToShares()` functions.

### With fees

For the rules in this folder, there are no restrictions on the value of `pendingFeesInShareValue()`.

Note we had to use a simplified version of the ERC4626 implementation and summaries for `converToAssets()` and `convertToShares()` because running the specs using the ones implemented in the contract resulted in timeouts. However, the aim is to remove the summaries in order to produce more general rules.
