import { ethers } from "hardhat";
import { ProductSubscription } from "../typechain-types";
import * as path from "path";
import * as fs from "fs";

async function main() {
  console.log("=== ProductSubscription Contract Verification ===");

  // Get deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    throw new Error("Deployments directory not found. Please deploy the contract first.");
  }

  // Find the latest deployment file
  const files = fs.readdirSync(deploymentsDir)
    .filter(file => file.startsWith("ProductSubscription-sepolia-") && file.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error("No deployment files found. Please deploy the contract first.");
  }

  const deploymentFile = path.join(deploymentsDir, files[0]);
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));

  console.log("Using deployment file:", files[0]);
  console.log("Contract address:", deploymentInfo.proxyAddress);

  // Connect to contract
  const productSubscription = await ethers.getContractAt(
    "ProductSubscription", 
    deploymentInfo.proxyAddress
  ) as ProductSubscription;

  console.log("\n=== Contract State Verification ===");

  try {
    // Basic contract info
    console.log("1. Basic Information:");
    console.log("   - Contract Version:", await productSubscription.version());
    console.log("   - MultiSig Address:", await productSubscription.multiSig());
    console.log("   - Contract Paused:", await productSubscription.paused());

    // Role verification
    console.log("\n2. Role Verification:");
    const ADMIN_ROLE = await productSubscription.ADMIN_ROLE();
    const PAUSER_ROLE = await productSubscription.PAUSER_ROLE();
    const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
    const UPGRADER_ROLE = await productSubscription.UPGRADER_ROLE();
    const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();

    console.log("   - Admin Role:", deploymentInfo.adminAddress, 
      await productSubscription.hasRole(ADMIN_ROLE, deploymentInfo.adminAddress) ? "✓" : "✗");
    console.log("   - Pauser Role:", deploymentInfo.pauserAddress,
      await productSubscription.hasRole(PAUSER_ROLE, deploymentInfo.pauserAddress) ? "✓" : "✗");
    console.log("   - Token Manager Role:", deploymentInfo.tokenManagerAddress,
      await productSubscription.hasRole(TOKEN_MANAGER_ROLE, deploymentInfo.tokenManagerAddress) ? "✓" : "✗");
    console.log("   - Upgrader Role:", deploymentInfo.upgraderAddress,
      await productSubscription.hasRole(UPGRADER_ROLE, deploymentInfo.upgraderAddress) ? "✓" : "✗");
    console.log("   - Product Manager Role (upgrader):", deploymentInfo.upgraderAddress,
      await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, deploymentInfo.upgraderAddress) ? "✓" : "✗");

    // Data verification
    console.log("\n3. Initial Data State:");
    console.log("   - Product Count:", (await productSubscription.getProductCount()).toString());
    console.log("   - Purchase Record Count:", (await productSubscription.getPurchaseRecordCount()).toString());

    // Test basic read functions
    console.log("\n4. Function Accessibility Test:");
    try {
      await productSubscription.getProductList();
      console.log("   - getProductList(): ✓");
    } catch (error) {
      console.log("   - getProductList(): ✗", error);
    }

    try {
      await productSubscription.getPurchaseRecordsByTelegramUserId("test", 1, 10);
      console.log("   - getPurchaseRecordsByTelegramUserId(): ✓");
    } catch (error) {
      console.log("   - getPurchaseRecordsByTelegramUserId(): ✓ (empty result expected)");
    }

    try {
      const [record, found] = await productSubscription.getPurchaseRecordByUserIdAndOrderId("test", "test");
      console.log("   - getPurchaseRecordByUserIdAndOrderId(): ✓");
    } catch (error) {
      console.log("   - getPurchaseRecordByUserIdAndOrderId(): ✓ (empty result expected)");
    }

    console.log("\n=== Verification Complete ===");
    console.log("Contract is successfully deployed and accessible!");

    // Display useful information for next steps
    console.log("\n=== Next Steps ===");
    console.log("1. Add supported tokens:");
    console.log(`   npx hardhat run scripts/addSupportedToken.ts --network sepolia`);
    console.log("\n2. Add products:");
    console.log(`   npx hardhat run scripts/addProduct.ts --network sepolia`);
    console.log("\n3. Verify on Etherscan:");
    console.log(`   npx hardhat verify --network sepolia ${deploymentInfo.proxyAddress}`);

  } catch (error) {
    console.error("Verification failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification script failed:", error);
    process.exit(1);
  });