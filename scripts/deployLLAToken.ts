import { ethers, upgrades } from "hardhat";
import { LLAToken } from "../typechain-types";
import { verify } from "../utils/verify";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("OWNER_ADDR---", process.env.OWNER_ADDR);
  console.log("PAUSER_ADDR---", process.env.PAUSER_ADDR);
  console.log("UPGRADER_ADDR---", process.env.UPGRADER_ADDR);
  console.log("MINTER_ADDR---", process.env.MINTER_ADDR);
  console.log("SEPOLIA_URL---", process.env.SEPOLIA_URL);
  const fullUrl =
    process.env.SEPOLIA_URL! + "/v3/" + "574138be66974922bc4c949d5b1282ae";
  console.log("fullUrl---", fullUrl);
  try {
    const provider = new ethers.JsonRpcProvider(fullUrl);
    console.log("---2", await provider.getBlockNumber());
    // Get the deployer account
    const admin = new ethers.Wallet("0x" + process.env.OWNER_ADDR!).connect(
      provider
    );
    const pauser = new ethers.Wallet("0x" + process.env.PAUSER_ADDR!).connect(
      provider
    );
    const minter = new ethers.Wallet("0x" + process.env.MINTER_ADDR!).connect(
      provider
    );
    const upgrader = new ethers.Wallet(
      "0x" + process.env.UPGRADER_ADDR!
    ).connect(provider);

    if (!pauser || !minter || !upgrader) {
      throw new Error("Environment variables are not fully configured");
    }

    // Validate address format
    for (const item of [pauser, minter, upgrader]) {
      if (!ethers.isAddress(item.address)) {
        throw new Error(`Invalid address: ${item.address}`);
      }
    }

    // Get the contract factory
    const LLATokenFactory = await ethers.getContractFactory("LLAToken");

    // Deploy the proxy contract
    const llaToken: LLAToken = await upgrades.deployProxy(
      LLATokenFactory,
      [admin.address, pauser.address, minter.address, upgrader.address],
      {
        kind: "uups",
        initializer: "initialize",
      }
    );

    await llaToken.waitForDeployment();

    const proxyAddress = await llaToken.getAddress();
    console.log("LLAToken proxy contract address:", proxyAddress);

    // Get the implementation contract address
    const implementationAddress =
      await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Implementation contract address:", implementationAddress);

    // Verify the implementation contract

    console.log("Waiting for block confirmations...");
    await llaToken.deploymentTransaction()?.wait(6); // Wait for 6 block confirmations
    console.log("Verifying implementation contract...");
    await verify(implementationAddress, []);
    console.log("Contract verification completed");

    // Verify initial state
    console.log("\nVerifying initial contract state:");
    console.log(
      "Admin:",
      await llaToken.hasRole(await llaToken.ADMIN_ROLE(), admin.address)
    );
    console.log(
      "Pauser:",
      await llaToken.hasRole(await llaToken.PAUSER_ROLE(), pauser)
    );
    console.log(
      "Minter:",
      await llaToken.hasRole(await llaToken.MINTER_ROLE(), minter)
    );
    console.log(
      "Upgrader:",
      await llaToken.hasRole(await llaToken.UPGRADER_ROLE(), upgrader)
    );
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
