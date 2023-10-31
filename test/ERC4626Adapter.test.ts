import { assertAlmostEqual, deploy, deployTokenMock, fp, getSigners } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

describe('ERC4626 Adapter', () => {
  let token: Contract, erc4626Mock: Contract, erc4626Adapter: Contract
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

    it('total assets', async function () {
      const totalAssets = await erc4626Adapter.totalAssets()
      assertAlmostEqual(totalAssets, status.totalAssets, ERROR)
    })

    it('share value', async function () {
      const actualShareValue = await erc4626Adapter.convertToAssets(fp(1))
      assertAlmostEqual(actualShareValue, status.shareValue, ERROR)
    })

    it('userA shares', async function () {
      expect(await erc4626Adapter.balanceOf(userA.address)).to.be.equal(status.userAShares)
    })

    it('userA assets', async function () {
      const userShares = await erc4626Adapter.balanceOf(userA.address)
      const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
      assertAlmostEqual(actualUserAssets, status.userAAssets, ERROR)
    })

    it('userB shares', async function () {
      expect(await erc4626Adapter.balanceOf(userB.address)).to.be.equal(status.userBShares)
    })

    it('userB assets', async function () {
      const userShares = await erc4626Adapter.balanceOf(userB.address)
      const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
      assertAlmostEqual(actualUserAssets, status.userBAssets, ERROR)
    })

    it('userC shares', async function () {
      const userShares = await erc4626Adapter.balanceOf(userC.address)
      assertAlmostEqual(userShares, status.userCShares, ERROR)
    })

    it('userC assets', async function () {
      const userShares = await erc4626Adapter.balanceOf(userC.address)
      const actualUserAssets = await erc4626Adapter.convertToAssets(userShares)
      assertAlmostEqual(actualUserAssets, status.userCAssets, ERROR)
    })

    it('total shares', async function () {
      const actualTotalShares = await erc4626Adapter.totalSupply()
      assertAlmostEqual(actualTotalShares, status.totalShares, ERROR)
    })

    it('previous total assets', async function () {
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
    const fee = fp(0.1)
    erc4626Adapter = await deploy('ERC4626Adapter', [erc4626Mock.address, fee, userC.address])
  })

  describe('initialization', async () => {
    it('inherits decimals from asset', async function () {
      expect(await erc4626Adapter.decimals()).to.be.equal(await token.decimals())
    })
  })

  describe('t1', async () => {
    const amount = fp(100)

    before('user A deposits 100', async () => {
      await token.connect(userA).approve(erc4626Adapter.address, amount)
      await erc4626Adapter.connect(userA).deposit(amount, userA.address)
    })

    checkStatus({
      totalAssets: amount,
      shareValue: fp(1),
      userAShares: amount,
      userAAssets: amount,
      userBShares: fp(0),
      userBAssets: fp(0),
      userCShares: fp(0),
      userCAssets: fp(0),
      totalShares: amount,
      previousTotalAssets: amount,
    })
  })

  describe('t2.1', async () => {
    before('assets triplicate', async () => {
      const amount = fp(200)
      await token.mint(erc4626Mock.address, amount)
    })

    const userAShares = fp(100)
    const userCShares = fp(20).mul(fp(1)).div(fp(2.8)) // 7.14
    checkStatus({
      totalAssets: fp(300),
      shareValue: fp(2.8),
      userAShares,
      userAAssets: fp(280),
      userBShares: fp(0),
      userBAssets: fp(0),
      userCShares: userCShares,
      userCAssets: fp(20),
      totalShares: userAShares.add(userCShares), // 107.14
      previousTotalAssets: fp(100),
    })
  })

  describe('t2.2', async () => {
    const amount = fp(30)

    before('user B deposits 30', async () => {
      await token.connect(userB).approve(erc4626Adapter.address, amount)
      await erc4626Adapter.connect(userB).deposit(amount, userB.address)
    })

    const userAShares = fp(100)
    const userBShares = amount.mul(fp(1)).div(fp(2.8)) // 10.714
    const userCShares = fp(20).mul(fp(1)).div(fp(2.8)) // 7.14
    checkStatus({
      totalAssets: fp(330),
      shareValue: fp(2.8),
      userAShares,
      userAAssets: fp(280),
      userBShares,
      userBAssets: amount,
      userCShares,
      userCAssets: fp(20),
      totalShares: userAShares.add(userCShares).add(userBShares), // 117.854
      previousTotalAssets: fp(330),
    })
  })

  describe('t3.1', async () => {
    before('assets duplicate', async () => {
      const amount = fp(330)
      await token.mint(erc4626Mock.address, amount)
    })

    const shareValue = fp(5.32)
    const userAShares = fp(100)
    const userBShares = fp(30).mul(fp(1)).div(fp(2.8)) // 10.714
    const prevUserCShares = fp(20).mul(fp(1)).div(fp(2.8)) // 7.14
    const userCShares = prevUserCShares.add(fp(33).mul(fp(1)).div(shareValue)) // 13.34
    checkStatus({
      totalAssets: fp(660),
      shareValue,
      userAShares,
      userAAssets: fp(532),
      userBShares,
      userBAssets: userBShares.mul(shareValue).div(fp(1)), // 57
      userCShares,
      userCAssets: userCShares.mul(shareValue).div(fp(1)), // 71
      totalShares: userAShares.add(userCShares).add(userBShares), // 124.05
      previousTotalAssets: fp(330),
    })
  })

  describe('t3.2', async () => {
    const amount = fp(50)

    before('user A withdraws 50 shares', async () => {
      await erc4626Adapter.connect(userA).redeem(amount, userA.address, userA.address)
    })

    const shareValue = fp(5.32)
    const userAShares = fp(100).sub(amount) // 50
    const userBShares = fp(30).mul(fp(1)).div(fp(2.8)) // 10.714
    const prevUserCShares = fp(20).mul(fp(1)).div(fp(2.8)) // 7.14
    const userCShares = prevUserCShares.add(fp(33).mul(fp(1)).div(shareValue)) // 13.34
    checkStatus({
      totalAssets: fp(394),
      shareValue,
      userAShares,
      userAAssets: fp(266),
      userBShares,
      userBAssets: userBShares.mul(shareValue).div(fp(1)), // 57
      userCShares,
      userCAssets: userCShares.mul(shareValue).div(fp(1)), // 71
      totalShares: userAShares.add(userCShares).add(userBShares), // 74.05
      previousTotalAssets: fp(394),
    })
  })
})
