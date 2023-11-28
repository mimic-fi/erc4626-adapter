import {
  assertAlmostEqual,
  assertEvent,
  bn,
  deploy,
  deployTokenMock,
  fp,
  getSigner,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, BigNumberish, Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

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

      it('inherits decimals from asset', async () => {
        expect(await erc4626Adapter.decimals()).to.be.equal(await token.decimals())
      })
    })

    context('when the fee percentage is above 1', () => {
      const newFeePct = fp(1.01)

      it('reverts', async () => {
        await expect(
          deploy('ERC4626Adapter', [erc4626Mock.address, newFeePct, ZERO_ADDRESS, ZERO_ADDRESS])
        ).to.be.revertedWith('ERC4626AdapterFeePctAboveOne')
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
            await expect(erc4626Adapter.setFeePct(newFeePct)).to.be.revertedWith('ERC4626AdapterFeePctZero')
          })
        })
      })

      context('when the new fee pct is above the previous one', () => {
        const newFeePct = fee.add(1)

        it('reverts', async () => {
          await expect(erc4626Adapter.setFeePct(newFeePct)).to.be.revertedWith('ERC4626AdapterFeePctAbovePrevious')
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

  describe('rescueFunds', () => {
    let recipient: SignerWithAddress

    const amount = fp(10)

    before('set recipient', async () => {
      recipient = await getSigner()
    })

    context('when the sender is allowed', () => {
      beforeEach('set sender', () => {
        erc4626Adapter = erc4626Adapter.connect(owner)
      })

      context('when the token is not the zero address', () => {
        context('when the token is not the underlying ERC4626', () => {
          let token: Contract

          before('deploy token', async () => {
            token = await deployTokenMock('TKN')
          })

          context('when the recipient is not the zero address', () => {
            context('when the amount is greater than zero', () => {
              context('when withdrawing ERC20 tokens', async () => {
                context('when the adapter has enough balance', async () => {
                  beforeEach('mint tokens', async () => {
                    await token.mint(erc4626Adapter.address, amount)
                  })

                  it('transfers the tokens to the recipient', async () => {
                    const previousAdapterBalance = await token.balanceOf(erc4626Adapter.address)
                    const previousRecipientBalance = await token.balanceOf(recipient.address)

                    await erc4626Adapter.rescueFunds(token.address, recipient.address, amount)

                    const currentAdapterBalance = await token.balanceOf(erc4626Adapter.address)
                    expect(currentAdapterBalance).to.be.equal(previousAdapterBalance.sub(amount))

                    const currentRecipientBalance = await token.balanceOf(recipient.address)
                    expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount))
                  })

                  it('emits an event', async () => {
                    const tx = await erc4626Adapter.rescueFunds(token.address, recipient.address, amount)

                    await assertEvent(tx, 'FundsRescued', {
                      token,
                      amount,
                      recipient,
                    })
                  })
                })

                context('when the adapter does not have enough balance', async () => {
                  it('reverts', async () => {
                    await expect(
                      erc4626Adapter.rescueFunds(token.address, recipient.address, amount)
                    ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
                  })
                })
              })

              context('when withdrawing native tokens', () => {
                const token = NATIVE_TOKEN_ADDRESS

                it('reverts', async () => {
                  await expect(erc4626Adapter.rescueFunds(token, recipient.address, amount)).to.be.revertedWith(
                    'Address: insufficient balance'
                  )
                })
              })
            })

            context('when the amount is zero', () => {
              const amount = 0

              it('reverts', async () => {
                await expect(erc4626Adapter.rescueFunds(token.address, recipient.address, amount)).to.be.revertedWith(
                  'ERC4626AdapterAmountZero'
                )
              })
            })
          })

          context('when the recipient is the zero address', () => {
            const recipientAddr = ZERO_ADDRESS

            it('reverts', async () => {
              await expect(erc4626Adapter.rescueFunds(token.address, recipientAddr, amount)).to.be.revertedWith(
                'ERC4626AdapterRecipientZero'
              )
            })
          })
        })

        context('when the token is the underlying erc4626', () => {
          let token: Contract

          beforeEach('set token', async () => {
            token = await erc4626Adapter.erc4626()
          })

          it('reverts', async () => {
            await expect(erc4626Adapter.rescueFunds(token, recipient.address, amount)).to.be.revertedWith(
              'ERC4626AdapterTokenERC4626'
            )
          })
        })
      })

      context('when the token is the zero address', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(erc4626Adapter.rescueFunds(token, recipient.address, amount)).to.be.revertedWith(
            'ERC4626AdapterTokenZero'
          )
        })
      })
    })

    context('when the sender is not allowed', () => {
      beforeEach('set sender', () => {
        erc4626Adapter = erc4626Adapter.connect(other)
      })

      it('reverts', async () => {
        await expect(erc4626Adapter.rescueFunds(ZERO_ADDRESS, recipient.address, 0)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
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

      it('updates total assets correctly', async () => {
        const totalAssets = await erc4626Adapter.totalAssets()
        assertAlmostEqual(totalAssets, status.totalAssets, ERROR)
      })

      it('updates share value correctly', async () => {
        const actualShareValue = await erc4626Adapter.convertToAssets(fp(1))
        assertAlmostEqual(actualShareValue, status.shareValue, ERROR)
      })

      it('updates userA shares correctly', async () => {
        const userShares = await erc4626Adapter.balanceOf(userA.address)
        assertAlmostEqual(userShares, status.userAShares, ERROR)
      })

      it('updates userA assets correctly', async () => {
        const userShares = await erc4626Adapter.balanceOf(userA.address)
        const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
        assertAlmostEqual(actualUserAssets, status.userAAssets, ERROR)
      })

      it('updates userB shares correctly', async () => {
        const userShares = await erc4626Adapter.balanceOf(userB.address)
        assertAlmostEqual(userShares, status.userBShares, ERROR)
      })

      it('updates userB assets correctly', async () => {
        const userShares = await erc4626Adapter.balanceOf(userB.address)
        const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
        assertAlmostEqual(actualUserAssets, status.userBAssets, ERROR)
      })

      it('updates userC shares correctly', async () => {
        const userShares = await erc4626Adapter.balanceOf(userC.address)
        assertAlmostEqual(userShares, status.userCShares, ERROR)
      })

      it('updates userC assets correctly', async () => {
        const userShares = await erc4626Adapter.balanceOf(userC.address)
        const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
        assertAlmostEqual(actualUserAssets, status.userCAssets, ERROR)
      })

      it('updates total shares correctly', async () => {
        const actualTotalShares = await erc4626Adapter.totalSupply()
        assertAlmostEqual(actualTotalShares, status.totalShares, ERROR)
      })

      it('updates previous total assets correctly', async () => {
        const actualPreviousTotalAssets = await erc4626Adapter.previousTotalAssets()
        assertAlmostEqual(actualPreviousTotalAssets, status.previousTotalAssets, ERROR)
      })
    }

    before('setup signers', async () => {
      // eslint-disable-next-line prettier/prettier
      [, userA, userB, userC] = await getSigners()
    })

    context('when the underlying erc4626 works as expected', async () => {
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

    context('when the underlying erc4626 does not work as expected', async () => {
      const initialAmount = fp(100)

      beforeEach('create token and erc4626', async () => {
        token = await deploy('TokenMock', ['TKN', 8])
        await token.mint(userA.address, fp(10000))
        await token.mint(userB.address, fp(10000))
        erc4626Mock = await deploy('ERC4626Mock', [token.address])
      })

      beforeEach('create erc4626 adapter', async () => {
        erc4626Adapter = await deploy('ERC4626Adapter', [erc4626Mock.address, fee, userC.address, owner.address])
      })

      beforeEach('deposit 100 assets for userA', async () => {
        await token.connect(userA).approve(erc4626Adapter.address, initialAmount)
        await erc4626Adapter.connect(userA).deposit(initialAmount, userA.address)
      })

      beforeEach('deposit 100 assets for userB', async () => {
        await token.connect(userB).approve(erc4626Adapter.address, initialAmount)
        await erc4626Adapter.connect(userB).deposit(initialAmount, userB.address)
      })

      beforeEach('triplicate assets', async () => {
        await token.mint(erc4626Mock.address, initialAmount.mul(4))
      })

      context('when assets are drained', async () => {
        const itWorksAsExpected = (drainAmount: BigNumber, maxWithdrawAmount: BigNumber, fee: BigNumberish) => {
          beforeEach('drain assets', async () => {
            await token.burn(erc4626Mock.address, drainAmount)
          })

          context('when userA withdraws the assets left', async () => {
            const amount = maxWithdrawAmount

            it('lets users withdraw all their assets left', async () => {
              const previousBalance = await token.balanceOf(userA.address)

              await erc4626Adapter.connect(userA).withdraw(amount, userA.address, userA.address)

              const currentBalance = await token.balanceOf(userA.address)
              expect(currentBalance).to.be.equal(previousBalance.add(amount))

              await expect(erc4626Adapter.connect(userB).withdraw(amount, userB.address, userB.address)).not.to.be
                .reverted
            })

            it(`${fee ? 'charges a fee' : 'does not charge any fee'}`, async () => {
              const tx = await erc4626Adapter.connect(userA).withdraw(amount, userA.address, userA.address)

              await assertEvent(tx, 'FeesSettled', { collector: userC.address, amount: fee })
            })
          })

          context('when userA withdraws more than the assets left', async () => {
            it('reverts', async () => {
              const amount = maxWithdrawAmount.add(1)

              await expect(erc4626Adapter.connect(userA).withdraw(amount, userA.address, userA.address)).to.be.reverted
            })
          })
        }

        context('when there is a loss', async () => {
          const drainAmount = fp(500)
          const maxWithdrawAmount = fp(50)
          const fee = 0

          itWorksAsExpected(drainAmount, maxWithdrawAmount, fee)
        })

        context('when there is a breakeven', async () => {
          const drainAmount = fp(400)
          const maxWithdrawAmount = initialAmount
          const fee = 0

          itWorksAsExpected(drainAmount, maxWithdrawAmount, fee)
        })

        context('when there is still some profit', async () => {
          const drainAmount = fp(200)
          const maxWithdrawAmount = fp(190).sub(1) // because of rounding when charging fees
          const fee = bn('10526315789473684210') // 10 shares = 20 assets

          itWorksAsExpected(drainAmount, maxWithdrawAmount, fee)
        })
      })

      context('when shares are drained', async () => {
        beforeEach('drain 150 shares', async () => {
          const amount = fp(150)
          await erc4626Mock.burn(erc4626Adapter.address, amount)
        })

        it('lets users withdraw all their assets', async () => {
          const amount = fp(279.99) // because of rounding when charging fees
          const previousBalance = await token.balanceOf(userA.address)

          await erc4626Adapter.connect(userA).withdraw(amount, userA.address, userA.address)

          const currentBalance = await token.balanceOf(userA.address)
          expect(currentBalance).to.be.equal(previousBalance.add(amount))

          await expect(erc4626Adapter.connect(userB).withdraw(amount, userB.address, userB.address)).not.to.be.reverted
        })

        it('charges a fee', async () => {
          const amount = fp(279.99) // because of rounding when charging fees
          const feeAmount = bn('14285714285714285713') // 14 shares = 40 assets

          const tx = await erc4626Adapter.connect(userA).withdraw(amount, userA.address, userA.address)

          await assertEvent(tx, 'FeesSettled', { collector: userC.address, amount: feeAmount })
        })
      })
    })
  })
})
