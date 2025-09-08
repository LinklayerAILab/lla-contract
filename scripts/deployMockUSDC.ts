import { ethers } from "hardhat";
// import { MockUSDC } from "../typechain-types";
import * as dotenv from "dotenv";
import * as path from "path";
import fs from "fs";
dotenv.config();

async function main() {
  console.log("Deploying MockUSDC to erbie network...");

  // Load environment variables
  const ownerPrivateKey = process.env.OWNER_ADDR!;

  if (!ownerPrivateKey) {
    throw new Error("Missing OWNER_ADDR in .env file");
  }

  // Define Erbie RPC endpoints
  const RPC_ENDPOINTS = [
    "http://192.168.1.235:8560",
    "http://192.168.1.235:8560", // backup
    "http://192.168.1.235:8560", // backup
  ];

  // Create provider function
  async function createProvider(endpoint: string) {
    return new ethers.JsonRpcProvider(endpoint);
  }

  // Try to connect to available RPC nodes
  async function getWorkingProvider() {
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const provider = await createProvider(endpoint);
        // Test connection
        await provider.getBlockNumber();
        console.log(`Successfully connected to ${endpoint}`);
        return provider;
      } catch (error) {
        console.log(`Failed to connect to ${endpoint}, trying next...`);
      }
    }
    throw new Error("Failed to connect to any Erbie RPC endpoint");
  }

  // Get available provider
  const provider = await getWorkingProvider();
  const admin = new ethers.Wallet("0x" + process.env.OWNER_ADDR!, provider);

  console.log("Admin address:", admin.address);

  // Validate address format
  if (!ethers.isAddress(admin.address)) {
    throw new Error(`Invalid address: ${admin.address}`);
  }

  // Retry logic for deployment
  async function deployWithRetry() {
    const maxRetries = 5; // Increase retry count
    const retryDelay = 10000; // 10 seconds delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to deploy MockUSDC...`);
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC", admin);

        // Deploy the contract (simple constructor deployment, not upgradeable)
        const mockUSDC = await MockUSDCFactory.deploy(admin.address);

        // Wait for more block confirmations
        await mockUSDC.waitForDeployment();
        await mockUSDC.deploymentTransaction()?.wait(2);

        const contractAddress = await mockUSDC.getAddress();
        console.log("MockUSDC contract address:", contractAddress);

        return { contractAddress, mockUSDC };
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
    const { contractAddress, mockUSDC } = res;
    
    // Verify initial state
    console.log("\nVerifying initial contract state:");
    console.log("Name:", await mockUSDC.name());
    console.log("Symbol:", await mockUSDC.symbol());
    console.log("Decimals:", await mockUSDC.decimals());
    console.log("Owner:", await mockUSDC.owner());
    console.log("Total Supply:", await mockUSDC.totalSupply());
    console.log("Version:", await mockUSDC.version());

    const info = {
      contract: "MockUSDC",
      network: "erbie",
      adminAddress: admin.address,
      contractAddress: contractAddress,
      name: await mockUSDC.name(),
      symbol: await mockUSDC.symbol(), 
      decimals: (await mockUSDC.decimals()).toString(),
      totalSupply: (await mockUSDC.totalSupply()).toString(),
      version: await mockUSDC.version(),
      time: new Date().toLocaleString(),
    };

    // Create output directory (if not exists)
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      new Date().toLocaleDateString().replace(/\//g, '-') + "deployMockUSDC.json"
    );
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