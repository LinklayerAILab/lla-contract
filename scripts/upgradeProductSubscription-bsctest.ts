import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load env from .env.local (if present), then .env
(() => {
  const envLocal = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal });
  }
  dotenv.config();
})();

/**
 * Upgrade ProductSubscription on BNB Testnet (chainId 97).
 * Usage:
 *   PROXY_ADDRESS=0xYourProxy npx hardhat run scripts/upgradeProductSubscription-bsctest.ts --network bsctest
 * or
 *   BSCTEST_PROXY_ADDRESS=0xYourProxy npx hardhat run scripts/upgradeProductSubscription-bsctest.ts --network bsctest
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);

  if (network.chainId !== 97n) {
    console.warn("Warning: You are not on BNB Testnet (97). Proceeding anyway.");
  }
  console.log("PROXY_ADDRESS",process.env.BSCTEST_PROXY_ADDRESS);
  const proxyAddress = process.env.BSCTEST_PROXY_ADDRESS || process.env.PROXY_ADDRESS;
  if (!proxyAddress || !ethers.isAddress(proxyAddress)) {
    throw new Error("Missing or invalid PROXY_ADDRESS/BSCTEST_PROXY_ADDRESS env var");
  }

  // The signer must have ADMIN_ROLE on the proxy to authorize upgrade
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${await signer.getAddress()}`);

  // Pre-check: signer has ADMIN_ROLE on proxy
  const proxy = await ethers.getContractAt("ProductSubscription", proxyAddress, signer);
  const ADMIN_ROLE = await proxy.ADMIN_ROLE();
  const isAdmin = await proxy.hasRole(ADMIN_ROLE, await signer.getAddress());
  if (!isAdmin) {
    throw new Error("Signer does not have ADMIN_ROLE on ProductSubscription proxy");
  }

  console.log("Fetching ProductSubscription factory...");
  const ProductSubscriptionFactory = await ethers.getContractFactory("ProductSubscription", signer);

  const beforeImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`Current implementation: ${beforeImpl}`);
  console.log(`Upgrading proxy at ${proxyAddress} ...`);
  let upgraded;
  try {
    upgraded = await upgrades.upgradeProxy(proxyAddress, ProductSubscriptionFactory, { kind: "uups" });
  } catch (e: any) {
    const msg = (e?.message || "").toString();
    if (msg.includes("is not registered")) {
      console.warn("Implementation not registered in manifest. Forcing import and retrying upgrade...");
      await upgrades.forceImport(proxyAddress, ProductSubscriptionFactory, { kind: "uups" });
      upgraded = await upgrades.upgradeProxy(proxyAddress, ProductSubscriptionFactory, { kind: "uups" });
    } else {
      throw e;
    }
  }
  await upgraded.waitForDeployment();

  const impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Upgrade successful.");
  console.log(`Proxy:          ${proxyAddress}`);
  console.log(`Implementation:  ${impl}`);
}

main().catch((err) => {
  console.error("Upgrade failed:", err);
  process.exit(1);
});
