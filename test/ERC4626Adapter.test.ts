import {
  assertAlmostEqual,
  assertEvent,
  deploy,
  deployTokenMock,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

describe('ERC4626 Adapter', () => {
  let token: Contract, erc4626Mock: Contract, erc4626Adapter: Contract
  let owner: SignerWithAddress, other: SignerWithAddress, collector: SignerWithAddress

  const fee = fp(0.1)

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, collector] = await getSigners()
  })

  before('create token and erc4626', async () => {
    token = await deployTokenMock('TKN')
    erc4626Mock = await deploy('ERC4626Mock', [token.address])
  })

  before('create erc4626 adapter', async () => {
    erc4626Adapter = await deploy('ERC4626Adapter', [erc4626Mock.address, fee, collector.address, owner.address])
  })

  describe('initialization', async () => {
    context('when the fee percentage is below 1', () => {
      it('sets the ERC4626 reference correctly', async () => {
        expect(await erc4626Adapter.erc4626()).to.be.equal(erc4626Mock.address)
      })

      it('sets the fee correctly', async () => {
        expect(await erc4626Adapter.feePct()).to.be.equal(fee)
      })

      it('sets the collector correctly', async () => {
        expect(await erc4626Adapter.feeCollector()).to.be.equal(collector.address)
      })

      it('inherits decimals from asset', async function () {
        expect(await erc4626Adapter.decimals()).to.be.equal(await token.decimals())
      })
    })

    context('when the fee percentage is above 1', () => {
      const newFeePct = fp(1.01)

      it('reverts', async () => {
        await expect(
          deploy('ERC4626Adapter', [erc4626Mock.address, newFeePct, ZERO_ADDRESS, ZERO_ADDRESS])
        ).to.be.revertedWith('FeePctAboveOne')
      })
    })
  })

  describe('setFeeCollector', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        erc4626Adapter = erc4626Adapter.connect(owner)
      })

      context('when the new collector is not zero', () => {
        const newCollector = '0x0000000000000000000000000000000000000001'

        it('sets the fee collector', async () => {
          const tx = await erc4626Adapter.setFeeCollector(newCollector)

          await assertEvent(tx, 'FeeCollectorSet', { collector: newCollector })

          expect(await erc4626Adapter.feeCollector()).to.be.equal(newCollector)
        })
      })

      context('when the new collector is the address zero', () => {
        const newCollector = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(erc4626Adapter.setFeeCollector(newCollector)).to.be.revertedWith('CollectorZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        erc4626Adapter = erc4626Adapter.connect(other)
      })

      it('reverts', async () => {
        await expect(erc4626Adapter.setFeeCollector(ZERO_ADDRESS)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('setFeePct', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        erc4626Adapter = erc4626Adapter.connect(owner)
      })

      context('when the new fee pct is below the previous one', () => {
        context('when the new fee pct is not zero', () => {
          const newFeePct = fee.sub(1)

          it('sets the fee percentage', async () => {
            const tx = await erc4626Adapter.setFeePct(newFeePct)

            await assertEvent(tx, 'FeePctSet', { pct: newFeePct })

            expect(await erc4626Adapter.feePct()).to.be.equal(newFeePct)
          })
        })

        context('when the new fee pct is zero', () => {
          const newFeePct = 0

          it('reverts', async () => {
            await expect(erc4626Adapter.setFeePct(newFeePct)).to.be.revertedWith('FeePctZero')
          })
        })
      })

      context('when the new fee pct is above the previous one', () => {
        const newFeePct = fee.add(1)

        it('reverts', async () => {
          await expect(erc4626Adapter.setFeePct(newFeePct)).to.be.revertedWith('FeePctAbovePrevious')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        erc4626Adapter = erc4626Adapter.connect(other)
      })

      it('reverts', async () => {
        await expect(erc4626Adapter.setFeePct(0)).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('integration', async () => {
    let userA: SignerWithAddress, userB: SignerWithAddress, userC: SignerWithAddress

    function checkStatus(status: {
      totalAssets: BigNumber
      shareValue: BigNumber
      userAShares: BigNumber
      userAAssets: BigNumber
      userBShares: BigNumber
      userBAssets: BigNumber
      userCShares: BigNumber
      userCAssets: BigNumber
      totalShares: BigNumber
      previousTotalAssets: BigNumber
    }) {
      const ERROR = 1e-18

      it('updates total assets correctly', async function () {
        const totalAssets = await erc4626Adapter.totalAssets()
        assertAlmostEqual(totalAssets, status.totalAssets, ERROR)
      })

      it('updates share value correctly', async function () {
        const actualShareValue = await erc4626Adapter.convertToAssets(fp(1))
        assertAlmostEqual(actualShareValue, status.shareValue, ERROR)
      })

      it('updates userA shares correctly', async function () {
        expect(await erc4626Adapter.balanceOf(userA.address)).to.be.equal(status.userAShares)
      })

      it('updates userA assets correctly', async function () {
        const userShares = await erc4626Adapter.balanceOf(userA.address)
        const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
        assertAlmostEqual(actualUserAssets, status.userAAssets, ERROR)
      })

      it('updates userB shares correctly', async function () {
        expect(await erc4626Adapter.balanceOf(userB.address)).to.be.equal(status.userBShares)
      })

      it('updates userB assets correctly', async function () {
        const userShares = await erc4626Adapter.balanceOf(userB.address)
        const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
        assertAlmostEqual(actualUserAssets, status.userBAssets, ERROR)
      })

      it('updates userC shares correctly', async function () {
        const userShares = await erc4626Adapter.balanceOf(userC.address)
        assertAlmostEqual(userShares, status.userCShares, ERROR)
      })

      it('updates userC assets correctly', async function () {
        const userShares = await erc4626Adapter.balanceOf(userC.address)
        const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
        assertAlmostEqual(actualUserAssets, status.userCAssets, ERROR)
      })

      it('updates total shares correctly', async function () {
        const actualTotalShares = await erc4626Adapter.totalSupply()
        assertAlmostEqual(actualTotalShares, status.totalShares, ERROR)
      })

      it('updates previous total assets correctly', async function () {
        const actualPreviousTotalAssets = await erc4626Adapter.previousTotalAssets()
        assertAlmostEqual(actualPreviousTotalAssets, status.previousTotalAssets, ERROR)
      })
    }

    before('setup signers', async () => {
      // eslint-disable-next-line prettier/prettier
      [, userA, userB, userC] = await getSigners()
    })

    before('create token and erc4626', async () => {
      token = await deployTokenMock('TKN')
      await token.mint(userA.address, fp(10000))
      await token.mint(userB.address, fp(10000))
      await token.mint(userC.address, fp(10000))
      erc4626Mock = await deploy('ERC4626Mock', [token.address])
    })

    before('create erc4626 adapter', async () => {
      erc4626Adapter = await deploy('ERC4626Adapter', [erc4626Mock.address, fee, userC.address, owner.address])
    })

    context('when userA deposits 100 assets', async () => {
      let totalAssets: BigNumber, shareValue: BigNumber, userAShares: BigNumber, userAAssets: BigNumber
      let userBShares: BigNumber, userBAssets: BigNumber, userCShares: BigNumber, userCAssets: BigNumber
      let totalShares: BigNumber, previousTotalAssets: BigNumber

      const amount = fp(100)

      const calculateUserAssets = (userShares: BigNumber) => {
        return userShares.mul(shareValue).div(fp(1))
      }

      before('deposit 100 assets for userA', async () => {
        await token.connect(userA).approve(erc4626Adapter.address, amount)
        await erc4626Adapter.connect(userA).deposit(amount, userA.address)
      })

      totalAssets = amount // 100
      shareValue = fp(1)
      userAShares = amount // 100
      userAAssets = amount // 100
      totalShares = amount // 100
      previousTotalAssets = amount // 100

      checkStatus({
        totalAssets,
        shareValue,
        userAShares,
        userAAssets,
        userBShares: fp(0),
        userBAssets: fp(0),
        userCShares: fp(0),
        userCAssets: fp(0),
        totalShares,
        previousTotalAssets,
      })

      context('when assets triplicate', async () => {
        const amount = fp(200)

        before('triplicate assets', async () => {
          await token.mint(erc4626Mock.address, amount)
        })

        totalAssets = totalAssets.add(amount) // 300
        shareValue = fp(2.8)
        userAAssets = calculateUserAssets(userAShares) // 280
        userCAssets = totalAssets.sub(previousTotalAssets).mul(fee).div(fp(1)) // 20
        userCShares = userCAssets.mul(fp(1)).div(shareValue) // 7.14
        ;(totalShares = totalShares.add(userCShares)), // 107.14
          checkStatus({
            totalAssets,
            shareValue,
            userAShares,
            userAAssets,
            userBShares: fp(0),
            userBAssets: fp(0),
            userCShares,
            userCAssets,
            totalShares,
            previousTotalAssets,
          })

        context('when userB deposits 30 assets', async () => {
          const amount = fp(30)

          before('deposit 30 assets for userB', async () => {
            await token.connect(userB).approve(erc4626Adapter.address, amount)
            await erc4626Adapter.connect(userB).deposit(amount, userB.address)
          })

          totalAssets = totalAssets.add(amount) // 330
          userBAssets = amount // 30
          userBShares = amount.mul(fp(1)).div(shareValue) // 10.714
          totalShares = totalShares.add(userBShares) // 117.854
          previousTotalAssets = totalAssets // 330

          checkStatus({
            totalAssets,
            shareValue,
            userAShares,
            userAAssets,
            userBShares,
            userBAssets,
            userCShares,
            userCAssets,
            totalShares,
            previousTotalAssets,
          })

          context('when assets duplicate', async () => {
            const amount = fp(330)

            before('duplicate assets', async () => {
              await token.mint(erc4626Mock.address, amount)
            })

            totalAssets = totalAssets.add(amount) // 660
            shareValue = fp(5.32)
            userAAssets = calculateUserAssets(userAShares) // 532
            userBAssets = calculateUserAssets(userBShares) // 57
            userCShares = userCShares.add(fp(33).mul(fp(1)).div(shareValue)) // 13.34
            userCAssets = calculateUserAssets(userCShares) // 71
            ;(totalShares = userAShares.add(userBShares).add(userCShares)), // 124.05
              checkStatus({
                totalAssets,
                shareValue,
                userAShares,
                userAAssets,
                userBShares,
                userBAssets,
                userCShares,
                userCAssets,
                totalShares,
                previousTotalAssets,
              })

            context('when userA withdraws 50 shares', async () => {
              const amount = fp(50)
              const assets = amount.mul(shareValue).div(fp(1))

              before('withdraw 50 shares for userA', async () => {
                await erc4626Adapter.connect(userA).redeem(amount, userA.address, userA.address)
              })

              totalAssets = totalAssets.sub(assets) // 394
              userAAssets = userAAssets.sub(assets) // 266
              userAShares = userAShares.sub(amount) // 50
              totalShares = totalShares.sub(amount) // 74.05
              previousTotalAssets = totalAssets // 394

              checkStatus({
                totalAssets,
                shareValue,
                userAShares,
                userAAssets,
                userBShares,
                userBAssets,
                userCShares,
                userCAssets,
                totalShares,
                previousTotalAssets,
              })
            })
          })
        })
      })
    })
  })
})
