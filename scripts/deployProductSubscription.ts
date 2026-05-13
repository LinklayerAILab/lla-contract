import { ethers, upgrades } from "hardhat";
import { ProductSubscription } from "../typechain-types";
import * as dotenv from "dotenv";
import * as path from "path";
import fs from "fs";

dotenv.config();

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`Deploying ProductSubscription to network: ${net.name} (chainId: ${net.chainId})`);

  // Load environment variables
  const OWNER_ADDR = process.env.OWNER_ADDR;
  const PAUSER_ADDR = process.env.PAUSER_ADDR;
  const TOKENMANAGER_ADDR = process.env.TOKENMANAGER_ADDR;
  const PRODUCTMANAGER_ADDR = process.env.PRODUCTMANAGER_ADDR;
  const MULTISIG_ADDR = process.env.MULTISIG_ADDR;

  if (!OWNER_ADDR || !PAUSER_ADDR || !TOKENMANAGER_ADDR || !PRODUCTMANAGER_ADDR || !MULTISIG_ADDR) {
    throw new Error("Missing required environment variables in .env file");
  }

  // Use current Hardhat provider
  const provider = ethers.provider;
  
  // Create signers from private keys (must match network accounts)
  const admin = new ethers.Wallet("0x" + OWNER_ADDR, provider);
  const pauser = new ethers.Wallet("0x" + PAUSER_ADDR, provider);
  const tokenManager = new ethers.Wallet("0x" + TOKENMANAGER_ADDR, provider);
  const productManager = new ethers.Wallet("0x" + PRODUCTMANAGER_ADDR, provider);
  const multiSig = new ethers.Wallet("0x" + MULTISIG_ADDR, provider);

  console.log("Admin address:", admin.address);
  console.log("Pauser address:", pauser.address);
  console.log("Token Manager address:", tokenManager.address);
  console.log("Product Manager address:", productManager.address);
  console.log("MultiSig address:", multiSig.address);

  // Validate addresses
  const addresses = [admin.address, pauser.address, tokenManager.address, productManager.address, multiSig.address];
  for (const addr of addresses) {
    if (!ethers.isAddress(addr)) {
      throw new Error(`Invalid address: ${addr}`);
    }
  }

  // Check balance
  const balance = await provider.getBalance(admin.address);
  console.log("Admin balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.warn("Warning: Admin balance is less than 0.01 ETH/BNB, deployment might fail due to insufficient gas");
  }

  // Retry logic for deployment
  async function deployWithRetry() {
    const maxRetries = 3;
    const retryDelay = 10000; // 10 seconds delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\nAttempt ${attempt} to deploy ProductSubscription...`);
        
        const ProductSubscriptionFactory = await ethers.getContractFactory("ProductSubscription", admin);

        const productSubscription: ProductSubscription = await upgrades.deployProxy(
          ProductSubscriptionFactory,
          [
            admin.address,          // _defaultAdmin
            pauser.address,         // _pauser  
            tokenManager.address,   // _tokenManager
            admin.address,          // _upgrader (unused placeholder)
            productManager.address, // _productManager
            multiSig.address        // _multiSig
          ],
          {
            kind: "uups",
            initializer: "initialize",
            timeout: 180000 // 3 minutes timeout
          }
        );

        // Wait for deployment with more confirmations
        await productSubscription.waitForDeployment();
        await productSubscription.deploymentTransaction()?.wait(3); // Wait for 3 confirmations

        const proxyAddress = await productSubscription.getAddress();
        console.log("ProductSubscription proxy contract address:", proxyAddress);

        const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("Implementation contract address:", implementationAddress);

        return { proxyAddress, implementationAddress, productSubscription };
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

  const result = await deployWithRetry();
  
  if (result) {
    const { proxyAddress, implementationAddress, productSubscription } = result;
    
    // Verify initial state
    console.log("\nVerifying initial contract state:");
    try {
      console.log("MultiSig address:", await productSubscription.multiSig());
      
      // Check roles
      const ADMIN_ROLE = await productSubscription.ADMIN_ROLE();
      const PAUSER_ROLE = await productSubscription.PAUSER_ROLE();
      const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
      const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();
      
      console.log("Admin role assigned:", await productSubscription.hasRole(ADMIN_ROLE, admin.address));
      console.log("Pauser role assigned:", await productSubscription.hasRole(PAUSER_ROLE, pauser.address));
      console.log("Token Manager role assigned:", await productSubscription.hasRole(TOKEN_MANAGER_ROLE, tokenManager.address));
      console.log("Product Manager role assigned:", await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, productManager.address));
      
    } catch (error) {
      console.warn("Warning: Could not verify all contract state:", error);
    }

    const deploymentInfo = {
      contract: "ProductSubscription",
      network: net.name,
      chainId: Number(net.chainId),
      adminAddress: admin.address,
      pauserAddress: pauser.address,
      tokenManagerAddress: tokenManager.address,
      productManagerAddress: productManager.address,
      multiSigAddress: multiSig.address,
      proxyAddress: proxyAddress,
      implementationAddress: implementationAddress,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date().toISOString(),
      deploymentDate: new Date().toLocaleDateString(),
      deploymentTime: new Date().toLocaleTimeString()
    };

    // Create output directory (if not exists)
    const outputDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `ProductSubscription-${net.name}-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2), "utf-8");
    console.log("\n=== Deployment Complete ===");
    console.log("Deployment information saved to:", outputPath);
    console.log(`Contract deployed successfully on ${net.name}!`);
    
    console.log("\n=== Next Steps ===");
    console.log(`1. Add supported tokens using addSupportedToken() on ${net.name}`);
    console.log(`2. Add products using addProduct() on ${net.name}`);
    console.log(`3. Verify contract if needed: npx hardhat verify --network ${net.name} ${proxyAddress}`);
    
    return deploymentInfo;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
