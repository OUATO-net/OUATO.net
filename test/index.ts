import { expect } from "chai";
import { ethers } from "hardhat";
import { IUniswapV2Router02, OUATOnet } from "../typechain";

const liquidityFeePercentage = 200;
const productionFeePercentage = 600;
const platformFeePercentage = 200;
const tokenName = "OUATO.net";
const uniswapV2RouterAddress = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";

async function getTotalFee(ouatoNet: OUATOnet): Promise<number> {
  const liquidityFeePercentage = await ouatoNet.liquidityFeePercentage();
  const productionFeePercentage = await ouatoNet.productionFeePercentage();
  const platformFeePercentage = await ouatoNet.platformFeePercentage();
  const MULTIPLIER = await ouatoNet.MULTIPLIER();

  return (
    ((liquidityFeePercentage +
      productionFeePercentage +
      platformFeePercentage) /
      MULTIPLIER) *
    100
  );
}

describe("OuatoNet", function () {
  let ouatoNet: OUATOnet;
  let uniswapV2Router02: IUniswapV2Router02;
  before(async function () {
    const [owner, liquidityWallet, productionFeeWallet, platformFeeWallet] =
      await ethers.getSigners();
    const OuatoNetFactory = await ethers.getContractFactory("OUATOnet");
    ouatoNet = await OuatoNetFactory.connect(owner).deploy({
      gasLimit: 6500000,
    });
    await ouatoNet.deployed();

    await ouatoNet.initialize(
      liquidityFeePercentage,
      productionFeePercentage,
      platformFeePercentage,
      liquidityWallet.address,
      productionFeeWallet.address,
      platformFeeWallet.address,
      uniswapV2RouterAddress,
      {
        gasLimit: 6500000,
      }
    );
    expect(await ouatoNet.balanceOf(owner.address)).to.equal(
      await ouatoNet.totalSupply()
    );
    expect(await ouatoNet.name()).to.equal(tokenName);

    uniswapV2Router02 = (await ethers.getContractAt(
      "IUniswapV2Router02",
      uniswapV2RouterAddress,
      owner
    )) as IUniswapV2Router02;

    const tokenAmount = ethers.utils.parseEther("1000000");
    await ouatoNet.approve(uniswapV2Router02.address, tokenAmount);
    const latestBlock = await ethers.provider.getBlock("latest");
    await uniswapV2Router02
      .connect(owner)
      .addLiquidityETH(
        ouatoNet.address,
        tokenAmount,
        0,
        ethers.utils.parseEther("1000"),
        await ouatoNet.liquidityWallet(),
        latestBlock.timestamp + 1000,
        { value: ethers.utils.parseEther("1000"), gasLimit: 700000 }
      );
  });

  it("owner Should be in fee Exclude", async function () {
    const [owner] = await ethers.getSigners();
    expect(await ouatoNet.isExcludedFromFee(owner.address)).to.be.true;
  });

  it("owner Should transfer without fee", async function () {
    const [
      owner,
      liquidityWallet,
      productionFeeWallet,
      platformFeeWallet,
      addr1,
    ] = await ethers.getSigners();
    await ouatoNet.connect(owner).transfer(addr1.address, 100);
    expect(await ouatoNet.balanceOf(addr1.address)).to.equal(100);
  });

  it("user Should transfer small amounts with fee", async function () {
    const [
      owner,
      liquidityWallet,
      productionFeeWallet,
      platformFeeWallet,
      addr1,
      addr2,
    ] = await ethers.getSigners();
    const transferAmount = 100;
    await ouatoNet.connect(owner).transfer(addr1.address, transferAmount);
    await ouatoNet.connect(addr1).transfer(addr2.address, transferAmount);
    const totalFee = await getTotalFee(ouatoNet);
    expect(await ouatoNet.balanceOf(addr2.address)).to.equal(
      transferAmount - (transferAmount * totalFee) / 100
    );
  });

  it("user Should transfer with fee", async function () {
    const [
      owner,
      liquidityWallet,
      productionFeeWallet,
      platformFeeWallet,
      addr1,
      addr2,
    ] = await ethers.getSigners();
    const addr2InitialBalance = await ouatoNet.balanceOf(addr2.address);
    const transferAmount = ethers.utils.parseEther("100");
    await ouatoNet.connect(owner).transfer(addr1.address, transferAmount);
    await ouatoNet.connect(addr1).transfer(addr2.address, transferAmount);
    const totalFee = await getTotalFee(ouatoNet);
    const addr2FinalBalance = await ouatoNet.balanceOf(addr2.address);

    expect(addr2FinalBalance.sub(addr2InitialBalance)).to.equal(
      transferAmount.sub(transferAmount.mul(totalFee).div(100))
    );
  });

  it("Should change numTokensSellToAddToLiquidity", async function () {
    const [owner] = await ethers.getSigners();
    const numTokensSellToAddToLiquidity =
      await ouatoNet.numTokensSellToAddToLiquidity();
    expect(numTokensSellToAddToLiquidity).to.equal(
      ethers.utils.parseEther("1")
    );
    await ouatoNet
      .connect(owner)
      .updateNumTokensSellToAddToLiquidity(ethers.utils.parseEther("0.1"));

    const newNumTokensSellToAddToLiquidity =
      await ouatoNet.numTokensSellToAddToLiquidity();
    expect(newNumTokensSellToAddToLiquidity).to.equal(
      ethers.utils.parseEther("0.1")
    );
  });

  it("Should change fee per cents", async function () {
    const [owner] = await ethers.getSigners();

    const liquidityFeePercentageFromContract =
      await ouatoNet.liquidityFeePercentage();
    const productionFeePercentageFromContract =
      await ouatoNet.productionFeePercentage();
    const platformFeePercentageFromContract =
      await ouatoNet.platformFeePercentage();

    expect(liquidityFeePercentageFromContract).to.equal(liquidityFeePercentage);
    expect(productionFeePercentageFromContract).to.equal(
      productionFeePercentage
    );
    expect(platformFeePercentageFromContract).to.equal(platformFeePercentage);

    const newLiquidityFeePercentage = liquidityFeePercentage * 2;
    const newProductionFeePercentage = productionFeePercentage * 2;
    const newPlatformFeePercentage = platformFeePercentage * 2;

    await ouatoNet
      .connect(owner)
      .changeFees(
        newLiquidityFeePercentage,
        newProductionFeePercentage,
        newPlatformFeePercentage
      );

    expect(await ouatoNet.liquidityFeePercentage()).to.equal(
      newLiquidityFeePercentage
    );
    expect(await ouatoNet.productionFeePercentage()).to.equal(
      newProductionFeePercentage
    );
    expect(await ouatoNet.platformFeePercentage()).to.equal(
      newPlatformFeePercentage
    );

    await ouatoNet
      .connect(owner)
      .changeFees(
        liquidityFeePercentage,
        productionFeePercentage,
        platformFeePercentage
      );

    expect(await ouatoNet.liquidityFeePercentage()).to.equal(
      liquidityFeePercentage
    );
    expect(await ouatoNet.productionFeePercentage()).to.equal(
      productionFeePercentage
    );
    expect(await ouatoNet.platformFeePercentage()).to.equal(
      platformFeePercentage
    );
  });

  it("Should change fee wallets", async function () {
    const [
      owner,
      liquidityWallet,
      productionFeeWallet,
      platformFeeWallet,
      newLiquidityWallet,
      newProductionFeeWallet,
      newPlatformFeeWallet,
    ] = await ethers.getSigners();

    expect(await ouatoNet.liquidityWallet()).to.equal(liquidityWallet.address);
    expect(await ouatoNet.productionFeeWallet()).to.equal(
      productionFeeWallet.address
    );
    expect(await ouatoNet.platformFeeWallet()).to.equal(
      platformFeeWallet.address
    );

    await ouatoNet
      .connect(owner)
      .changeWallets(
        newLiquidityWallet.address,
        newProductionFeeWallet.address,
        newPlatformFeeWallet.address
      );

    expect(await ouatoNet.liquidityWallet()).to.equal(
      newLiquidityWallet.address
    );
    expect(await ouatoNet.productionFeeWallet()).to.equal(
      newProductionFeeWallet.address
    );
    expect(await ouatoNet.platformFeeWallet()).to.equal(
      newPlatformFeeWallet.address
    );

    await ouatoNet
      .connect(owner)
      .changeWallets(
        liquidityWallet.address,
        productionFeeWallet.address,
        platformFeeWallet.address
      );

    expect(await ouatoNet.liquidityWallet()).to.equal(liquidityWallet.address);
    expect(await ouatoNet.productionFeeWallet()).to.equal(
      productionFeeWallet.address
    );
    expect(await ouatoNet.platformFeeWallet()).to.equal(
      platformFeeWallet.address
    );
  });
});
