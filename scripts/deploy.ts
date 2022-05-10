// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat";

import { OUATOnet } from "../typechain";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const accounts = await ethers.getSigners();

  let uniswapV2RouterAddress;

  if (network.name === "bsc") {
    uniswapV2RouterAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  } else if (network.name === "bscTestnet") {
    uniswapV2RouterAddress = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
  } else {
    throw new Error("Unknown network");
  }
  // We get the contract to deploy
  const OuatoNetFactory = await ethers.getContractFactory("OUATOnet");
  const ouatoNet: OUATOnet = await OuatoNetFactory.deploy({
    gasLimit: 6500000,
  });
  await ouatoNet.deployed();

  const liquidityFeePercentage = 200;
  const productionFeePercentage = 600;
  const platformFeePercentage = 200;

  await ouatoNet.initialize(
    liquidityFeePercentage,
    productionFeePercentage,
    platformFeePercentage,
    accounts[0].address,
    accounts[0].address,
    accounts[0].address,
    uniswapV2RouterAddress,
    {
      gasLimit: 6500000,
    }
  );

  console.log("ouatoNet deployed to:", ouatoNet.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
