import { ethers, upgrades } from "hardhat";

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Get the contract factory
  const LLATokenFactory = await ethers.getContractFactory("LLAToken");

  // Set initialization parameters
  const defaultAdmin = deployer.address;
  const pauser = "0xPauserAddress"; // Replace with the actual pauser address
  const minter = "0xMinterAddress"; // Replace with the actual minter address
  const upgrader = "0xUpgraderAddress"; // Replace with the actual upgrader address

  // Deploy the contract
  const llaToken = await upgrades.deployProxy(
    LLATokenFactory,
    [defaultAdmin, pauser, minter, upgrader],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );

  await llaToken.deployed();

  console.log("LLAToken deployed to:", await llaToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
