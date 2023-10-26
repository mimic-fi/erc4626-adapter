import { bn, deploy, deployTokenMock, fp, getSigners } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

describe('ERC4626 Adapter', () => {
  let token: Contract
  let erc4626Mock: Contract
  let erc4626Adapter: Contract
  let userA: SignerWithAddress, userB: SignerWithAddress, userC: SignerWithAddress

  function checkStatus(status: {
    totalUnderlying: BigNumber
    shareValue: BigNumber
    userAShares: BigNumber
    userAUnderlying: BigNumber
    userBShares: BigNumber
    userBUnderlying: BigNumber
    userCShares: BigNumber
    userCUnderlying: BigNumber
    totalShares: BigNumber
    totalNetAssets: BigNumber
  }) {
    it('total underlying', async function () {
      expect(await erc4626Adapter.convertToAssets(await erc4626Adapter.totalSupply())).to.be.equal(
        status.totalUnderlying
      )
    })

    it('share value', async function () {
      expect(await erc4626Adapter.convertToAssets(fp(1))).to.be.equal(status.shareValue)
    })

    it('userA shares', async function () {
      expect(await erc4626Adapter.balanceOf(userA.address)).to.be.equal(status.userAShares)
    })

    it('userA underlying', async function () {
      expect(await erc4626Adapter.convertToAssets(await erc4626Adapter.balanceOf(userA.address))).to.be.equal(
        status.userAUnderlying
      )
    })

    it('userB shares', async function () {
      expect(await erc4626Adapter.balanceOf(userB.address)).to.be.equal(status.userBShares)
    })

    it('userB underlying', async function () {
      expect(await erc4626Adapter.convertToAssets(await erc4626Adapter.balanceOf(userB.address))).to.be.equal(
        status.userBUnderlying
      )
    })

    it('userC shares', async function () {
      expect(await erc4626Adapter.balanceOf(userC.address)).to.be.equal(status.userCShares)
    })

    it('userC underlying', async function () {
      expect(await erc4626Adapter.convertToAssets(await erc4626Adapter.balanceOf(userC.address))).to.be.equal(
        status.userCUnderlying
      )
    })

    it('total shares', async function () {
      expect(await erc4626Adapter.totalSupply()).to.be.equal(status.totalShares)
    })

    it('total invested', async function () {
      expect(await erc4626Adapter.totalNetAssets()).to.be.equal(status.totalNetAssets)
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
    it('inherit decimals if from asset', async function () {
      expect(await erc4626Adapter.decimals()).to.be.equal(await token.decimals())
    })
  })

  describe('t1', async () => {
    before('user A deposits 100', async () => {
      const amount = fp(100)
      await token.connect(userA).approve(erc4626Adapter.address, amount)
      await erc4626Adapter.connect(userA).deposit(amount, userA.address)
    })

    checkStatus({
      totalUnderlying: fp(100),
      shareValue: fp(1),
      userAShares: fp(100),
      userAUnderlying: fp(100),
      userBShares: fp(0),
      userBUnderlying: fp(0),
      userCShares: fp(0),
      userCUnderlying: fp(0),
      totalShares: fp(100),
      totalNetAssets: fp(100),
    })
  })

  describe('t2.1', async () => {
    before('underlying triplicates', async () => {
      const amount = fp(200)
      await token.mint(erc4626Mock.address, amount)
    })

    const userCShares = fp(20).mul(fp(1)).div(fp(2.8)).add(1)
    checkStatus({
      totalUnderlying: fp(300),
      shareValue: fp(2.8).sub(1),
      userAShares: fp(100),
      userAUnderlying: fp(280).sub(3),
      userBShares: fp(0),
      userBUnderlying: fp(0),
      userCShares: userCShares,
      userCUnderlying: fp(20).add(2),
      totalShares: fp(100).add(userCShares),
      totalNetAssets: fp(100),
    })
  })

  describe('t2.2', async () => {
    before('user B deposits 30', async () => {
      const amount = fp(30)
      await token.connect(userB).approve(erc4626Adapter.address, amount)
      await erc4626Adapter.connect(userB).deposit(amount, userB.address)
    })

    const userCShares = fp(20).mul(fp(1)).div(fp(2.8)).add(1)
    const userBShares = fp(30).mul(fp(1)).div(fp(2.8))
    checkStatus({
      totalUnderlying: fp(330),
      shareValue: fp(2.8).sub(1),
      userAShares: fp(100),
      userAUnderlying: fp(280).sub(1),
      userBShares: userBShares,
      userBUnderlying: fp(30).sub(3),
      userCShares: userCShares,
      userCUnderlying: fp(20).add(2),
      totalShares: fp(100).add(userCShares).add(userBShares),
      totalNetAssets: fp(330),
    })
  })

  describe('t3.1', async () => {
    before('underlying duplicates', async () => {
      const amount = fp(330)
      await token.mint(erc4626Mock.address, amount)
    })

    const userBShares = fp(30).mul(fp(1)).div(fp(2.8))
    const shareValue = fp(5.32).sub(1)
    checkStatus({
      totalUnderlying: fp(660),
      shareValue: shareValue,
      userAShares: fp(100),
      userAUnderlying: fp(532).sub(9),
      userBShares: userBShares,
      userBUnderlying: userBShares.mul(shareValue).div(fp(1)).add(10),
      userCShares: bn('13345864661654135341'),
      userCUnderlying: bn('71000000000000000013'),
      totalShares: bn('124060150375939849626'),
      totalNetAssets: fp(330),
    })
  })

  describe('t3.2', async () => {
    before('user A withdraws 50 shares', async () => {
      const amount = fp(50)
      await erc4626Adapter.connect(userA).redeem(amount, userA.address, userA.address)
    })

    const userBShares = fp(30).mul(fp(1)).div(fp(2.8))
    const shareValue = fp(5.32).sub(1)
    checkStatus({
      totalUnderlying: fp(394).add(5),
      shareValue: shareValue,
      userAShares: fp(50),
      userAUnderlying: fp(266).sub(4),
      userBShares: userBShares,
      userBUnderlying: userBShares.mul(shareValue).div(fp(1)).add(10),
      userCShares: bn('13345864661654135341'),
      userCUnderlying: bn('71000000000000000013'),
      totalShares: bn('124060150375939849626').sub(fp(50)),
      totalNetAssets: fp(394).add(5),
    })
  })
})
