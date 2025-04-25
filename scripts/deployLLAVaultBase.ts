// TODO remove the function of setTotalMintCount
import { ethers, upgrades } from "hardhat";
import { LLAVaultBase } from "../typechain-types";
import * as path from "path";
import fs from "fs";
async function main() {
  console.log("Starting deployment of LLAVaultBase...");
  // Load environment variables
  const ownerPrivateKey = process.env.OWNER_ADDR!;

  if (!ownerPrivateKey) {
    throw new Error("Missing PRIVATE_KEY or OWNER_ADDR in .env file");
  }

  // Create provider function function
  async function createProvider(endpoint: string) {
    return new ethers.JsonRpcProvider(endpoint);
  }
  // Get available provider
  const provider = await createProvider(
    "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae"
  );
  const admin = new ethers.Wallet("0x" + process.env.OWNER_ADDR!, provider);
  const tokenAddress = "";
  const multiSig = "";
  console.log("Deploying contracts with the account:", admin.address);

  // Retry logic for deployment
  async function deployWithRetry() {
    const maxRetries = 5; // Increase retry count
    const retryDelay = 10000; // 10 seconds delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to deploy LLAToken...`);
        const LLAVaultBaseFactory = await ethers.getContractFactory(
          "LLAVaultBase",
          admin
        );

        const llaVaultBase: LLAVaultBase = await upgrades.deployProxy(
          LLAVaultBaseFactory,
          [
            admin.address,
            admin.address,
            admin.address,
            admin.address,
            admin.address,
            tokenAddress,
            multiSig,
          ],
          {
            kind: "uups",
            initializer: "initialize",
            timeout: 180000, // 3 minutes timeout
          }
        );

        // Wait for more block confirmations
        await llaVaultBase.waitForDeployment();
        await llaVaultBase.deploymentTransaction()?.wait(2);

        const proxyAddress = await llaVaultBase.getAddress();
        console.log("LLAToken proxy contract address:", proxyAddress);

        const implementationAddress =
          await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("Implementation contract address:", implementationAddress);

        return { proxyAddress, implementationAddress, llaVaultBase };
      } catch (error) {
        console.error(`Deployment attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error("Max retries reached. Deployment failed.");
        }
        console.log(`Waiting ${retryDelay / 1000} seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  const res = await deployWithRetry();
  if (res) {
    const { proxyAddress, implementationAddress, llaVaultBase } = res;
    // Verify initial state
    console.log("\nVerifying initial contract state:");
    console.log(
      "Admin:",
      await llaVaultBase.hasRole(await llaVaultBase.ADMIN_ROLE(), admin.address)
    );
    console.log(
      "Pauser:",
      await llaVaultBase.hasRole(
        await llaVaultBase.PAUSER_ROLE(),
        admin.address
      )
    );
    console.log(
      "Minter:",
      await llaVaultBase.hasRole(
        await llaVaultBase.MINTER_ROLE(),
        admin.address
      )
    );
    console.log(
      "TokenManager:",
      await llaVaultBase.hasRole(
        await llaVaultBase.TOKEN_MANAGER_ROLE(),
        admin.address
      )
    );
    console.log(
      "Upgrader:",
      await llaVaultBase.hasRole(
        await llaVaultBase.UPGRADER_ROLE(),
        admin.address
      )
    );
    const info = {
      contract: "LLAVaultBase",
      adminAddress: admin.address,
      pauserAddress: admin.address,
      minterAddress: admin.address,
      upgraderAddress: admin.address,
      tokenManagerAddress: admin.address,
      multiSig,
      tokenAddress,
      proxyAddress: proxyAddress,
      logicAddress: implementationAddress,
      time: new Date().toLocaleString(),
    };

    // Create output directory (if not exists)
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      new Date().toLocaleDateString() + "deployLLAVaultBase.json"
    );
    fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), "utf-8");
    console.log("Deployment information saved to", outputPath);
    console.log("Deployment completed successfully.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
