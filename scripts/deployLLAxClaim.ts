import { ethers, upgrades } from "hardhat";
import { LLAxClaim } from "../typechain-types";
import * as dotenv from "dotenv";
import * as path from "path";
import fs from "fs";

dotenv.config();

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`Deploying LLAxClaim to network: ${net.name} (chainId: ${net.chainId})`);

  const OWNER_ADDR = process.env.OWNER_ADDR;
  const LLAX_TOKEN_ADDR = process.env.LLAX_TOKEN_ADDR;

  if (!OWNER_ADDR || !LLAX_TOKEN_ADDR) {
    throw new Error("Missing required environment variables: OWNER_ADDR, LLAX_TOKEN_ADDR");
  }

  const provider = ethers.provider;
  const admin = new ethers.Wallet("0x" + OWNER_ADDR, provider);

  console.log("Admin address:", admin.address);
  console.log("LLAx Token address:", LLAX_TOKEN_ADDR);

  if (!ethers.isAddress(LLAX_TOKEN_ADDR)) {
    throw new Error(`Invalid LLAX_TOKEN_ADDR: ${LLAX_TOKEN_ADDR}`);
  }

  const balance = await provider.getBalance(admin.address);
  console.log("Admin balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.warn("Warning: Admin balance is less than 0.01 ETH/BNB, deployment might fail due to insufficient gas");
  }

  async function deployWithRetry() {
    const maxRetries = 3;
    const retryDelay = 10000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\nAttempt ${attempt} to deploy LLAxClaim...`);

        const ClaimFactory = await ethers.getContractFactory("LLAxClaim", admin);

        const llaxClaim: LLAxClaim = await upgrades.deployProxy(
          ClaimFactory,
          [LLAX_TOKEN_ADDR, admin.address],
          {
            kind: "uups",
            initializer: "initialize",
            timeout: 180000
          }
        );

        await llaxClaim.waitForDeployment();
        await llaxClaim.deploymentTransaction()?.wait(3);

        const proxyAddress = await llaxClaim.getAddress();
        console.log("LLAxClaim proxy contract address:", proxyAddress);

        const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("Implementation contract address:", implementationAddress);

        return { proxyAddress, implementationAddress, llaxClaim };
      } catch (error) {
        console.error(`Deployment attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error("Max retries reached. Deployment failed.");
        }
        console.log(`Waiting ${retryDelay / 1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  const result = await deployWithRetry();

  if (result) {
    const { proxyAddress, implementationAddress, llaxClaim } = result;

    console.log("\nVerifying initial contract state:");
    try {
      console.log("owner:", await llaxClaim.owner());
      console.log("ops:", await llaxClaim.ops());
      console.log("llaxToken:", await llaxClaim.llaxToken());
      console.log("paused:", await llaxClaim.paused());
      console.log("globalTotalClaimed:", (await llaxClaim.globalTotalClaimed()).toString());
    } catch (error) {
      console.warn("Warning: Could not verify all contract state:", error);
    }

    const deploymentInfo = {
      contract: "LLAxClaim",
      network: net.name,
      chainId: Number(net.chainId),
      adminAddress: admin.address,
      llaxTokenAddress: LLAX_TOKEN_ADDR,
      proxyAddress: proxyAddress,
      implementationAddress: implementationAddress,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date().toISOString(),
      deploymentDate: new Date().toLocaleDateString(),
      deploymentTime: new Date().toLocaleTimeString()
    };

    const outputDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `LLAxClaim-${net.name}-${new Date().toISOString().split('T')[0]}.json`
    );

    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2), "utf-8");
    console.log("\n=== Deployment Complete ===");
    console.log("Deployment information saved to:", outputPath);
    console.log(`Contract deployed successfully on ${net.name}!`);

    console.log("\n=== Next Steps ===");
    console.log(`1. Grant MINTER_ROLE on LLAx token to LLAxClaim proxy address: ${proxyAddress}`);
    console.log(`2. Verify contract if needed: npx hardhat verify --network ${net.name} ${implementationAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
