import { ethers } from "hardhat";
import { ProductSubscription } from "../typechain-types";
import * as path from "path";
import * as fs from "fs";

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`=== ProductSubscription Verification on ${net.name} (chainId: ${net.chainId}) ===`);

  // Get deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    throw new Error("Deployments directory not found. Please deploy the contract first.");
  }

  // Find latest deployment file for current network (fallback: any ProductSubscription-*.json)
  const allFiles = fs.readdirSync(deploymentsDir).filter(f => f.startsWith("ProductSubscription-") && f.endsWith(".json"));
  const networkFiles = allFiles.filter(f => f.startsWith(`ProductSubscription-${net.name}-`));
  const files = (networkFiles.length > 0 ? networkFiles : allFiles).sort().reverse();

  if (files.length === 0) {
    throw new Error("No deployment files found. Please deploy the contract first.");
  }

  const deploymentFile = path.join(deploymentsDir, files[0]);
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));

  console.log("Using deployment file:", path.basename(deploymentFile));
  console.log("Contract address:", deploymentInfo.proxyAddress);

  // Connect to contract
  const productSubscription = (await ethers.getContractAt(
    "ProductSubscription",
    deploymentInfo.proxyAddress
  )) as ProductSubscription;

  console.log("\n=== Contract State Verification ===");

  try {
    // Basic contract info
    console.log("1. Basic Information:");
    console.log("   - MultiSig Address:", await productSubscription.multiSig());
    console.log("   - Contract Paused:", await productSubscription.paused());

    // Role verification
    console.log("\n2. Role Verification:");
    const ADMIN_ROLE = await productSubscription.ADMIN_ROLE();
    const PAUSER_ROLE = await productSubscription.PAUSER_ROLE();
    const TOKEN_MANAGER_ROLE = await productSubscription.TOKEN_MANAGER_ROLE();
    const PRODUCT_MANAGER_ROLE = await productSubscription.PRODUCT_MANAGER_ROLE();

    if (deploymentInfo.adminAddress) {
      console.log(
        "   - Admin Role:",
        deploymentInfo.adminAddress,
        (await productSubscription.hasRole(ADMIN_ROLE, deploymentInfo.adminAddress)) ? "✓" : "✗"
      );
    }
    if (deploymentInfo.pauserAddress) {
      console.log(
        "   - Pauser Role:",
        deploymentInfo.pauserAddress,
        (await productSubscription.hasRole(PAUSER_ROLE, deploymentInfo.pauserAddress)) ? "✓" : "✗"
      );
    }
    if (deploymentInfo.tokenManagerAddress) {
      console.log(
        "   - Token Manager Role:",
        deploymentInfo.tokenManagerAddress,
        (await productSubscription.hasRole(TOKEN_MANAGER_ROLE, deploymentInfo.tokenManagerAddress)) ? "✓" : "✗"
      );
    }
    if (deploymentInfo.productManagerAddress) {
      console.log(
        "   - Product Manager Role:",
        deploymentInfo.productManagerAddress,
        (await productSubscription.hasRole(PRODUCT_MANAGER_ROLE, deploymentInfo.productManagerAddress)) ? "✓" : "✗"
      );
    }

    // Read-only function checks
    console.log("\n3. Read Function Checks:");
    try {
      const list = await productSubscription.getProductList();
      console.log("   - getProductList(): ✓ (items:", list.length, ")");
    } catch (e) {
      console.log("   - getProductList(): ✗", e);
    }

    try {
      const page = await productSubscription.getProductListPaginated(0, 10);
      console.log("   - getProductListPaginated(0,10): ✓ (items:", page.length, ")");
    } catch (e) {
      console.log("   - getProductListPaginated(0,10): ✗", e);
    }

    if (deploymentInfo.adminAddress) {
      try {
        const recs = await productSubscription.getPurchaseRecordsByAddress(deploymentInfo.adminAddress, 1, 10);
        console.log("   - getPurchaseRecordsByAddress(admin,1,10): ✓ (items:", recs.length, ")");
      } catch (e) {
        console.log("   - getPurchaseRecordsByAddress(admin,1,10): ✗", e);
      }
    }

    console.log("\n=== Verification Complete ===");
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
