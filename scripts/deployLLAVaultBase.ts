import { ethers, upgrades } from "hardhat";

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Get the contract factory
  const LLAVaultBaseFactory = await ethers.getContractFactory("LLAVaultBase");

  // Set initialization parameters
  const defaultAdmin = deployer.address;
  const pauser = "0xPauserAddress"; // Replace with the actual pauser address
  const minter = "0xMinterAddress"; // Replace with the actual minter address
  const tokenManager = "0xTokenManagerAddress"; // Replace with the actual token manager address
  const upgrader = "0xUpgraderAddress"; // Replace with the actual upgrader address
  const llaToken = "0xLLATokenAddress"; // Replace with the actual LLA token address
  const multiSig = "0xMultiSigAddress"; // Replace with the actual multiSig address

  // Deploy the contract
  const llaVaultBase = await upgrades.deployProxy(
    LLAVaultBaseFactory,
    [defaultAdmin, pauser, minter, tokenManager, upgrader, llaToken, multiSig],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );

  await llaVaultBase.waitForDeployment();

  console.log("LLAVaultBase deployed to:", await llaVaultBase.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
