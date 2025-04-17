import { ethers, upgrades } from "hardhat";
import { LLAToken } from "../typechain-types";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config();
const fs = require("fs");
async function main() {
  console.log("Deploying LLAToken to bsctest network...");

  // Load environment variables
  const ownerPrivateKey = process.env.OWNER_ADDR!;

  if (!ownerPrivateKey) {
    throw new Error("Missing PRIVATE_KEY or OWNER_ADDR in .env file");
  }

  // 定义多个 RPC 节点
  const RPC_ENDPOINTS = [
    "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
    "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
    "https://bsc-testnet.infura.io/v3/574138be66974922bc4c949d5b1282ae",
  ];

  // 创建 provider 的函数
  async function createProvider(endpoint: string) {
    return new ethers.JsonRpcProvider(endpoint);
  }

  // 尝试连接到可用的 RPC 节点
  async function getWorkingProvider() {
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const provider = await createProvider(endpoint);
        // 测试连接
        await provider.getBlockNumber();
        console.log(`Successfully connected to ${endpoint}`);
        return provider;
      } catch (error) {
        console.log(`Failed to connect to ${endpoint}, trying next...`);
      }
    }
    throw new Error("Failed to connect to any RPC endpoint");
  }

  // 获取可用的 provider
  const provider = await getWorkingProvider();
  const admin = new ethers.Wallet("0x" + process.env.OWNER_ADDR!, provider);

  console.log("Admin address:", admin.address);

  // Validate address format
  if (!ethers.isAddress(admin.address)) {
    throw new Error(`Invalid address: ${admin.address}`);
  }

  // Retry logic for deployment
  async function deployWithRetry() {
    const maxRetries = 5; // 增加重试次数
    const retryDelay = 10000; // 10秒延迟

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to deploy LLAToken...`);
        const LLATokenFactory = await ethers.getContractFactory("LLAToken", admin);

        const llaToken: LLAToken = await upgrades.deployProxy(
          LLATokenFactory,
          [admin.address, admin.address, admin.address, admin.address],
          {
            kind: "uups",
            initializer: "initialize",
            timeout: 180000 // 3分钟超时
          }
        );

        // 等待更多的区块确认
        await llaToken.waitForDeployment();
        await llaToken.deploymentTransaction()?.wait(2);

        const proxyAddress = await llaToken.getAddress();
        console.log("LLAToken proxy contract address:", proxyAddress);

        const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("Implementation contract address:", implementationAddress);

        return { proxyAddress, implementationAddress, llaToken };
      } catch (error) {
        console.error(`Deployment attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error("Max retries reached. Deployment failed.");
        }
        console.log(`Waiting ${retryDelay/1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  const res = await deployWithRetry();
  if (res) {
    const { proxyAddress, implementationAddress, llaToken } = res;
    // Verify initial state
    console.log("\nVerifying initial contract state:");
    console.log(
      "Admin:",
      await llaToken.hasRole(await llaToken.ADMIN_ROLE(), admin.address)
    );
    console.log(
      "Pauser:",
      await llaToken.hasRole(await llaToken.PAUSER_ROLE(), admin.address)
    );
    console.log(
      "Minter:",
      await llaToken.hasRole(await llaToken.MINTER_ROLE(), admin.address)
    );
    console.log(
      "Upgrader:",
      await llaToken.hasRole(await llaToken.UPGRADER_ROLE(), admin.address)
    );
    const info = {
      contract: "LLAToken",
      adminAddress: admin.address,
      pauserAddress: admin.address,
      minterAddress: admin.address,
      upgraderAddress: admin.address,
      proxyAddress: proxyAddress,
      logicAddress: implementationAddress,
    };

    // 创建输出目录（如果不存在）
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, "deployLLAToken.json");
    fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), "utf-8");
    console.log("Deployment information saved to", outputPath);
    console.log("Deployment completed successfully.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
